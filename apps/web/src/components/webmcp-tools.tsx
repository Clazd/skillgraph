"use client";

import { useEffect } from "react";
import { createGraphState, type Graph } from "@skillgraph/graph-core";
import { useSkillStore } from "@/lib/store";

function record(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Input must be an object.");
  return input as Record<string, unknown>;
}

export function WebMcpTools({ graph }: { graph: Graph }) {
  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: Parameters<typeof context.registerTool>[0]) => Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined);
    void register({
      name: "read_skillgraph_summary", title: "Read map summary",
      description: "Read the current completed, in-progress, available, and inconsistent skill counts without changing the map.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        const claims = useSkillStore.getState().claims; const engine = createGraphState(graph, claims);
        return {
          completed: Object.values(claims).filter((claim) => claim.state === "completed").length,
          inProgress: Object.values(claims).filter((claim) => claim.state === "in_progress").length,
          available: graph.nodes.filter((node) => engine.stateOf(node.id) === "AVAILABLE").length,
          inconsistencies: engine.inconsistencies().length,
        };
      },
    });
    void register({
      name: "search_skills", title: "Search skills",
      description: "Find up to ten skills by name, tag, or self-assessment without changing the map.",
      inputSchema: { type: "object", properties: { query: { type: "string", minLength: 1 } }, required: ["query"], additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        const query = record(input).query; if (typeof query !== "string" || !query.trim()) throw new Error("query must be a non-empty string.");
        const claims = useSkillStore.getState().claims; const engine = createGraphState(graph, claims); const term = query.toLowerCase();
        return graph.nodes.filter((node) => `${node.name} ${(node.tags ?? []).join(" ")} ${node.self_assessment ?? ""}`.toLowerCase().includes(term)).slice(0, 10).map((node) => ({ id: node.id, name: node.name, domain: node.domain, difficulty: node.difficulty, state: engine.stateOf(node.id) }));
      },
    });
    void register({
      name: "set_skill_claim", title: "Set a skill claim",
      description: "Complete, mark in progress, or clear one known SkillGraph skill and update the visible map.",
      inputSchema: { type: "object", properties: { skillId: { type: "string" }, state: { type: "string", enum: ["completed", "in_progress", "clear"] } }, required: ["skillId", "state"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        const data = record(input); if (typeof data.skillId !== "string" || !graph.nodes.some((node) => node.id === data.skillId)) throw new Error("skillId must identify a known skill.");
        if (!["completed", "in_progress", "clear"].includes(String(data.state))) throw new Error("state must be completed, in_progress, or clear.");
        const store = useSkillStore.getState(); const engine = createGraphState(graph, store.claims);
        if (data.state === "completed") engine.complete(data.skillId, "manual"); else if (data.state === "in_progress") engine.markInProgress(data.skillId); else engine.uncomplete(data.skillId);
        store.setClaims({ ...engine.claims }); store.select(data.skillId);
        return { skillId: data.skillId, state: engine.stateOf(data.skillId), completedCount: Object.values(engine.claims).filter((claim) => claim.state === "completed").length };
      },
    });
    return () => lifecycle.abort();
  }, [graph]);
  return null;
}
