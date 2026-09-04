"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSkillStore } from "@/lib/store";

export function SkillClaim({ id }: { id: string }) {
  const router = useRouter(); const { claims, hydrate, setClaims, focus } = useSkillStore();
  useEffect(() => hydrate(), [hydrate]); const state = claims[id]?.state === "completed" ? "COMPLETED" : claims[id]?.state === "in_progress" ? "IN_PROGRESS" : "UNCLAIMED";
  const toggle = () => { const next = { ...claims }; if (state === "COMPLETED") delete next[id]; else next[id] = { state: "completed", source: "manual", at: new Date().toISOString() }; setClaims(next); };
  return <div className="skill-claim-card"><button className={`claim-button ${state === "COMPLETED" ? "claimed" : ""}`} onClick={toggle}><span>{state === "COMPLETED" ? "✓" : "+"}</span>{state === "COMPLETED" ? "I can do this" : "I can do this"}</button><button className="open-map-button" onClick={() => { focus(id); router.push("/"); }}>Locate on the map <span>↗</span></button><small>Current map state: {state.replace("_", " ").toLowerCase()}</small></div>;
}
