import { MyMap } from "@/components/my-map";
import { SiteHeader } from "@/components/site-header";
import { getGraph } from "@/lib/data";

export const metadata = { title: "My map" };
export default async function MePage() { return <><SiteHeader /><main id="main-content" className="content-page"><MyMap graph={await getGraph()} /></main></>; }
