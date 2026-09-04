export type PointNode = { id: string; x: number; y: number };
export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export class Quadtree<T extends PointNode> {
  private readonly items: T[] = [];
  constructor(readonly bounds: Bounds, readonly capacity = 16, private readonly depth = 0) {}
  private children: Quadtree<T>[] | null = null;

  insert(item: T): boolean {
    if (!this.contains(item.x, item.y)) return false;
    if (!this.children && (this.items.length < this.capacity || this.depth >= 12)) { this.items.push(item); return true; }
    if (!this.children) this.split();
    return this.children!.some((child) => child.insert(item));
  }

  query(range: Bounds, found: T[] = []): T[] {
    if (!this.intersects(range)) return found;
    for (const item of this.items) if (item.x >= range.minX && item.x <= range.maxX && item.y >= range.minY && item.y <= range.maxY) found.push(item);
    this.children?.forEach((child) => child.query(range, found));
    return found;
  }

  nearest(x: number, y: number, radius: number): T | null {
    let best: T | null = null; let bestDistance = radius * radius;
    for (const item of this.query({ minX: x - radius, minY: y - radius, maxX: x + radius, maxY: y + radius })) {
      const distance = (item.x - x) ** 2 + (item.y - y) ** 2;
      if (distance <= bestDistance) { best = item; bestDistance = distance; }
    }
    return best;
  }

  private contains(x: number, y: number): boolean { return x >= this.bounds.minX && x <= this.bounds.maxX && y >= this.bounds.minY && y <= this.bounds.maxY; }
  private intersects(range: Bounds): boolean { return !(range.minX > this.bounds.maxX || range.maxX < this.bounds.minX || range.minY > this.bounds.maxY || range.maxY < this.bounds.minY); }
  private split(): void {
    const { minX, minY, maxX, maxY } = this.bounds; const midX = (minX + maxX) / 2; const midY = (minY + maxY) / 2;
    this.children = [
      new Quadtree({ minX, minY, maxX: midX, maxY: midY }, this.capacity, this.depth + 1),
      new Quadtree({ minX: midX, minY, maxX, maxY: midY }, this.capacity, this.depth + 1),
      new Quadtree({ minX, minY: midY, maxX: midX, maxY }, this.capacity, this.depth + 1),
      new Quadtree({ minX: midX, minY: midY, maxX, maxY }, this.capacity, this.depth + 1),
    ];
    for (const item of this.items.splice(0)) this.children.some((child) => child.insert(item));
  }
}

export type Camera = { x: number; y: number; zoom: number };
export const clampZoom = (zoom: number): number => Math.min(4, Math.max(0.05, zoom));
export function worldToScreen(point: { x: number; y: number }, camera: Camera, viewport: { width: number; height: number }) {
  return { x: (point.x - camera.x) * camera.zoom + viewport.width / 2, y: (point.y - camera.y) * camera.zoom + viewport.height / 2 };
}
export function screenToWorld(point: { x: number; y: number }, camera: Camera, viewport: { width: number; height: number }) {
  return { x: (point.x - viewport.width / 2) / camera.zoom + camera.x, y: (point.y - viewport.height / 2) / camera.zoom + camera.y };
}
