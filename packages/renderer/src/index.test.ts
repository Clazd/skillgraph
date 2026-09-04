import { describe, expect, it } from "vitest";
import { Quadtree, screenToWorld, worldToScreen } from "./index.js";

describe("renderer primitives", () => {
  it("queries and hit-tests a static quadtree", () => {
    const tree = new Quadtree<{ id: string; x: number; y: number }>({ minX: 0, minY: 0, maxX: 100, maxY: 100 }, 1);
    tree.insert({ id: "a", x: 10, y: 10 }); tree.insert({ id: "b", x: 90, y: 90 });
    expect(tree.query({ minX: 0, minY: 0, maxX: 20, maxY: 20 }).map((node) => node.id)).toEqual(["a"]);
    expect(tree.nearest(12, 11, 5)?.id).toBe("a");
  });
  it("round-trips camera transforms", () => {
    const camera = { x: 100, y: -20, zoom: 1.5 }; const viewport = { width: 800, height: 600 };
    const screen = worldToScreen({ x: 130, y: 40 }, camera, viewport);
    expect(screenToWorld(screen, camera, viewport)).toEqual({ x: 130, y: 40 });
  });
});
