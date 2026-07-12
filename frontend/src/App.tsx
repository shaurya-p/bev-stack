import { useEffect, useMemo, useState } from 'react';
import type { SceneFrame } from './schema/sceneFrame';
import { BevCanvas } from './rendering/BevCanvas';
import { BevScene3D } from './rendering/BevScene3D';
import { TransportBar } from './rendering/TransportBar';
import { displayName } from './rendering/categories';
import { categoryColor } from './rendering/visuals/registry';
import {
  MAP_SUBLAYERS,
  SUBLAYER_LABELS,
  ensureVisibilityFor,
  sourceAccent,
  type MapSublayer,
  type MapVisibility,
} from './rendering/mapStyle';
import { egoMapDelta } from './rendering/egoMotion';
import { normalizeFrame } from './sequence/manifest';
import { usePlayback } from './sequence/usePlayback';
import { interpolateFrame, lerp } from './sequence/interpolate';

const SEQUENCE_URL = '/scene_frames/nuscenes_scene_0061/manifest.json';
const FALLBACK_FRAME_URL = '/scene_frames/nuscenes_sample_frame.json';

interface MapLayerControlsProps {
  frame:               SceneFrame;
  mapVisibility:       MapVisibility;
  onToggleSource:      (source: string) => void;
  onToggleSublayer:    (source: string, sublayer: MapSublayer) => void;
}

function MapLayerControls({
  frame,
  mapVisibility,
  onToggleSource,
  onToggleSublayer,
}: MapLayerControlsProps) {
  if (frame.map_layers.length === 0) return null;
  return (
    <div className="panel-section">
      <div className="panel-section-heading">map layers</div>
      {frame.map_layers.map(layer => {
        const vis = mapVisibility[layer.source];
        const enabled = vis?.enabled ?? true;
        return (
          <div key={layer.source} className="map-layer-group">
            <button
              className={`map-source-toggle${enabled ? ' map-source-toggle--active' : ''}`}
              onClick={() => onToggleSource(layer.source)}
              title={`Toggle all ${layer.source} elements`}
            >
              <span
                className="panel-cat-dot"
                style={{ background: sourceAccent(layer.source) }}
              />
              {enabled ? '● ' : '○ '}{layer.source}
            </button>
            {enabled && (
              <div className="map-sublayer-row">
                {MAP_SUBLAYERS.map(sub => {
                  const count = layer[sub].length;
                  if (count === 0) return null;
                  const on = vis?.sublayers[sub] ?? (sub !== 'centerlines');
                  return (
                    <button
                      key={sub}
                      className={`map-sublayer-chip${on ? ' map-sublayer-chip--active' : ''}`}
                      onClick={() => onToggleSublayer(layer.source, sub)}
                      title={`${SUBLAYER_LABELS[sub]} (${count})`}
                    >
                      {SUBLAYER_LABELS[sub]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

interface HudPanelProps {
  frame:            SceneFrame;
  mode:             '2d' | '3d';
  onModeChange:     (m: '2d' | '3d') => void;
  showDebug:        boolean;
  onDebugChange:    (v: boolean) => void;
  mapVisibility:    MapVisibility;
  onToggleSource:   (source: string) => void;
  onToggleSublayer: (source: string, sublayer: MapSublayer) => void;
}

function HudPanel({
  frame,
  mode,
  onModeChange,
  showDebug,
  onDebugChange,
  mapVisibility,
  onToggleSource,
  onToggleSublayer,
}: HudPanelProps) {
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

      <MapLayerControls
        frame={frame}
        mapVisibility={mapVisibility}
        onToggleSource={onToggleSource}
        onToggleSublayer={onToggleSublayer}
      />

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
  const [mapVisibility, setMapVisibility] = useState<MapVisibility>({});

  const toggleMapSource = (source: string) =>
    setMapVisibility(v => {
      const withDefaults = ensureVisibilityFor([source], v);
      const cur = withDefaults[source];
      return { ...withDefaults, [source]: { ...cur, enabled: !cur.enabled } };
    });

  const toggleMapSublayer = (source: string, sublayer: MapSublayer) =>
    setMapVisibility(v => {
      const withDefaults = ensureVisibilityFor([source], v);
      const cur = withDefaults[source];
      return {
        ...withDefaults,
        [source]: {
          ...cur,
          sublayers: { ...cur.sublayers, [sublayer]: !cur.sublayers[sublayer] },
        },
      };
    });

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
      .then(d => setFallbackFrame(normalizeFrame(d)))
      .catch(e => setFallbackError(String(e)));
  }, [manifestMissing]);

  // Interpolated frame for the canvas (smooth playback between sparse keyframes).
  const renderFrame = useMemo(
    () => (pb.current ? interpolateFrame(pb.current, pb.next, pb.alpha) : null),
    [pb.current, pb.next, pb.alpha],
  );

  // Rigid map-motion delta: baked cur-ego map geometry re-expressed in the
  // alpha-interpolated ego frame, so the map glides instead of snapping.
  const mapMotion = useMemo(
    () =>
      egoMapDelta(
        pb.current?.ego.pose_global ?? null,
        pb.next?.ego.pose_global ?? null,
        pb.alpha,
      ),
    [pb.current, pb.next, pb.alpha],
  );

  const canvasFrame = renderFrame ?? fallbackFrame;
  // HUD shows discrete source-keyframe metadata, not interpolated values.
  const hudFrame = pb.current ?? fallbackFrame;

  // Seed visibility defaults for any map-layer sources newly seen in a frame.
  useEffect(() => {
    if (!hudFrame || hudFrame.map_layers.length === 0) return;
    setMapVisibility(v =>
      ensureVisibilityFor(hudFrame.map_layers.map(l => l.source), v),
    );
  }, [hudFrame]);

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

  if (!canvasFrame || !hudFrame) {
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
          ? <BevScene3D frame={canvasFrame} showDebug={showDebug} mapVisibility={mapVisibility} mapMotion={mapMotion} />
          : <BevCanvas frame={canvasFrame} mapVisibility={mapVisibility} mapMotion={mapMotion} />}
      </div>
      <HudPanel
        frame={hudFrame}
        mode={mode}
        onModeChange={setMode}
        showDebug={showDebug}
        onDebugChange={setShowDebug}
        mapVisibility={mapVisibility}
        onToggleSource={toggleMapSource}
        onToggleSublayer={toggleMapSublayer}
      />
      {pb.manifest && (
        <TransportBar
          index={pb.index}
          frameCount={pb.manifest.frame_count}
          timestampUs={
            lerp(
              pb.manifest.frames[pb.index]?.timestamp_us ?? 0,
              pb.manifest.frames[pb.index + 1]?.timestamp_us ??
                pb.manifest.frames[pb.index]?.timestamp_us ?? 0,
              pb.alpha,
            ) - (pb.manifest.frames[0]?.timestamp_us ?? 0)
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
