"use client";

import { useEffect, useMemo, useState } from "react";
import type { Graph, GraphNode, Route, SkillGraphState } from "@skillgraph/graph-core";

type Detail = { id: string; slug: string; short_description: string; self_assessment: string; time_to_learn: string; safety_note: string | null; description: string; examples: string[]; builds_on: { id: string; strength: number; note?: string }[] };
export function DetailPanel({ node, graph, engine, onClose, onChoose, onClaim, onClaimCascade, onInProgress, onRoute }: {
  node: GraphNode; graph: Graph; engine: SkillGraphState; onClose: () => void; onChoose: (id: string) => void;
  onClaim: () => void; onClaimCascade: () => void; onInProgress: () => void; onRoute: (route: Route | null) => void;
}) {
  const [detail, setDetail] = useState<Detail | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [routeMode, setRouteMode] = useState<"count" | "maxDifficulty" | null>(null);
  const state = engine.stateOf(node.id);
  const cascade = useMemo(() => engine.cascadeFor(node.id).filter((id) => engine.stateOf(id) !== "COMPLETED"), [engine, node.id]);
  const routes = useMemo(() => ({ count: engine.routeFor(node.id, "count"), maxDifficulty: engine.routeFor(node.id, "maxDifficulty") }), [engine, node.id]);
  const downstream = (engine.dependentsOf.get(node.id) ?? []).slice(0, 8);
  const domain = graph.domains.find((item) => item.id === node.domain)!;
  const softEdges = detail?.builds_on ?? node.builds_on ?? [];
  useEffect(() => {
    let active = true; setDetail(null); setConfirming(false); setRouteMode(null); onRoute(null);
    fetch(`/data/detail/${node.id}.json`).then((response) => response.json()).then((value: Detail) => { if (active) setDetail(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [node.id, onRoute]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => { if (event.code === "Space" && !["INPUT", "BUTTON", "TEXTAREA"].includes((event.target as HTMLElement).tagName)) { event.preventDefault(); onClaim(); } };
    window.addEventListener("keydown", key); return () => window.removeEventListener("keydown", key);
  }, [onClaim]);

  const toggleRoute = (mode: "count" | "maxDifficulty") => {
    const next = routeMode === mode ? null : mode; setRouteMode(next); onRoute(next ? routes[next] : null);
  };
  return (
    <aside className="detail-panel" aria-label={`${node.name} details`}>
      <button className="panel-close" onClick={onClose} aria-label="Close details">×</button>
      <div className="detail-topline"><span className="domain-pill" style={{ color: domain.color, borderColor: `${domain.color}66`, background: `${domain.color}18` }}>{domain.name}</span><span>L{node.difficulty}</span><span>{detail?.time_to_learn ?? "…"}</span><span className={`state-badge state-${state.toLowerCase()}`}>{state.replace("_", " ")}</span></div>
      <h2>{node.name}</h2>
      <p className="assessment">“{detail?.self_assessment ?? "Loading the assessment…"}”</p>
      {detail?.safety_note && <div className="safety-note"><span>Safety first</span><p>{detail.safety_note}</p></div>}

      {confirming ? <div className="cascade-confirm">
        <strong>This also marks {cascade.length - 1} earlier skill{cascade.length - 1 === 1 ? "" : "s"}.</strong>
        <p>The map assumes you already have the least-cost prerequisite route.</p>
        <div><button className="primary-button" onClick={() => { onClaimCascade(); setConfirming(false); }}>Mark all {cascade.length}</button><button onClick={() => { onClaim(); setConfirming(false); }}>Just this one</button></div>
      </div> : <div className="claim-actions">
        <button className={`claim-button ${state === "COMPLETED" ? "claimed" : ""}`} onClick={() => state !== "COMPLETED" && cascade.length > 1 ? setConfirming(true) : onClaim()}>
          <span>{state === "COMPLETED" ? "✓" : "+"}</span>{state === "COMPLETED" ? "I can do this" : "I can do this"}
        </button>
        <button className="progress-button" onClick={onInProgress}>{state === "IN_PROGRESS" ? "Remove in progress" : "Mark in progress"}</button>
      </div>}

      <section className="detail-section"><h3>What this means</h3><p>{detail?.description ?? "Loading the complete skill definition…"}</p>{detail?.examples?.length ? <ul>{detail.examples.map((example) => <li key={example}>{example}</li>)}</ul> : null}</section>

      {node.unlock_rules.length > 0 && <section className="detail-section"><h3>Ways into this skill</h3>{node.unlock_rules.map((group, index) => <div className="route-group" key={`${group.label}-${index}`}><span>{group.label}</span><div>{group.all.map((id) => <button key={id} onClick={() => onChoose(id)} className={`prereq-chip ${engine.stateOf(id).toLowerCase()}`}>{engine.stateOf(id) === "COMPLETED" ? "✓ " : ""}{engine.nodes.get(id)?.name ?? id}</button>)}{group.any_of && <em>Any {group.any_of.n} of:</em>}{group.any_of?.of.map((id) => <button key={id} onClick={() => onChoose(id)} className={`prereq-chip ${engine.stateOf(id).toLowerCase()}`}>{engine.nodes.get(id)?.name ?? id}</button>)}</div></div>)}</section>}

      {softEdges.length > 0 && <section className="detail-section soft-section"><h3>Helps with this, but not required</h3>{softEdges.slice(0, 5).map((edge) => <button key={edge.id} onClick={() => onChoose(edge.id)} title={edge.note}><span>{engine.nodes.get(edge.id)?.name ?? edge.id}</span><small>{Math.round(edge.strength * 100)}% affinity</small></button>)}</section>}

      {downstream.length > 0 && <section className="detail-section"><h3>What this unlocks</h3><div className="unlock-list">{downstream.map((id) => <button key={id} onClick={() => onChoose(id)}>{engine.nodes.get(id)?.name ?? id}<span>→</span></button>)}</div></section>}

      {state === "LOCKED" && <section className="route-planner"><span className="eyebrow">Route planner</span><h3>Show me how to get here</h3><button className={routeMode === "count" ? "selected" : ""} onClick={() => toggleRoute("count")}><span>Short &amp; direct</span><small>{routes.count.count} skills · max L{routes.count.maxDifficulty}</small></button><button className={routeMode === "maxDifficulty" ? "selected" : ""} onClick={() => toggleRoute("maxDifficulty")}><span>Long &amp; gradual</span><small>{routes.maxDifficulty.count} skills · max L{routes.maxDifficulty.maxDifficulty}</small></button></section>}
      {detail?.slug && <a className="deep-link" href={`/s/${detail.slug}`}>Open the full skill page ↗</a>}
    </aside>
  );
}
