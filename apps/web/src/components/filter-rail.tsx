"use client";

import type { Graph, SkillState } from "@skillgraph/graph-core";

type Filters = { domains: string[]; difficulty: [number, number]; states: SkillState[]; frontierOnly: boolean; safetyOnly: boolean };
export function FilterRail({ graph, filters, mobileOpen, onClose, onChange }: { graph: Graph; filters: Filters; mobileOpen: boolean; onClose: () => void; onChange: (filters: Partial<Filters>) => void }) {
  const toggleDomain = (id: string) => onChange({ domains: filters.domains.includes(id) ? filters.domains.filter((domain) => domain !== id) : [...filters.domains, id] });
  const toggleState = (state: SkillState) => onChange({ states: filters.states.includes(state) ? filters.states.filter((item) => item !== state) : [...filters.states, state] });
  return (
    <aside className={`filter-rail ${mobileOpen ? "is-open" : ""}`} aria-label="Map filters">
      <div className="rail-heading"><div><span className="eyebrow">Map layers</span><h2>Territory</h2></div><button className="mobile-close" onClick={onClose}>×</button></div>
      <div className="domain-list">
        {graph.domains.map((domain) => <label key={domain.id} className={filters.domains.length === 0 || filters.domains.includes(domain.id) ? "active" : ""}>
          <input type="checkbox" checked={filters.domains.includes(domain.id)} onChange={() => toggleDomain(domain.id)} />
          <span className="domain-swatch" style={{ background: domain.color }} /><span>{domain.name}</span><small>{graph.nodes.filter((node) => node.domain === domain.id).length}</small>
        </label>)}
      </div>
      <div className="filter-section"><span className="filter-label">Difficulty · L0—L{filters.difficulty[1]}</span><input type="range" min="0" max="7" value={filters.difficulty[1]} onChange={(event) => onChange({ difficulty: [0, Number(event.target.value)] })} /></div>
      <div className="filter-section"><span className="filter-label">State</span><div className="chip-grid">{(["COMPLETED", "AVAILABLE", "LOCKED", "IN_PROGRESS"] as SkillState[]).map((state) => <button key={state} className={filters.states.includes(state) ? "selected" : ""} onClick={() => toggleState(state)}>{state.replace("_", " ").toLowerCase()}</button>)}</div></div>
      <label className="switch-row"><input type="checkbox" checked={filters.frontierOnly} onChange={(event) => onChange({ frontierOnly: event.target.checked })} /><span>Frontier only</span></label>
      <label className="switch-row"><input type="checkbox" checked={filters.safetyOnly} onChange={(event) => onChange({ safetyOnly: event.target.checked })} /><span>Has safety note</span></label>
      <button className="reset-filters" onClick={() => onChange({ domains: [], difficulty: [0, 7], states: [], frontierOnly: false, safetyOnly: false })}>Reset all filters</button>
    </aside>
  );
}
