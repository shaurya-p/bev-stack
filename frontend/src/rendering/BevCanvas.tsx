import { useEffect, useRef } from 'react';
import type { MapLayer, MapPolygon, MapPolyline, Object3D, SceneFrame, Vec3 } from '../schema/sceneFrame';
import { normalizeCategory, type NormalizedCategory } from './categories';
import {
  centerlineStyle,
  crosswalkStyle,
  dividerStyle,
  drivableStyle,
  stopLineStyle,
  type LineStyle,
  type MapVisibility,
} from './mapStyle';
import { IDENTITY_DELTA, type EgoMapDelta } from './egoMotion';

// ── canvas dimensions ────────────────────────────────────────────────────────

const W = 800;
const H = 800;
const PX_PER_M = 5;

// Ego sits slightly below centre for more forward road space.
const EGO_SX = W / 2;
const EGO_SY = H * 0.57;

// ── coordinate mapping ───────────────────────────────────────────────────────
//
//   ego-x (forward) → screen-up   (−screen_y direction)
//   ego-y (left)    → screen-left (−screen_x direction)
//
//   screen_x = EGO_SX − ego_y * PX_PER_M
//   screen_y = EGO_SY − ego_x * PX_PER_M

function toScreen(egoX: number, egoY: number): [number, number] {
  return [EGO_SX - egoY * PX_PER_M, EGO_SY - egoX * PX_PER_M];
}

// Canvas rotation for a box whose length is along local x-axis.
// yaw_ego_rad=0  → screenYaw=-π/2 → local-x points screen-up  ✓
// yaw_ego_rad=π/2 → screenYaw=-π  → local-x points screen-left ✓
function toScreenYaw(yawEgo: number): number {
  return -Math.PI / 2 - yawEgo;
}

// ── 2D palette ───────────────────────────────────────────────────────────────
// Tuned for the dark canvas background. Distinct from the 3D registry palette
// (which is tuned for the light-mode scene), but both keyed by the same
// NormalizedCategory union so categorization stays in one place.

const PALETTE_2D: Record<NormalizedCategory, string> = {
  car:                  '#3d8fd6',
  truck:                '#5faacc',
  bus:                  '#5faacc',
  motorcycle:           '#7890c0',
  bicycle:              '#5faa70',
  construction_vehicle: '#556070',
  pedestrian:           '#d4882e',
  barrier:              '#3a4050',
  traffic_cone:         '#c05a18',
  movable_object:       '#3a4050',
  unknown:              '#556070',
};

export function categoryColor(raw: string): string {
  return PALETTE_2D[normalizeCategory(raw)];
}

