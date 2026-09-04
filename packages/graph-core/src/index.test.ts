import { describe, expect, it } from "vitest";
import { SkillGraphState, type Graph } from "./index.js";

const node = (id: string, difficulty: number, unlock_rules: Graph["nodes"][number]["unlock_rules"] = []): Graph["nodes"][number] => ({
  id, slug: id, name: id, short_description: id, domain: "test", secondary_domains: [], tags: ["test"], difficulty,
  time_to_learn: "hours", self_assessment: `I can ${id} once without help.`, unlock_rules, builds_on: [], safety_note: null, x: 0, y: 0,
});
const graph: Graph = {
  version: "test", domains: [{ id: "test", name: "Test", color: "#fff", description: "Test" }],
  nodes: [
    node("a", 0), node("b", 1, [{ label: "from a", all: ["a"] }]),
    node("c", 2, [{ label: "from b", all: ["b"] }]),
    node("x", 1), node("y", 3),
    node("z", 4, [{ label: "gradual", all: ["a", "b"] }, { label: "steep", all: ["y"] }]),
  ],
};

describe("SkillGraphState", () => {
  it("moves only direct dependents onto the frontier", () => {
    const state = new SkillGraphState(graph);
    expect(state.stateOf("a")).toBe("AVAILABLE");
    expect(state.stateOf("b")).toBe("LOCKED");
    state.complete("a", "manual", "2026-01-01T00:00:00Z");
    expect(state.stateOf("b")).toBe("AVAILABLE");
    expect(state.stateOf("c")).toBe("LOCKED");
  });
  it("never cascade-uncompletes and reports inconsistencies", () => {
    const state = new SkillGraphState(graph);
    state.complete("a"); state.complete("b"); state.complete("c"); state.uncomplete("a");
    expect(state.stateOf("b")).toBe("COMPLETED");
    expect(state.inconsistencies()).toContain("b");
  });
  it("builds an ordered prerequisite cascade", () => {
    expect(new SkillGraphState(graph).cascadeFor("c")).toEqual(["a", "b", "c"]);
  });
  it("offers count and difficulty route policies", () => {
    const state = new SkillGraphState(graph);
    expect(state.routeFor("z", "count").ids).toEqual(["y", "z"]);
    expect(state.routeFor("z", "maxDifficulty").ids).toEqual(["a", "b", "z"]);
  });
  it("indexes transitive ancestors and descendants", () => {
    const state = new SkillGraphState(graph);
    expect([...state.ancestors("c")].sort()).toEqual(["a", "b"]);
    expect([...state.descendants("a")].sort()).toEqual(["b", "c", "z"]);
  });
});
