import { DomainBrowser } from "@/components/domain-browser";
import { SiteHeader } from "@/components/site-header";
import { getGraph } from "@/lib/data";

export const metadata = { title: "Browse every domain" };
export default async function DomainsPage() { const graph = await getGraph(); return <><SiteHeader /><main id="main-content" className="content-page"><header className="page-intro"><span className="eyebrow">The full atlas</span><h1>Every skill, without the canvas.</h1><p>A keyboard-friendly route through the same 1,000 capabilities. Search, filter, and claim from the list.</p></header><DomainBrowser graph={graph} /></main></>; }