export function hexAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── background / grid / rings ─────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(
    EGO_SX, EGO_SY, 0,
    EGO_SX, EGO_SY, Math.max(W, H) * 0.72,
  );
  g.addColorStop(0,   '#0f1826');
  g.addColorStop(0.3, '#090e1a');
  g.addColorStop(1,   '#060a12');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  const step = 20 * PX_PER_M;
  ctx.strokeStyle = '#080e1a';
  ctx.lineWidth = 1;
  for (let x = EGO_SX % step; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = EGO_SY % step; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawRangeRings(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#111d2e';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 8]);
  ctx.font = '9px monospace';
  ctx.fillStyle = '#1e3450';
  ctx.textAlign = 'center';
  for (const r of [20, 40, 60, 80]) {
    const px = r * PX_PER_M;
    ctx.beginPath();
    ctx.arc(EGO_SX, EGO_SY, px, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillText(`${r}m`, EGO_SX, EGO_SY - px - 4);
  }
  ctx.setLineDash([]);
  ctx.textAlign = 'left';
}

// ── map layers ───────────────────────────────────────────────────────────────
// Drawn beneath objects. Geometry is ego-frame meters; same toScreen mapping
// as boxes. Style comes from the shared mapStyle module so 2D and 3D agree.

function tracePolygon(ctx: CanvasRenderingContext2D, ring: Vec3[]): void {
  ring.forEach((p, i) => {
    const [sx, sy] = toScreen(p.x, p.y);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
}

function drawMapPolygon(
  ctx: CanvasRenderingContext2D,
  poly: MapPolygon,
  color: string,
  opacity: number,
): void {
  if (poly.exterior_ego_m.length < 4) return;
  ctx.beginPath();
  tracePolygon(ctx, poly.exterior_ego_m);
  for (const hole of poly.holes_ego_m) {
    if (hole.length >= 4) tracePolygon(ctx, hole);
  }
  ctx.fillStyle = hexAlpha(color, opacity);
  ctx.fill('evenodd');
}

function drawMapPolyline(
  ctx: CanvasRenderingContext2D,
  line: MapPolyline,
  style: LineStyle,
): void {
  if (line.points_ego_m.length < 2) return;
  ctx.strokeStyle = hexAlpha(style.color, style.opacity);
  ctx.lineWidth = style.widthPx;
  ctx.setLineDash(style.dashed ? [6, 8] : []);
  ctx.beginPath();
  line.points_ego_m.forEach((p, i) => {
    const [sx, sy] = toScreen(p.x, p.y);
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawMapLayer(
  ctx: CanvasRenderingContext2D,
  layer: MapLayer,
  vis: MapVisibility,
): void {
  const v = vis[layer.source];
  if (v && !v.enabled) return;
  const sub = v?.sublayers;

  if (sub?.drivable_areas ?? true) {
    for (const p of layer.drivable_areas) {
      const s = drivableStyle(layer, p.confidence);
      // 2D canvas background is darker than the 3D scene; lift HD fill a touch.
      drawMapPolygon(ctx, p, s.color, Math.min(1, s.opacity * 0.5));
    }
  }
  if (sub?.crosswalks ?? true) {
    for (const p of layer.crosswalks) {
      const s = crosswalkStyle(layer, p.confidence);
      drawMapPolygon(ctx, p, s.color, s.opacity);
    }
  }
  if (sub?.lane_dividers ?? true) {
    for (const l of layer.lane_dividers) {
      drawMapPolyline(ctx, l, dividerStyle(layer, l.kind, l.confidence));
    }
  }
  if (sub?.stop_lines ?? true) {
    for (const l of layer.stop_lines) {
      drawMapPolyline(ctx, l, stopLineStyle(layer, l.confidence));
    }
  }
  if (sub?.centerlines ?? false) {
    for (const l of layer.centerlines) {
      drawMapPolyline(ctx, l, centerlineStyle(layer, l.confidence));
    }
  }
}

// ── ego vehicle ───────────────────────────────────────────────────────────────

function drawEgo(ctx: CanvasRenderingContext2D): void {
  const x  = EGO_SX;
  const y  = EGO_SY;
  const hw = 8;
  const nh = 18;

  ctx.shadowColor = '#3366aa';
  ctx.shadowBlur  = 20;

  ctx.beginPath();
  ctx.moveTo(x,       y - nh - 4);
  ctx.lineTo(x + hw,  y - nh + 5);
  ctx.lineTo(x + hw,  y + nh - 5);
  ctx.lineTo(x,       y + nh + 2);
  ctx.lineTo(x - hw,  y + nh - 5);
  ctx.lineTo(x - hw,  y - nh + 5);
  ctx.closePath();
  ctx.fillStyle = '#c8dcff';
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.fillStyle = 'rgba(16, 34, 72, 0.88)';
  ctx.fillRect(x - hw * 0.55, y - nh * 0.25, hw * 1.1, nh * 0.65);

  ctx.fillStyle = '#5599cc';
  ctx.beginPath();
  ctx.moveTo(x,        y - nh - 4);
  ctx.lineTo(x - 3.5,  y - nh + 5);
  ctx.lineTo(x + 3.5,  y - nh + 5);
  ctx.closePath();
  ctx.fill();
}

// ── 2D flat object rendering ──────────────────────────────────────────────────

function draw2DObject(ctx: CanvasRenderingContext2D, obj: Object3D): void {
  const { center_ego_m, size_lwh_m, yaw_ego_rad } = obj.box;
  const [sx, sy]  = toScreen(center_ego_m.x, center_ego_m.y);
  const angle     = toScreenYaw(yaw_ego_rad);
  const halfL     = Math.max((size_lwh_m.x / 2) * PX_PER_M, 3);
  const halfW     = Math.max((size_lwh_m.y / 2) * PX_PER_M, 3);
  const cat       = normalizeCategory(obj.category);
  const color     = PALETTE_2D[cat];

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);

  if (cat === 'traffic_cone') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(halfL, 3.5), 0, Math.PI * 2);
    ctx.fill();
  } else if (cat === 'barrier' || cat === 'movable_object') {
    ctx.fillStyle = hexAlpha(color, 0.40);
    ctx.fillRect(-halfL, -halfW, halfL * 2, halfW * 2);
    ctx.strokeStyle = hexAlpha(color, 0.65);
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfL, -halfW, halfL * 2, halfW * 2);
  } else if (cat === 'pedestrian') {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfL, -halfW, halfL * 2, halfW * 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillStyle = hexAlpha(color, 0.08);
    ctx.fillRect(-halfL, -halfW, halfL * 2, halfW * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-halfL, -halfW, halfL * 2, halfW * 2);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(halfL, 0);
    ctx.stroke();
  }

  ctx.restore();
}

// ── component ─────────────────────────────────────────────────────────────────

export interface BevCanvasProps {
  frame:          SceneFrame;
  mapVisibility?: MapVisibility;
  /** Rigid ego-motion delta for smooth map scrolling between keyframes. */
  mapMotion?:     EgoMapDelta;
}

// Static props (barriers / cones / pushable_pullable) render under dynamic
// agents to avoid occluding cars and pedestrians. We keep this check on the
// raw category string so all `movable_object.*` subtypes — including those
// that normalize to other categories like traffic_cone — stay in the lower
// layer.
function isStaticProp(o: Object3D): boolean {
  return o.category.startsWith('movable_object.');
}

export function BevCanvas({
  frame,
  mapVisibility = {},
  mapMotion = IDENTITY_DELTA,
}: BevCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx);
    drawGrid(ctx);
    drawRangeRings(ctx);

    // Rigid ego-motion transform so the map glides between keyframes, matching
    // the 3D view. Ego rotation +θ about z maps to screen rotation −θ; the
    // ego-frame offset maps through the same toScreen axis convention.
    ctx.save();
    ctx.translate(
      EGO_SX - mapMotion.offsetEgoY * PX_PER_M,
      EGO_SY - mapMotion.offsetEgoX * PX_PER_M,
    );
    ctx.rotate(-mapMotion.dyawRad);
    ctx.translate(-EGO_SX, -EGO_SY);
    for (const layer of frame.map_layers) drawMapLayer(ctx, layer, mapVisibility);
    ctx.restore();

    const below = frame.objects.filter(isStaticProp);
    const above = frame.objects.filter(o => !isStaticProp(o));
    for (const o of below) draw2DObject(ctx, o);
    for (const o of above) draw2DObject(ctx, o);

    drawEgo(ctx);
  }, [frame, mapVisibility, mapMotion]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ display: 'block' }}
    />
  );
}
