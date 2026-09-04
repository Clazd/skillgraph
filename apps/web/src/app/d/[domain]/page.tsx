import { notFound } from "next/navigation";
import { DomainBrowser } from "@/components/domain-browser";
import { SiteHeader } from "@/components/site-header";
import { getGraph } from "@/lib/data";

export async function generateStaticParams() { return (await getGraph()).domains.map((domain) => ({ domain: domain.id })); }
export default async function DomainPage({ params }: { params: Promise<{ domain: string }> }) { const { domain } = await params; const graph = await getGraph(); if (!graph.domains.some((item) => item.id === domain)) notFound(); return <><SiteHeader /><main id="main-content" className="content-page"><header className="page-intro compact"><span className="eyebrow">Domain region</span><h1>{graph.domains.find((item) => item.id === domain)?.name}</h1><p>Explore this region as an accessible list or jump back into its fixed map geography.</p></header><DomainBrowser graph={graph} initialDomain={domain} /></main></>; }
