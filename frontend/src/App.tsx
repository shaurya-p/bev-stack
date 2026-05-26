import { useEffect, useState } from 'react';
import type { SceneFrame } from './schema/sceneFrame';
import { BevCanvas, categoryColor } from './rendering/BevCanvas';

function displayCategory(cat: string): string {
  if (cat.includes('pedestrian'))    return 'pedestrian';
  if (cat.includes('vehicle.car'))   return 'car';
  if (cat.includes('vehicle.truck')) return 'truck';
  if (cat.includes('vehicle.bus'))   return 'bus';
  if (cat.includes('motorcycle'))    return 'motorcycle';
  if (cat.includes('bicycle'))       return 'bicycle';
  if (cat.includes('barrier'))       return 'barrier';
  if (cat.includes('cone'))          return 'traffic cone';
  if (cat.includes('construction'))  return 'construction';
  const last = cat.split('.').pop() ?? cat;
  return last.replace(/_/g, ' ');
}

function SidePanel({ frame }: { frame: SceneFrame }) {
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
              <span className="panel-cat-name">{displayCategory(cat)}</span>
              <span className="panel-cat-count">{n}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [frame, setFrame] = useState<SceneFrame | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <SidePanel frame={frame} />
      <div className="canvas-wrap">
        <BevCanvas frame={frame} />
      </div>
    </div>
  );
}
