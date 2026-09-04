"use client";

import { create } from "zustand";
import type { Claim, Claims, SkillState } from "@skillgraph/graph-core";

export const STORAGE_KEY = "skillgraph.claims.v1";
type Filters = { domains: string[]; difficulty: [number, number]; states: SkillState[]; frontierOnly: boolean; safetyOnly: boolean };
type FocusRequest = { id: string; token: number } | null;
type Store = {
  claims: Claims; selectedId: string | null; searchOpen: boolean; filtersOpen: boolean;
  filters: Filters; focusRequest: FocusRequest; hydrated: boolean;
  hydrate: () => void; setClaims: (claims: Claims) => void; select: (id: string | null) => void;
  openSearch: (open: boolean) => void; openFilters: (open: boolean) => void;
  setFilters: (filters: Partial<Filters>) => void; focus: (id: string) => void;
  importClaims: (payload: string) => { ok: boolean; message: string };
};

const defaultFilters: Filters = { domains: [], difficulty: [0, 7], states: [], frontierOnly: false, safetyOnly: false };
let persistTimer: ReturnType<typeof setTimeout> | null = null;
function persist(claims: Claims) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => localStorage.setItem(STORAGE_KEY, JSON.stringify({ datasetVersion: "1.0.0", claims })), 500);
}

export const useSkillStore = create<Store>((set, get) => ({
  claims: {}, selectedId: null, searchOpen: false, filtersOpen: false, filters: defaultFilters, focusRequest: null, hydrated: false,
  hydrate: () => {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as { claims?: Claims };
      set({ claims: stored.claims ?? {}, hydrated: true });
    } catch { set({ claims: {}, hydrated: true }); }
  },
  setClaims: (claims) => { set({ claims }); persist(claims); },
  select: (selectedId) => set({ selectedId }),
  openSearch: (searchOpen) => set({ searchOpen }),
  openFilters: (filtersOpen) => set({ filtersOpen }),
  setFilters: (partial) => set({ filters: { ...get().filters, ...partial } }),
  focus: (id) => set({ focusRequest: { id, token: Date.now() }, selectedId: id, searchOpen: false }),
  importClaims: (payload) => {
    try {
      const data = JSON.parse(payload) as { claims?: Claims };
      if (!data.claims || typeof data.claims !== "object") return { ok: false, message: "That file does not contain SkillGraph claims." };
      const clean = Object.fromEntries(Object.entries(data.claims).filter(([, claim]) => claim && ["completed", "in_progress"].includes((claim as Claim).state))) as Claims;
      get().setClaims(clean);
      return { ok: true, message: `Imported ${Object.keys(clean).length} claims.` };
    } catch { return { ok: false, message: "That file is not valid JSON." }; }
  },
}));
