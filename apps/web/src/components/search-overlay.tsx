"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Graph, SkillGraphState } from "@skillgraph/graph-core";

export function SearchOverlay({ graph, engine, open, onClose, onChoose }: { graph: Graph; engine: SkillGraphState; open: boolean; onClose: () => void; onChoose: (id: string) => void }) {
  const [query, setQuery] = useState(""); const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (open) { setQuery(""); requestAnimationFrame(() => inputRef.current?.focus()); } }, [open]);
  const results = useMemo(() => {
    const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return graph.nodes.slice(0, 8);
    return graph.nodes.map((node) => {
      const haystack = `${node.name} ${(node.tags ?? []).join(" ")} ${node.self_assessment ?? ""}`.toLowerCase();
      const score = terms.reduce((sum, term) => sum + (node.name.toLowerCase().startsWith(term) ? 4 : haystack.includes(term) ? 1 : -10), 0);
      return { node, score };
    }).filter((item) => item.score >= terms.length).sort((a, b) => b.score - a.score || a.node.name.localeCompare(b.node.name)).slice(0, 10).map((item) => item.node);
  }, [graph.nodes, query]);
  if (!open) return null;
  return (
    <div className="overlay-backdrop" onMouseDown={onClose}>
      <section className="search-dialog" role="dialog" aria-modal="true" aria-label="Search skills" onMouseDown={(event) => event.stopPropagation()}>
        <div className="search-input-row"><span>⌕</span><input ref={inputRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search 1,000 skills…" onKeyDown={(event) => { if (event.key === "Escape") onClose(); if (event.key === "Enter" && results[0]) onChoose(results[0].id); }} /><kbd>ESC</kbd></div>
        <div className="search-results">
          {results.map((node) => <button key={node.id} onClick={() => onChoose(node.id)}>
            <span className="result-dot" style={{ background: graph.domains.find((domain) => domain.id === node.domain)?.color }} />
            <span><strong>{node.name}</strong><small>{node.domain} · L{node.difficulty} · {engine.stateOf(node.id).toLowerCase()}</small></span><span>↗</span>
          </button>)}
          {results.length === 0 && <p className="empty-state">No matching territory. Try a shorter phrase.</p>}
        </div>
        <p className="search-footnote">Press Enter to fly to the first result</p>
      </section>
    </div>
  );
}
