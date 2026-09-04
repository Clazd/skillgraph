import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SkillClaim } from "@/components/skill-claim";
import { SiteHeader } from "@/components/site-header";
import { getDetails, getGraph, getSkillBySlug } from "@/lib/data";

export async function generateStaticParams() { return (await getGraph()).nodes.map((node) => ({ slug: node.slug })); }
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> { const skill = await getSkillBySlug((await params).slug); return skill ? { title: skill.name, description: skill.short_description } : {}; }

export default async function SkillPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params; const graph = await getGraph(); const skill = graph.nodes.find((node) => node.slug === slug); if (!skill) notFound();
  const detail = await getDetails(skill.id); const domain = graph.domains.find((item) => item.id === skill.domain)!;
  const downstream = graph.nodes.filter((node) => node.unlock_rules.some((group) => [...group.all, ...(group.any_of?.of ?? [])].includes(skill.id))).slice(0, 8);
  return <><SiteHeader /><main id="main-content" className="skill-page">
    <nav className="breadcrumbs" aria-label="Breadcrumb"><Link href="/domains">Domains</Link><span>/</span><Link href={`/d/${domain.id}`}>{domain.name}</Link><span>/</span><span>{skill.name}</span></nav>
    <div className="skill-layout"><article>
      <div className="skill-meta"><span className="domain-pill" style={{ color: domain.color, borderColor: `${domain.color}66`, background: `${domain.color}18` }}>{domain.name}</span><span>Level {skill.difficulty}</span><span>{skill.time_to_learn}</span></div>
      <h1>{skill.name}</h1><p className="skill-lede">{skill.short_description}</p><blockquote>{skill.self_assessment}</blockquote>
      {skill.safety_note && <div className="safety-note"><span>Safety first</span><p>{skill.safety_note}</p></div>}
      <section><h2>What this capability includes</h2><p>{detail.description}</p>{detail.examples.length > 0 && <><h3>Examples</h3><ul>{detail.examples.map((example) => <li key={example}>{example}</li>)}</ul></>}</section>
      {skill.unlock_rules.length > 0 && <section><h2>Ways into this skill</h2><p className="section-note">Any complete route makes the skill available. You may still claim it at any time.</p>{skill.unlock_rules.map((group, index) => <div className="route-card" key={`${group.label}-${index}`}><span>Route {index + 1}</span><h3>{group.label}</h3><div>{group.all.map((id) => { const item = graph.nodes.find((node) => node.id === id); return item ? <Link key={id} href={`/s/${item.slug}`}>{item.name}</Link> : null; })}</div></div>)}</section>}
      {skill.builds_on.length > 0 && <section><h2>Helpful, not required</h2><p className="section-note">These connections can make the skill easier to develop, but they never lock it.</p><div className="related-grid">{skill.builds_on.slice(0, 6).map((edge) => { const item = graph.nodes.find((node) => node.id === edge.id); return item ? <Link key={edge.id} href={`/s/${item.slug}`}><span>{item.name}</span><small>{Math.round(edge.strength * 100)}% affinity</small></Link> : null; })}</div></section>}
      {downstream.length > 0 && <section><h2>What this unlocks</h2><div className="related-grid">{downstream.map((item) => <Link key={item.id} href={`/s/${item.slug}`}><span>{item.name}</span><small>{item.domain} · L{item.difficulty}</small></Link>)}</div></section>}
    </article><aside><SkillClaim id={skill.id} /><div className="truth-card"><span className="eyebrow">A mirror, not a test</span><p>Claims are self-reported and verify nothing. You remain the authority on what you can do.</p></div></aside></div>
  </main></>;
}
