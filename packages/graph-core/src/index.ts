export type SkillState = "LOCKED" | "AVAILABLE" | "COMPLETED" | "IN_PROGRESS";
export type ClaimState = "completed" | "in_progress";
export type ClaimSource = "manual" | "cascade" | "import";
export type Claim = { state: ClaimState; source: ClaimSource; at: string };
export type Claims = Record<string, Claim>;
export type UnlockGroup = { label: string; all: string[]; any_of?: { n: number; of: string[] } };
export type BuildOn = { id: string; strength: number; note?: string };

export type GraphNode = {
  id: string; slug: string; name: string; short_description: string; domain: string;
  secondary_domains: string[]; tags: string[]; difficulty: number; time_to_learn: string;
  self_assessment: string; unlock_rules: UnlockGroup[]; builds_on: BuildOn[];
  safety_note: string | null; x: number; y: number;
};
export type Domain = { id: string; name: string; color: string; description: string };
export type Graph = { version: string; domains: Domain[]; nodes: GraphNode[]; bbox?: { min_x: number; min_y: number; max_x: number; max_y: number } };
export type RouteMode = "count" | "maxDifficulty";
export type Route = { mode: RouteMode; ids: string[]; count: number; maxDifficulty: number };

type IndexedGroup = UnlockGroup & { owner: string; sources: string[] };

export class SkillGraphState {
  readonly nodes = new Map<string, GraphNode>();
  readonly dependentsOf = new Map<string, string[]>();
  readonly ancestorsOf = new Map<string, string[]>();
  readonly claims: Claims;
  private readonly groups: IndexedGroup[] = [];
  private readonly groupsOf = new Map<string, number[]>();
  private readonly dependentGroupsOf = new Map<string, number[]>();
  private readonly groupOpen: boolean[] = [];
  private readonly openGroups = new Map<string, number>();

  constructor(graph: Graph, claims: Claims = {}) {
    this.claims = { ...claims };
    for (const node of graph.nodes) {
      this.nodes.set(node.id, node);
      this.groupsOf.set(node.id, []);
      this.dependentGroupsOf.set(node.id, []);
      this.dependentsOf.set(node.id, []);
      this.ancestorsOf.set(node.id, []);
      this.openGroups.set(node.id, 0);
    }
    for (const node of graph.nodes) {
      for (const group of node.unlock_rules) {
        const sources = [...new Set([...group.all, ...(group.any_of?.of ?? [])])];
        const groupIndex = this.groups.length;
        this.groups.push({ ...group, owner: node.id, sources });
        this.groupsOf.get(node.id)?.push(groupIndex);
        for (const source of sources) {
          this.dependentGroupsOf.get(source)?.push(groupIndex);
          const dependents = this.dependentsOf.get(source);
          if (dependents && !dependents.includes(node.id)) dependents.push(node.id);
          const ancestors = this.ancestorsOf.get(node.id);
          if (ancestors && !ancestors.includes(source)) ancestors.push(source);
        }
      }
    }
    this.groups.forEach((group, index) => {
      const open = this.isGroupSatisfied(group);
      this.groupOpen[index] = open;
      if (open) this.openGroups.set(group.owner, (this.openGroups.get(group.owner) ?? 0) + 1);
    });
  }

  stateOf(id: string): SkillState {
    const claim = this.claims[id];
    if (claim?.state === "completed") return "COMPLETED";
    if (claim?.state === "in_progress") return "IN_PROGRESS";
    if ((this.groupsOf.get(id)?.length ?? 0) === 0 || (this.openGroups.get(id) ?? 0) > 0) return "AVAILABLE";
    return "LOCKED";
  }

  complete(id: string, source: ClaimSource = "manual", at = new Date().toISOString()): string[] {
    if (!this.nodes.has(id)) throw new Error(`Unknown skill: ${id}`);
    if (this.claims[id]?.state === "completed") return [];
    this.claims[id] = { state: "completed", source, at };
    return this.refreshDependentGroups(id);
  }

  markInProgress(id: string, at = new Date().toISOString()): void {
    if (!this.nodes.has(id)) throw new Error(`Unknown skill: ${id}`);
    const wasComplete = this.claims[id]?.state === "completed";
    this.claims[id] = { state: "in_progress", source: "manual", at };
    if (wasComplete) this.refreshDependentGroups(id);
  }

