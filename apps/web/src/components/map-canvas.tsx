"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Graph, GraphNode, SkillGraphState, SkillState } from "@skillgraph/graph-core";
import { Quadtree, clampZoom, screenToWorld, worldToScreen, type Camera } from "@skillgraph/renderer";

type Filters = { domains: string[]; difficulty: [number, number]; states: SkillState[]; frontierOnly: boolean; safetyOnly: boolean };
type Props = {
  graph: Graph; engine: SkillGraphState; selectedId: string | null; filters: Filters;
  routeIds: string[]; focusRequest: { id: string; token: number } | null;
  onSelect: (id: string | null) => void;
};

const NODE_W = 132;
const NODE_H = 38;

export function MapCanvas({ graph, engine, selectedId, filters, routeIds, focusRequest, onSelect }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sizeRef = useRef({ width: 1, height: 1 });
  const cameraRef = useRef<Camera>({ x: 0, y: 0, zoom: 0.25 });
  const dragRef = useRef<{ x: number; y: number; cameraX: number; cameraY: number; moved: boolean } | null>(null);
  const animationRef = useRef<number | null>(null);
  const nodeById = useMemo(() => new Map(graph.nodes.map((node) => [node.id, node])), [graph]);
  const domainById = useMemo(() => new Map(graph.domains.map((domain) => [domain.id, domain])), [graph]);
  const bounds = useMemo(() => ({
    minX: graph.bbox?.min_x ?? Math.min(...graph.nodes.map((node) => node.x)),
    minY: graph.bbox?.min_y ?? Math.min(...graph.nodes.map((node) => node.y)),
    maxX: graph.bbox?.max_x ?? Math.max(...graph.nodes.map((node) => node.x)),
    maxY: graph.bbox?.max_y ?? Math.max(...graph.nodes.map((node) => node.y)),
  }), [graph]);
  const index = useMemo(() => {
    const tree = new Quadtree<GraphNode>(bounds, 18);
    graph.nodes.forEach((node) => tree.insert(node));
    return tree;
  }, [bounds, graph.nodes]);
  const domainExtents = useMemo(() => graph.domains.map((domain) => {
    const nodes = graph.nodes.filter((node) => node.domain === domain.id);
    return {
      domain,
      minX: Math.min(...nodes.map((node) => node.x)) - 90,
      maxX: Math.max(...nodes.map((node) => node.x)) + 90,
      minY: Math.min(...nodes.map((node) => node.y)) - 70,
      maxY: Math.max(...nodes.map((node) => node.y)) + 70,
      x: nodes.reduce((sum, node) => sum + node.x, 0) / nodes.length,
      y: nodes.reduce((sum, node) => sum + node.y, 0) / nodes.length,
    };
  }), [graph]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { width, height } = sizeRef.current;
    const camera = cameraRef.current;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const viewport = {
      minX: camera.x - width / (2 * camera.zoom) - NODE_W,
      maxX: camera.x + width / (2 * camera.zoom) + NODE_W,
      minY: camera.y - height / (2 * camera.zoom) - NODE_H,
      maxY: camera.y + height / (2 * camera.zoom) + NODE_H,
    };
    const visible = index.query(viewport);
    const visibleIds = new Set(visible.map((node) => node.id));
    const ancestors = selectedId ? engine.ancestors(selectedId) : new Set<string>();
    const descendants = selectedId ? engine.descendants(selectedId) : new Set<string>();
    const routeSet = new Set(routeIds);

    const matches = (node: GraphNode) => {
      const state = engine.stateOf(node.id);
      return (filters.domains.length === 0 || filters.domains.includes(node.domain))
        && node.difficulty >= filters.difficulty[0] && node.difficulty <= filters.difficulty[1]
        && (filters.states.length === 0 || filters.states.includes(state))
        && (!filters.frontierOnly || state === "AVAILABLE")
        && (!filters.safetyOnly || Boolean(node.safety_note || (node as GraphNode & { has_safety_note?: boolean }).has_safety_note));
    };
    const alphaFor = (node: GraphNode) => {
      if (!matches(node)) return 0.05;
      if (!selectedId) return 1;
      if (node.id === selectedId || ancestors.has(node.id) || descendants.has(node.id) || routeSet.has(node.id)) return 1;
      return 0.08;
    };

    // Region layer.
    for (const region of domainExtents) {
      const start = worldToScreen({ x: region.minX, y: region.minY }, camera, { width, height });
      const end = worldToScreen({ x: region.maxX, y: region.maxY }, camera, { width, height });
      ctx.save();
      ctx.globalAlpha = 0.1;
      ctx.fillStyle = region.domain.color;
      ctx.beginPath();
      ctx.roundRect(start.x, start.y, end.x - start.x, end.y - start.y, Math.max(16, 60 * camera.zoom));
      ctx.fill();
      ctx.globalAlpha = 0.26;
      ctx.strokeStyle = region.domain.color;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    }

    if (camera.zoom >= 0.31 || selectedId) {
      // Hard edges.
      ctx.lineWidth = Math.max(0.65, camera.zoom * 0.9);
      for (const target of visible) {
        const targetPoint = worldToScreen(target, camera, { width, height });
        for (const group of target.unlock_rules) for (const sourceId of [...group.all, ...(group.any_of?.of ?? [])]) {
          const source = nodeById.get(sourceId);
          if (!source || (!visibleIds.has(sourceId) && !selectedId)) continue;
          const sourcePoint = worldToScreen(source, camera, { width, height });
          const related = !selectedId || target.id === selectedId || sourceId === selectedId || ancestors.has(sourceId) || descendants.has(target.id);
          ctx.globalAlpha = related ? 0.28 : 0.025;
          ctx.strokeStyle = source.domain === target.domain ? "#7890aa" : "#d79a63";
          ctx.beginPath(); ctx.moveTo(sourcePoint.x, sourcePoint.y); ctx.lineTo(targetPoint.x, targetPoint.y); ctx.stroke();
        }
      }
    }

    if (camera.zoom > 1.15 || selectedId) {
      ctx.setLineDash([2, 5]);
      for (const target of visible) {
        const targetPoint = worldToScreen(target, camera, { width, height });
        for (const edge of target.builds_on ?? []) {
          const source = nodeById.get(edge.id);
          if (!source || (!selectedId && camera.zoom <= 1.15)) continue;
          if (selectedId && target.id !== selectedId && edge.id !== selectedId) continue;
          const sourcePoint = worldToScreen(source, camera, { width, height });
          ctx.globalAlpha = 0.28; ctx.strokeStyle = "#91a6bb"; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(sourcePoint.x, sourcePoint.y); ctx.lineTo(targetPoint.x, targetPoint.y); ctx.stroke();
        }
      }
      ctx.setLineDash([]);
    }

    if (routeIds.length > 1) {
      ctx.strokeStyle = "#f6bd60"; ctx.globalAlpha = 0.88; ctx.lineWidth = 4; ctx.lineCap = "round";
      ctx.beginPath();
      routeIds.forEach((id, indexInRoute) => {
        const node = nodeById.get(id); if (!node) return;
        const point = worldToScreen(node, camera, { width, height });
        if (indexInRoute === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
    }

    // Nodes / cluster dots.
    if (camera.zoom >= 0.15) for (const node of visible) {
      const point = worldToScreen(node, camera, { width, height });
      const domain = domainById.get(node.domain)!;
      const state = engine.stateOf(node.id);
      const alpha = alphaFor(node);
      ctx.save(); ctx.globalAlpha = alpha;
      if (camera.zoom < 0.42) {
        const radius = state === "COMPLETED" ? 4.1 : 2.65;
        ctx.fillStyle = state === "LOCKED" ? "#526174" : domain.color;
        ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, Math.PI * 2); ctx.fill();
      } else {
        const nodeWidth = NODE_W * camera.zoom; const nodeHeight = NODE_H * camera.zoom;
        ctx.fillStyle = state === "COMPLETED" ? domain.color : state === "AVAILABLE" ? `${domain.color}59` : state === "IN_PROGRESS" ? `${domain.color}35` : "#34415166";
        ctx.strokeStyle = node.id === selectedId ? "#ffffff" : state === "LOCKED" ? "#748196" : domain.color;
        ctx.lineWidth = node.id === selectedId ? 3 : 0.8 + node.difficulty * 0.18;
        if (state === "IN_PROGRESS") ctx.setLineDash([6, 4]);
        ctx.beginPath(); ctx.roundRect(point.x - nodeWidth / 2, point.y - nodeHeight / 2, nodeWidth, nodeHeight, Math.min(10, 8 * camera.zoom)); ctx.fill(); ctx.stroke();
        if (camera.zoom > 1.02) {
          ctx.setLineDash([]); ctx.fillStyle = state === "LOCKED" ? "#b0bac8" : "#f8fafc";
          ctx.font = `600 ${Math.min(14, 10.5 * camera.zoom)}px var(--font-sans), sans-serif`;
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          const label = node.name.length > 25 ? `${node.name.slice(0, 24)}…` : node.name;
          ctx.fillText(label, point.x, point.y, nodeWidth - 9);
        }
      }
      ctx.restore();
    }

    // Domain labels stay legible at every LOD.
    for (const region of domainExtents) {
      const point = worldToScreen({ x: region.x, y: region.y }, camera, { width, height });
      ctx.globalAlpha = camera.zoom < 0.5 ? 0.92 : 0.48;
      ctx.fillStyle = region.domain.color; ctx.font = `700 ${camera.zoom < 0.25 ? 13 : 15}px var(--font-display), sans-serif`;
      ctx.textAlign = "center"; ctx.fillText(region.domain.name.toUpperCase(), point.x, point.y);
    }
    ctx.globalAlpha = 1;
  }, [domainById, domainExtents, engine, filters, index, nodeById, routeIds, selectedId]);

  const fit = useCallback(() => {
    const { width, height } = sizeRef.current;
    if (width < 760) {
      const frontier = graph.nodes.filter((node) => engine.stateOf(node.id) === "AVAILABLE");
      cameraRef.current = {
        x: frontier.reduce((sum, node) => sum + node.x, 0) / Math.max(1, frontier.length),
        y: frontier.reduce((sum, node) => sum + node.y, 0) / Math.max(1, frontier.length),
        zoom: 0.19,
      };
      draw();
      return;
    }
    const zoom = Math.min((width - 70) / (bounds.maxX - bounds.minX), (height - 70) / (bounds.maxY - bounds.minY));
    cameraRef.current = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2, zoom: clampZoom(zoom) };
    draw();
  }, [bounds, draw, engine, graph.nodes]);

  const flyTo = useCallback((id: string) => {
    const node = nodeById.get(id); if (!node) return;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    const start = { ...cameraRef.current }; const end = { x: node.x, y: node.y, zoom: 1.45 }; const started = performance.now();
    const frame = (now: number) => {
      const raw = Math.min(1, (now - started) / 420); const t = 1 - (1 - raw) ** 3;
      cameraRef.current = { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t, zoom: start.zoom + (end.zoom - start.zoom) * t };
      draw(); if (raw < 1) animationRef.current = requestAnimationFrame(frame);
    };
    animationRef.current = requestAnimationFrame(frame);
  }, [draw, nodeById]);

  useEffect(() => { if (focusRequest) flyTo(focusRequest.id); }, [focusRequest, flyTo]);
  useEffect(() => { draw(); }, [draw]);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    let first = true;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      const { width, height } = entry.contentRect; const dpr = window.devicePixelRatio || 1;
      sizeRef.current = { width, height }; canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      if (first) { first = false; fit(); } else draw();
    });
    observer.observe(canvas); return () => observer.disconnect();
  }, [draw, fit]);

  const hit = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect();
    const screen = { x: clientX - rect.left, y: clientY - rect.top };
    const world = screenToWorld(screen, cameraRef.current, sizeRef.current);
    return index.nearest(world.x, world.y, Math.max(24, 48 / cameraRef.current.zoom));
  };

  return (
    <div className="map-stage">
      <canvas
        ref={canvasRef} className="map-canvas" role="img"
        aria-label="Interactive map of one thousand skills. Use the accessible domain list for keyboard navigation."
        onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY, cameraX: cameraRef.current.x, cameraY: cameraRef.current.y, moved: false }; }}
        onPointerMove={(event) => {
          const drag = dragRef.current; if (!drag) return;
          const dx = event.clientX - drag.x; const dy = event.clientY - drag.y;
          if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
          cameraRef.current.x = drag.cameraX - dx / cameraRef.current.zoom; cameraRef.current.y = drag.cameraY - dy / cameraRef.current.zoom; draw();
        }}
        onPointerUp={(event) => { const drag = dragRef.current; dragRef.current = null; if (!drag?.moved) onSelect(hit(event.clientX, event.clientY)?.id ?? null); }}
        onDoubleClick={(event) => { const node = hit(event.clientX, event.clientY); if (node) { onSelect(node.id); flyTo(node.id); } }}
        onWheel={(event) => {
          event.preventDefault(); const canvas = canvasRef.current!; const rect = canvas.getBoundingClientRect();
          const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top }; const before = screenToWorld(screen, cameraRef.current, sizeRef.current);
          cameraRef.current.zoom = clampZoom(cameraRef.current.zoom * Math.exp(-event.deltaY * 0.0012));
          const after = screenToWorld(screen, cameraRef.current, sizeRef.current); cameraRef.current.x += before.x - after.x; cameraRef.current.y += before.y - after.y; draw();
        }}
      />
      <div className="map-controls" aria-label="Map controls">
        <button onClick={() => { cameraRef.current.zoom = clampZoom(cameraRef.current.zoom * 1.35); draw(); }} aria-label="Zoom in">+</button>
        <button onClick={() => { cameraRef.current.zoom = clampZoom(cameraRef.current.zoom / 1.35); draw(); }} aria-label="Zoom out">−</button>
        <button onClick={fit} aria-label="Fit whole map">⌂</button>
      </div>
      <div className="map-hint">Drag to explore · Scroll to zoom · Double-click to focus</div>
    </div>
  );
}
