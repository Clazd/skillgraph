"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { createGraphState, type Graph } from "@skillgraph/graph-core";
import { STORAGE_KEY, useSkillStore } from "@/lib/store";

export function MyMap({ graph }: { graph: Graph }) {
  const { claims, hydrate, importClaims, setClaims } = useSkillStore(); const fileRef = useRef<HTMLInputElement>(null); const [message, setMessage] = useState("");
  useEffect(() => hydrate(), [hydrate]); const engine = useMemo(() => createGraphState(graph, claims), [claims, graph]);
  const completed = Object.entries(claims).filter(([, claim]) => claim.state === "completed");
  const frontier = graph.nodes.filter((node) => engine.stateOf(node.id) === "AVAILABLE").slice(0, 12);
  const inconsistencies = engine.inconsistencies();
  const exportData = () => { const blob = new Blob([JSON.stringify({ datasetVersion: "1.0.0", claims }, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = "skillgraph-claims.json"; link.click(); URL.revokeObjectURL(url); };
  return <div className="me-dashboard">
    <section className="me-hero"><span className="eyebrow">Your capability atlas</span><h1>{completed.length === 0 ? "Your map is waiting." : `${completed.length} skills mapped.`}</h1><p>{completed.length === 0 ? "Start anywhere. SkillGraph never makes you prove a path before claiming what you can already do." : `${frontier.length} nearby skills are visible on your current frontier.`}</p><Link href="/" className="primary-button">Explore the map</Link></section>
    <section className="metric-grid"><article><span>{completed.length}</span><p>Completed</p><small>{Math.round(completed.length / 10)}% of the map</small></article><article><span>{frontier.length}</span><p>Visible frontier</p><small>Available, not claimed</small></article><article><span>{graph.domains.filter((domain) => graph.nodes.some((node) => node.domain === domain.id && claims[node.id]?.state === "completed")).length}</span><p>Domains entered</p><small>Across 12 regions</small></article><article className={inconsistencies.length ? "warning" : ""}><span>{inconsistencies.length}</span><p>Inconsistencies</p><small>Claims kept after path changes</small></article></section>
    <div className="dashboard-grid"><section className="coverage-card"><div className="section-heading"><div><span className="eyebrow">Coverage</span><h2>By domain</h2></div><span>{completed.length}/1,000</span></div>{graph.domains.map((domain) => { const total = graph.nodes.filter((node) => node.domain === domain.id).length; const done = graph.nodes.filter((node) => node.domain === domain.id && claims[node.id]?.state === "completed").length; return <div className="coverage-row" key={domain.id}><span>{domain.name}</span><div><i style={{ width: `${done / total * 100}%`, background: domain.color }} /></div><small>{done}/{total}</small></div>; })}</section>
      <section className="frontier-card"><div className="section-heading"><div><span className="eyebrow">What’s nearby</span><h2>Your frontier</h2></div></div>{frontier.length ? frontier.map((node) => <Link href={`/s/${node.slug}`} key={node.id}><i style={{ background: graph.domains.find((domain) => domain.id === node.domain)?.color }} /><span>{node.name}<small>{node.domain} · L{node.difficulty}</small></span><b>→</b></Link>) : <p className="empty-state">Claim a few roots on the map to reveal your frontier.</p>}</section>
    </div>
    {inconsistencies.length > 0 && <section className="inconsistency-card"><span className="eyebrow">Needs a look</span><h2>Claims with a broken prerequisite path</h2><p>We kept these claims because your self-report outranks the graph. You can leave them as-is or reopen the relevant prerequisite.</p>{inconsistencies.map((id) => <Link key={id} href={`/s/${engine.nodes.get(id)?.slug}`}>{engine.nodes.get(id)?.name}</Link>)}</section>}
    <section className="data-card"><div><span className="eyebrow">Portable by design</span><h2>Your data stays yours</h2><p>Claims live only in this browser under <code>{STORAGE_KEY}</code>. Export a backup or import one from another device.</p></div><div><button onClick={exportData}>Export JSON</button><button onClick={() => fileRef.current?.click()}>Import JSON</button><input ref={fileRef} hidden type="file" accept="application/json" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; const result = importClaims(await file.text()); setMessage(result.message); }} /><button className="danger-link" onClick={() => { setClaims({}); setMessage("Local claims cleared."); }}>Clear claims</button></div>{message && <p role="status">{message}</p>}</section>
  </div>;
}