  uncomplete(id: string): string[] {
    if (!this.claims[id]) return [];
    const wasComplete = this.claims[id]?.state === "completed";
    delete this.claims[id];
    return wasComplete ? this.refreshDependentGroups(id) : [];
  }

  inconsistencies(): string[] {
    return Object.entries(this.claims)
      .filter(([id, claim]) => claim.state === "completed" && (this.groupsOf.get(id)?.length ?? 0) > 0 && (this.openGroups.get(id) ?? 0) === 0)
      .map(([id]) => id).sort();
  }

  cascadeFor(targetId: string): string[] {
    return this.routeFor(targetId, "count").ids;
  }

  routeFor(targetId: string, mode: RouteMode): Route {
    if (!this.nodes.has(targetId)) throw new Error(`Unknown skill: ${targetId}`);
    const visiting = new Set<string>();
    const memo = new Map<string, string[]>();
    const solve = (id: string): string[] => {
      if (this.claims[id]?.state === "completed") return [];
      const cached = memo.get(id);
      if (cached) return cached;
      if (visiting.has(id)) throw new Error(`Cycle encountered at ${id}`);
      visiting.add(id);
      const groupIndexes = this.groupsOf.get(id) ?? [];
      let prerequisites: string[] = [];
      if (groupIndexes.length > 0) {
        const candidates = groupIndexes.map((groupIndex) => {
          const group = this.groups[groupIndex]!;
          const mandatory = group.all.flatMap(solve);
          const optional = (group.any_of?.of ?? []).map((source) => solve(source));
          const optionalCount = group.any_of?.n ?? 0;
          optional.sort((a, b) => this.compareRoutes(a, b, mode));
          return this.uniqueOrdered([...mandatory, ...optional.slice(0, optionalCount).flat()]);
        });
        candidates.sort((a, b) => this.compareRoutes(a, b, mode));
        prerequisites = candidates[0] ?? [];
      }
      visiting.delete(id);
      const result = this.uniqueOrdered([...prerequisites, id]);
      memo.set(id, result);
      return result;
    };
    const ids = solve(targetId);
    return { mode, ids, count: ids.length, maxDifficulty: Math.max(0, ...ids.map((id) => this.nodes.get(id)?.difficulty ?? 0)) };
  }

  ancestors(id: string): Set<string> { return this.walk(id, this.ancestorsOf); }
  descendants(id: string): Set<string> { return this.walk(id, this.dependentsOf); }

  private walk(id: string, index: Map<string, string[]>): Set<string> {
    const found = new Set<string>();
    const queue = [...(index.get(id) ?? [])];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (found.has(current)) continue;
      found.add(current);
      queue.push(...(index.get(current) ?? []));
    }
    return found;
  }

  private isCompleted(id: string): boolean { return this.claims[id]?.state === "completed"; }

  private isGroupSatisfied(group: IndexedGroup): boolean {
    if (!group.all.every((id) => this.isCompleted(id))) return false;
    if (!group.any_of) return true;
    return group.any_of.of.filter((id) => this.isCompleted(id)).length >= group.any_of.n;
  }

  private refreshDependentGroups(changedId: string): string[] {
    const dirty = new Set<string>();
    for (const groupIndex of this.dependentGroupsOf.get(changedId) ?? []) {
      const group = this.groups[groupIndex]!;
      const wasOpen = this.groupOpen[groupIndex] ?? false;
      const isOpen = this.isGroupSatisfied(group);
      if (wasOpen === isOpen) continue;
      this.groupOpen[groupIndex] = isOpen;
      this.openGroups.set(group.owner, (this.openGroups.get(group.owner) ?? 0) + (isOpen ? 1 : -1));
      dirty.add(group.owner);
    }
    return [...dirty];
  }

  private compareRoutes(a: string[], b: string[], mode: RouteMode): number {
    const maxA = Math.max(0, ...a.map((id) => this.nodes.get(id)?.difficulty ?? 0));
    const maxB = Math.max(0, ...b.map((id) => this.nodes.get(id)?.difficulty ?? 0));
    return mode === "maxDifficulty" ? maxA - maxB || a.length - b.length : a.length - b.length || maxA - maxB;
  }

  private uniqueOrdered(ids: string[]): string[] { return [...new Set(ids)]; }
}

export function createGraphState(graph: Graph, claims: Claims = {}): SkillGraphState {
  return new SkillGraphState(graph, claims);
}
