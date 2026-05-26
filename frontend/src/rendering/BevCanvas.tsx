import { useEffect, useRef } from 'react';
import type { SceneFrame, Object3D } from '../schema/sceneFrame';

const W = 800;
const H = 800;
const PX_PER_M = 5;

// Ego marker sits slightly below center for more forward space.
const EGO_SX = W / 2;
const EGO_SY = H * 0.57;

// Ego-frame → screen canvas:
//   ego-x (forward) → screen-up   (−screen_y direction)
//   ego-y (left)    → screen-left (−screen_x direction)
function toScreen(egoX: number, egoY: number): [number, number] {
  return [EGO_SX - egoY * PX_PER_M, EGO_SY - egoX * PX_PER_M];
}

// Canvas rotation: box length drawn along local x-axis.
// yaw_ego_rad=0 (facing forward) → screenYaw=-π/2 → local-x points screen-up ✓
// yaw_ego_rad=π/2 (facing left)  → screenYaw=-π   → local-x points screen-left ✓
function toScreenYaw(yawEgo: number): number {
  return -Math.PI / 2 - yawEgo;
}

const COLORS = {
  car:         '#3d8fd6',
  pedestrian:  '#d4882e',
  truck:       '#5faacc',
  bus:         '#5faacc',
  motorcycle:  '#7890c0',
  bicycle:     '#5faa70',
  barrier:     '#3a4050',
  trafficcone: '#c05a18',
  default:     '#556070',
};

export function categoryColor(cat: string): string {
  if (cat.includes('car'))         return COLORS.car;
  if (cat.includes('pedestrian'))  return COLORS.pedestrian;
  if (cat.includes('truck'))       return COLORS.truck;
  if (cat.includes('bus'))         return COLORS.bus;
  if (cat.includes('motorcycle'))  return COLORS.motorcycle;
  if (cat.includes('bicycle'))     return COLORS.bicycle;
  if (cat.includes('barrier'))     return COLORS.barrier;
  if (cat.includes('cone'))        return COLORS.trafficcone;
  return COLORS.default;
}

function hexAlpha(hex: string, a: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── drawing helpers ──────────────────────────────────────────────────────────

function drawBackground(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = '#070b14';
  ctx.fillRect(0, 0, W, H);
}

function drawGrid(ctx: CanvasRenderingContext2D): void {
  const step = 20 * PX_PER_M;
  ctx.strokeStyle = '#0c1220';
  ctx.lineWidth = 1;

  for (let x = EGO_SX % step; x < W; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = EGO_SY % step; y < H; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
}

function drawRangeRings(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = '#131d2e';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 7]);
  ctx.font = '10px monospace';
  ctx.fillStyle = '#243650';
  ctx.textAlign = 'center';

  for (const r of [20, 40, 60, 80]) {
    const px = r * PX_PER_M;
    ctx.beginPath();
    ctx.arc(EGO_SX, EGO_SY, px, 0, Math.PI * 2);
    ctx.stroke();
    // label at top of ring — forward direction = screen-up
    ctx.fillText(`${r}m`, EGO_SX, EGO_SY - px - 4);
  }

  ctx.setLineDash([]);
  ctx.textAlign = 'left';
}

function drawEgo(ctx: CanvasRenderingContext2D): void {
  const bw = 14;
  const bh = 26;

  // Glow to anchor ego as the scene origin
  ctx.shadowColor = '#4477aa';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#c8dcff';
  ctx.fillRect(EGO_SX - bw / 2, EGO_SY - bh / 2, bw, bh);
  ctx.shadowBlur = 0;

  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(EGO_SX - bw / 2, EGO_SY - bh / 2, bw, bh);

  // Forward triangle above the body
  const tipY = EGO_SY - bh / 2;
  ctx.fillStyle = '#070b14';
  ctx.beginPath();
  ctx.moveTo(EGO_SX,              tipY - 6);
  ctx.lineTo(EGO_SX - bw / 2 + 2, tipY + 2);
  ctx.lineTo(EGO_SX + bw / 2 - 2, tipY + 2);
  ctx.closePath();
  ctx.fill();
}

function drawObject(ctx: CanvasRenderingContext2D, obj: Object3D): void {
  const { center_ego_m, size_lwh_m, yaw_ego_rad } = obj.box;
  const [sx, sy] = toScreen(center_ego_m.x, center_ego_m.y);
  const angle = toScreenYaw(yaw_ego_rad);

  // size_lwh_m: x=length (along ego-x / local-x after rotate), y=width, z=height
  // Enforce minimum half-size so tiny objects (e.g. 0.8m pedestrian) are still visible
  const halfL = Math.max((size_lwh_m.x / 2) * PX_PER_M, 3);
  const halfW = Math.max((size_lwh_m.y / 2) * PX_PER_M, 3);

  const color = categoryColor(obj.category);
  const cat = obj.category;

  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);

  if (cat.includes('cone')) {
    // Traffic cones: always-visible filled dot
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(halfL, 3.5), 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hexAlpha(color, 0.6);
    ctx.lineWidth = 1;
    ctx.stroke();

  } else if (cat.startsWith('movable_object.')) {
    // Barriers: recessed semi-transparent fill + muted stroke, no heading
    ctx.fillStyle = hexAlpha(color, 0.40);
    ctx.fillRect(-halfL, -halfW, halfL * 2, halfW * 2);
    ctx.strokeStyle = hexAlpha(color, 0.65);
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfL, -halfW, halfL * 2, halfW * 2);

  } else if (cat.includes('pedestrian')) {
    // Pedestrians: outline box + center dot so tiny ones register as dots
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.strokeRect(-halfL, -halfW, halfL * 2, halfW * 2);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fill();

  } else {
    // Vehicles (car, truck, bus, bicycle, motorcycle):
    // thin fill hint + crisp stroke + forward tick from center to front edge
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

// ── component ────────────────────────────────────────────────────────────────

interface Props {
  frame: SceneFrame;
}

export function BevCanvas({ frame }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    drawBackground(ctx);
    drawGrid(ctx);
    drawRangeRings(ctx);

    // Barriers/cones below, vehicles/pedestrians above
    const below = frame.objects.filter(o => o.category.startsWith('movable_object.'));
    const above = frame.objects.filter(o => !o.category.startsWith('movable_object.'));
    for (const o of below) drawObject(ctx, o);
    for (const o of above) drawObject(ctx, o);

    drawEgo(ctx);
  }, [frame]);

  return (
    <canvas
      ref={canvasRef}
      width={W}
      height={H}
      style={{ display: 'block' }}
    />
  );
}
