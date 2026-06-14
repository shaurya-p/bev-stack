import { useEffect, useState } from 'react';
import type { SceneFrame } from './schema/sceneFrame';
import { BevCanvas } from './rendering/BevCanvas';
import { BevScene3D } from './rendering/BevScene3D';
import { TransportBar } from './rendering/TransportBar';
import { displayName } from './rendering/categories';
import { categoryColor } from './rendering/visuals/registry';
import { usePlayback } from './sequence/usePlayback';

const SEQUENCE_URL = '/scene_frames/nuscenes_scene_0061/manifest.json';
const FALLBACK_FRAME_URL = '/scene_frames/nuscenes_sample_frame.json';

interface HudPanelProps {
  frame:           SceneFrame;
  mode:            '2d' | '3d';
  onModeChange:    (m: '2d' | '3d') => void;
  showDebug:       boolean;
  onDebugChange:   (v: boolean) => void;
}

function HudPanel({ frame, mode, onModeChange, showDebug, onDebugChange }: HudPanelProps) {
  const counts = new Map<string, number>();
  for (const o of frame.objects) {
    counts.set(o.category, (counts.get(o.category) ?? 0) + 1);
  }
  const topCats = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <aside className="hud-panel">
      <div className="hud-header">
        <div className="hud-title">BEV STACK</div>
        <div className="hud-subtitle">scene viewer</div>
      </div>

      <div className="mode-toggle">
        <button
          className={`mode-btn${mode === '3d' ? ' mode-btn--active' : ''}`}
          onClick={() => onModeChange('3d')}
        >
          3D
        </button>
        <button
          className={`mode-btn${mode === '2d' ? ' mode-btn--active' : ''}`}
          onClick={() => onModeChange('2d')}
        >
          2D
        </button>
      </div>

      <div className="panel-section">
        <div className="panel-row">
          <span className="panel-label">frame</span>
          <span className="panel-value panel-mono">{frame.frame_id.slice(0, 14)}…</span>
        </div>
        <div className="panel-row">
          <span className="panel-label">objects</span>
          <span className="panel-value">{frame.objects.length}</span>
        </div>
        <div className="panel-row">
          <span className="panel-label">cameras</span>
          <span className="panel-value">{frame.cameras.length}</span>
        </div>
        <div className="panel-row">
          <span className="panel-label">lidar</span>
          <span className="panel-value">{frame.lidar ? 'present' : 'absent'}</span>
        </div>
      </div>

      {topCats.length > 0 && (
        <div className="panel-section">
          <div className="panel-section-heading">categories</div>
          {topCats.map(([cat, n]) => (
            <div key={cat} className="panel-cat-row">
              <span
                className="panel-cat-dot"
                style={{ background: categoryColor(cat) }}
              />
              <span className="panel-cat-name">{displayName(cat)}</span>
              <span className="panel-cat-count">{n}</span>
            </div>
          ))}
        </div>
      )}

      {mode === '3d' && (
        <div className="panel-section panel-section--diagnostics">
          <div className="panel-section-heading">diagnostics</div>
          <button
            className={`debug-toggle${showDebug ? ' debug-toggle--active' : ''}`}
            onClick={() => onDebugChange(!showDebug)}
            title="Diagnostic overlay — flat footprints and labels at ground level. Not part of the polished view."
          >
            {showDebug ? '● debug overlay on' : '○ debug overlay'}
          </button>
        </div>
      )}
    </aside>
  );
}

export default function App() {
  const [mode,  setMode]          = useState<'2d' | '3d'>('3d');
  const [showDebug, setShowDebug] = useState<boolean>(false);

  const pb = usePlayback(SEQUENCE_URL);

  // Single-frame fallback: if the sequence manifest is missing, load the standalone JSON.
  const [fallbackFrame, setFallbackFrame] = useState<SceneFrame | null>(null);
  const [fallbackError, setFallbackError] = useState<string | null>(null);
  const manifestMissing = pb.manifest === null && pb.error !== null;

  useEffect(() => {
    if (!manifestMissing) return;
    fetch(FALLBACK_FRAME_URL)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SceneFrame>;
      })
      .then(d => setFallbackFrame(d))
      .catch(e => setFallbackError(String(e)));
  }, [manifestMissing]);

  const frame = pb.frame ?? fallbackFrame;

  if (manifestMissing && fallbackError) {
    return (
      <div className="viewer-root viewer-root--status">
        <span className="status-msg">Error: {fallbackError}</span>
      </div>
    );
  }

  if (pb.error && !manifestMissing) {
    return (
      <div className="viewer-root viewer-root--status">
        <span className="status-msg">Error: {pb.error}</span>
      </div>
    );
  }

  if (!frame) {
    return (
      <div className="viewer-root viewer-root--status">
        <span className="status-msg">Loading…</span>
      </div>
    );
  }

  return (
    <div className="viewer-root">
      <div className={`canvas-area${mode === '2d' ? ' canvas-area--2d' : ''}`}>
        {mode === '3d'
          ? <BevScene3D frame={frame} showDebug={showDebug} />
          : <BevCanvas frame={frame} />}
      </div>
      <HudPanel
        frame={frame}
        mode={mode}
        onModeChange={setMode}
        showDebug={showDebug}
        onDebugChange={setShowDebug}
      />
      {pb.manifest && (
        <TransportBar
          index={pb.index}
          frameCount={pb.manifest.frame_count}
          timestampUs={
            (pb.manifest.frames[pb.index]?.timestamp_us ?? 0) -
            (pb.manifest.frames[0]?.timestamp_us ?? 0)
          }
          playing={pb.playing}
          onToggle={pb.toggle}
          onSeek={pb.seek}
        />
      )}
      {mode === '3d' && (
        <div className="hud-hint">drag to orbit · scroll to zoom</div>
      )}
    </div>
  );
}
