import type { MetadataRoute } from "next";
import { getGraph } from "@/lib/data";

export const dynamic = "force-static";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const graph = await getGraph(); const base = "https://skillgraph.example";
  return [
    ...["", "/me", "/domains", "/about", "/contribute"].map((path) => ({ url: `${base}${path}`, changeFrequency: "monthly" as const, priority: path === "" ? 1 : 0.7 })),
    ...graph.domains.map((domain) => ({ url: `${base}/d/${domain.id}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...graph.nodes.map((node) => ({ url: `${base}/s/${node.slug}`, changeFrequency: "yearly" as const, priority: 0.6 })),
  ];
}
