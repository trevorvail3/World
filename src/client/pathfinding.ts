/**
 * src/client/pathfinding.ts
 * -------------------------
 * A* pathfinding lives in the CLIENT because it's a presentation concern:
 * it works out *which tiles to walk through* and the result is sent to the
 * core as a MOVE/INTERACT intent. The core stays the authority on where the
 * player actually is.
 *
 * Movement is 8-directional and refuses to cut diagonally through wall
 * corners: a diagonal step is only allowed if BOTH orthogonal tiles beside
 * it are walkable.
 */

import type { Vec2 } from "../core/types.ts";

type Walkable = (x: number, y: number) => boolean;

interface Node {
  x: number;
  y: number;
  g: number; // cost from start
  f: number; // g + heuristic
  parent: Node | null;
}

const STRAIGHT = 1;
const DIAGONAL = Math.SQRT2;

// 8 neighbour offsets. Diagonals carry the two orthogonals that must be
// clear for the move to be legal (no corner cutting).
const NEIGHBOURS: { dx: number; dy: number; need: Vec2[] }[] = [
  { dx: 1, dy: 0, need: [] },
  { dx: -1, dy: 0, need: [] },
  { dx: 0, dy: 1, need: [] },
  { dx: 0, dy: -1, need: [] },
  { dx: 1, dy: 1, need: [{ x: 1, y: 0 }, { x: 0, y: 1 }] },
  { dx: 1, dy: -1, need: [{ x: 1, y: 0 }, { x: 0, y: -1 }] },
  { dx: -1, dy: 1, need: [{ x: -1, y: 0 }, { x: 0, y: 1 }] },
  { dx: -1, dy: -1, need: [{ x: -1, y: 0 }, { x: 0, y: -1 }] },
];

function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return STRAIGHT * (dx + dy) + (DIAGONAL - 2 * STRAIGHT) * Math.min(dx, dy);
}

/**
 * Find a path from `start` to `goal`. Returns the list of tiles to step
 * onto, in order, NOT including the starting tile. Returns [] if the goal
 * is unreachable (or is itself unwalkable).
 */
export function findPath(
  walkable: Walkable,
  start: Vec2,
  goal: Vec2,
): Vec2[] {
  const sx = Math.round(start.x);
  const sy = Math.round(start.y);
  const gx = goal.x;
  const gy = goal.y;

  if (!walkable(gx, gy)) return [];
  if (sx === gx && sy === gy) return [];

  const open: Node[] = [];
  const startNode: Node = {
    x: sx,
    y: sy,
    g: 0,
    f: octile(sx, sy, gx, gy),
    parent: null,
  };
  open.push(startNode);

  const key = (x: number, y: number) => `${x},${y}`;
  const openMap = new Map<string, Node>([[key(sx, sy), startNode]]);
  const closed = new Set<string>();

  while (open.length > 0) {
    // Pull the lowest-f node (simple linear scan — the map is small).
    let bestIndex = 0;
    for (let i = 1; i < open.length; i++) {
      if (open[i]!.f < open[bestIndex]!.f) bestIndex = i;
    }
    const current = open.splice(bestIndex, 1)[0]!;
    openMap.delete(key(current.x, current.y));

    if (current.x === gx && current.y === gy) {
      return reconstruct(current);
    }
    closed.add(key(current.x, current.y));

    for (const n of NEIGHBOURS) {
      const nx = current.x + n.dx;
      const ny = current.y + n.dy;
      if (closed.has(key(nx, ny))) continue;
      if (!walkable(nx, ny)) continue;
      // No corner cutting: both flanking orthogonal tiles must be open.
      if (n.need.some((o) => !walkable(current.x + o.x, current.y + o.y))) {
        continue;
      }

      const stepCost = n.dx !== 0 && n.dy !== 0 ? DIAGONAL : STRAIGHT;
      const g = current.g + stepCost;
      const existing = openMap.get(key(nx, ny));
      if (existing && g >= existing.g) continue;

      const node: Node = {
        x: nx,
        y: ny,
        g,
        f: g + octile(nx, ny, gx, gy),
        parent: current,
      };
      if (existing) {
        existing.g = node.g;
        existing.f = node.f;
        existing.parent = current;
      } else {
        open.push(node);
        openMap.set(key(nx, ny), node);
      }
    }
  }

  return []; // no path
}

function reconstruct(node: Node): Vec2[] {
  const path: Vec2[] = [];
  let cur: Node | null = node;
  while (cur && cur.parent) {
    path.push({ x: cur.x, y: cur.y });
    cur = cur.parent;
  }
  path.reverse();
  return path;
}

/**
 * For interactions: find the walkable tile next to `target` that is cheapest
 * to reach from `from`, then return the path to it. Returns [] if the player
 * is already standing next to the target (caller should interact at once) or
 * if nothing adjacent is reachable. The `alreadyAdjacent` flag distinguishes
 * the two cases.
 */
export function pathToAdjacent(
  walkable: Walkable,
  from: Vec2,
  target: Vec2,
): { path: Vec2[]; reachable: boolean; alreadyAdjacent: boolean } {
  const fx = Math.round(from.x);
  const fy = Math.round(from.y);

  // Already next to it (including diagonally)?
  if (Math.abs(fx - target.x) <= 1 && Math.abs(fy - target.y) <= 1) {
    return { path: [], reachable: true, alreadyAdjacent: true };
  }

  let best: Vec2[] | null = null;
  for (const n of NEIGHBOURS) {
    const ax = target.x + n.dx;
    const ay = target.y + n.dy;
    if (!walkable(ax, ay)) continue;
    const path = findPath(walkable, from, { x: ax, y: ay });
    if (path.length === 0) continue;
    if (best === null || path.length < best.length) best = path;
  }

  if (best === null) return { path: [], reachable: false, alreadyAdjacent: false };
  return { path: best, reachable: true, alreadyAdjacent: false };
}

/**
 * Path toward `target` but stop as soon as the player is within `reach` tiles
 * (Chebyshev) of it — how an archer closes only to bow-shot, not melee. Reuses
 * the route to an adjacent tile and truncates it at the first waypoint in range,
 * so the player walks the minimum needed to loose an arrow.
 */
export function pathToWithin(
  walkable: Walkable,
  from: Vec2,
  target: Vec2,
  reach: number,
): { path: Vec2[]; reachable: boolean; alreadyInRange: boolean } {
  const fx = Math.round(from.x);
  const fy = Math.round(from.y);
  if (Math.max(Math.abs(fx - target.x), Math.abs(fy - target.y)) <= reach) {
    return { path: [], reachable: true, alreadyInRange: true };
  }
  const { path, reachable } = pathToAdjacent(walkable, from, target);
  if (!reachable) return { path: [], reachable: false, alreadyInRange: false };
  // Walk only until the first step that brings us within bow-shot.
  for (let i = 0; i < path.length; i++) {
    const p = path[i]!;
    if (Math.max(Math.abs(p.x - target.x), Math.abs(p.y - target.y)) <= reach) {
      return { path: path.slice(0, i + 1), reachable: true, alreadyInRange: false };
    }
  }
  return { path, reachable: true, alreadyInRange: false };
}
