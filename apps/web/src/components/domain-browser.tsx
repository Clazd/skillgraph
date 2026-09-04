"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createGraphState, type Graph } from "@skillgraph/graph-core";
import { useSkillStore } from "@/lib/store";

export function DomainBrowser({ graph, initialDomain }: { graph: Graph; initialDomain?: string }) {
  const [query, setQuery] = useState(""); const [domain, setDomain] = useState(initialDomain ?? "all");
  const { claims, hydrate, hydrated, setClaims, focus } = useSkillStore();
  useEffect(() => hydrate(), [hydrate]);
  const engine = useMemo(() => createGraphState(graph, claims), [claims, graph]);
  const nodes = useMemo(() => graph.nodes.filter((node) => (domain === "all" || node.domain === domain) && `${node.name} ${node.self_assessment}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.difficulty - b.difficulty || a.name.localeCompare(b.name)), [domain, graph.nodes, query]);
  const toggle = (id: string) => { if (!hydrated) return; const next = createGraphState(graph, claims); if (next.stateOf(id) === "COMPLETED") next.uncomplete(id); else next.complete(id); setClaims({ ...next.claims }); };
  return <div className="domain-browser" data-hydrated={hydrated}>
    <aside><label htmlFor="domain-search">Find a skill</label><input id="domain-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Type a capability…" /><div className="list-domains"><button className={domain === "all" ? "selected" : ""} onClick={() => setDomain("all")}><span>All domains</span><small>1,000</small></button>{graph.domains.map((item) => <button key={item.id} className={domain === item.id ? "selected" : ""} onClick={() => setDomain(item.id)}><i style={{ background: item.color }} /><span>{item.name}</span><small>{graph.nodes.filter((node) => node.domain === item.id).length}</small></button>)}</div></aside>
    <section><div className="browser-heading"><div><span className="eyebrow">Accessible list view</span><h2>{domain === "all" ? "All skills" : graph.domains.find((item) => item.id === domain)?.name}</h2></div><strong>{nodes.length} capabilities</strong></div><div className="skill-table" role="list">{nodes.map((node) => <article key={node.id} role="listitem"><button className={`list-claim ${engine.stateOf(node.id).toLowerCase()}`} onClick={() => toggle(node.id)} aria-label={`${engine.stateOf(node.id) === "COMPLETED" ? "Unmark" : "Mark"} ${node.name}`}>{engine.stateOf(node.id) === "COMPLETED" ? "✓" : "+"}</button><div><Link href={`/s/${node.slug}`}>{node.name}</Link><p>{node.self_assessment}</p><span style={{ color: graph.domains.find((item) => item.id === node.domain)?.color }}>{node.domain}</span><small>L{node.difficulty} · {node.time_to_learn} · {engine.stateOf(node.id).replace("_", " ").toLowerCase()}</small></div><Link href="/" onClick={() => focus(node.id)} className="map-link">Map ↗</Link></article>)}</div></section>
  </div>;
}
