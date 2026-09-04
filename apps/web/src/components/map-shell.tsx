"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createGraphState, type Claims, type Graph, type Route } from "@skillgraph/graph-core";
import { DetailPanel } from "./detail-panel";
import { FilterRail } from "./filter-rail";
import { MapCanvas } from "./map-canvas";
import { SearchOverlay } from "./search-overlay";
import { WebMcpTools } from "./webmcp-tools";
import { useSkillStore } from "@/lib/store";

export function MapShell() {
  const [graph, setGraph] = useState<Graph | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [toast, setToast] = useState<{ message: string; undo?: Claims } | null>(null);
  const { claims, selectedId, searchOpen, filtersOpen, filters, focusRequest, hydrate, setClaims, select, openSearch, openFilters, setFilters, focus } = useSkillStore();

  useEffect(() => { hydrate(); fetch("/data/graph.v1.json").then((response) => response.json()).then(setGraph); }, [hydrate]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); openSearch(true); }
      if (event.key === "Escape") { openSearch(false); openFilters(false); select(null); setRoute(null); }
    };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [openFilters, openSearch, select]);
  useEffect(() => { if (!toast) return; const timeout = setTimeout(() => setToast(null), 5600); return () => clearTimeout(timeout); }, [toast]);

  const engine = useMemo(() => graph ? createGraphState(graph, claims) : null, [claims, graph]);
  const selected = selectedId && engine ? engine.nodes.get(selectedId) ?? null : null;
  const completedCount = Object.values(claims).filter((claim) => claim.state === "completed").length;
  const availableCount = graph && engine ? graph.nodes.filter((node) => engine.stateOf(node.id) === "AVAILABLE").length : 0;

  const updateClaim = useCallback(() => {
    if (!engine || !selectedId) return;
    const before = { ...claims }; const nextEngine = createGraphState(graph!, claims);
    if (nextEngine.stateOf(selectedId) === "COMPLETED") nextEngine.uncomplete(selectedId); else nextEngine.complete(selectedId, "manual");
    setClaims({ ...nextEngine.claims }); setToast({ message: nextEngine.stateOf(selectedId) === "COMPLETED" ? "Skill added to your map." : "Skill removed. Descendants were kept.", undo: before });
  }, [claims, engine, graph, selectedId, setClaims]);
  const markCascade = useCallback(() => {
    if (!engine || !selectedId) return;
    const before = { ...claims }; const nextEngine = createGraphState(graph!, claims); const ids = nextEngine.cascadeFor(selectedId);
    ids.forEach((id) => nextEngine.complete(id, id === selectedId ? "manual" : "cascade"));
    setClaims({ ...nextEngine.claims }); setToast({ message: `Mapped ${ids.length} connected skills.`, undo: before });
  }, [claims, engine, graph, selectedId, setClaims]);
  const markProgress = useCallback(() => {
    if (!engine || !selectedId) return; const before = { ...claims }; const nextEngine = createGraphState(graph!, claims);
    if (nextEngine.stateOf(selectedId) === "IN_PROGRESS") nextEngine.uncomplete(selectedId); else nextEngine.markInProgress(selectedId);
    setClaims({ ...nextEngine.claims }); setToast({ message: nextEngine.stateOf(selectedId) === "IN_PROGRESS" ? "Marked in progress." : "Progress marker removed.", undo: before });
  }, [claims, engine, graph, selectedId, setClaims]);

  if (!graph || !engine) return <main id="main-content" className="map-loading"><div className="brand-mark">SG</div><h1>Drawing your capability map…</h1><p>Placing 1,000 stable coordinates.</p></main>;

  return (
    <main id="main-content" className="map-page">
      <header className="map-header">
        <Link href="/" className="brand"><span className="brand-mark">SG</span><span><strong>SkillGraph</strong><small>Map what you can do</small></span></Link>
        <nav aria-label="Primary"><Link className="active" href="/">Explore</Link><Link href="/me">My map</Link><Link href="/domains">Domains</Link></nav>
        <button className="search-trigger" onClick={() => openSearch(true)}><span>⌕</span><span>Search skills</span><kbd>⌘ K</kbd></button>
        <div className="header-progress"><span>{completedCount}</span><small>mapped</small><div><i style={{ width: `${completedCount / 10}%` }} /></div></div>
        <button className="mobile-filter-button" onClick={() => openFilters(true)}>Filters</button>
      </header>
      <div className="map-layout">
        <FilterRail graph={graph} filters={filters} mobileOpen={filtersOpen} onClose={() => openFilters(false)} onChange={setFilters} />
        <section className="map-workspace">
          <MapCanvas graph={graph} engine={engine} selectedId={selectedId} filters={filters} routeIds={route?.ids ?? []} focusRequest={focusRequest} onSelect={(id) => { select(id); if (!id) setRoute(null); }} />
          <div className="map-status"><span><i className="status-completed" />{completedCount} completed</span><span><i className="status-available" />{availableCount} on your frontier</span><span><i className="status-locked" />{1000 - completedCount - availableCount} beyond</span></div>
        </section>
        {selected && <DetailPanel node={selected} graph={graph} engine={engine} onClose={() => { select(null); setRoute(null); }} onChoose={(id) => focus(id)} onClaim={updateClaim} onClaimCascade={markCascade} onInProgress={markProgress} onRoute={setRoute} />}
      </div>
      <SearchOverlay graph={graph} engine={engine} open={searchOpen} onClose={() => openSearch(false)} onChoose={focus} />
      <WebMcpTools graph={graph} />
      {toast && <div className="toast" role="status"><span>{toast.message}</span>{toast.undo && <button onClick={() => { setClaims(toast.undo!); setToast(null); }}>Undo</button>}</div>}
    </main>
  );
}
