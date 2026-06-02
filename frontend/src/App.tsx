import { useEffect, useState } from 'react';
import type { SceneFrame } from './schema/sceneFrame';
import { BevCanvas, categoryColor } from './rendering/BevCanvas';
import { BevScene3D } from './rendering/BevScene3D';
import { displayName } from './rendering/categories';

interface SidePanelProps {
  frame: SceneFrame;
  mode: '2d' | '3d';
  onModeChange: (m: '2d' | '3d') => void;
}

function SidePanel({ frame, mode, onModeChange }: SidePanelProps) {
  const counts = new Map<string, number>();
  for (const o of frame.objects) {
    counts.set(o.category, (counts.get(o.category) ?? 0) + 1);
  }
  const topCats = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  return (
    <div className="side-panel">
      <div className="panel-title">BEV VIEWER</div>

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
    </div>
  );
}

export default function App() {
  const [frame, setFrame]   = useState<SceneFrame | null>(null);
  const [error, setError]   = useState<string | null>(null);
  const [mode,  setMode]    = useState<'2d' | '3d'>('3d');

  useEffect(() => {
    fetch('/scene_frames/nuscenes_sample_frame.json')
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<SceneFrame>;
      })
      .then(d => setFrame(d))
      .catch(e => setError(String(e)));
  }, []);

  if (error) {
    return (
      <div className="viewer-shell">
        <span className="status-msg">Error: {error}</span>
      </div>
    );
  }

  if (!frame) {
    return (
      <div className="viewer-shell">
        <span className="status-msg">Loading…</span>
      </div>
    );
  }

  return (
    <div className="viewer-shell">
      <SidePanel frame={frame} mode={mode} onModeChange={(m) => setMode(m)} />
      <div className="canvas-wrap">
        {mode === '3d' ? <BevScene3D frame={frame} /> : <BevCanvas frame={frame} />}
      </div>
    </div>
  );
}
