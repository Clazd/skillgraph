import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Graph, GraphNode } from "@skillgraph/graph-core";

const dataDir = path.join(process.cwd(), "public", "data");
const catalogPath = path.join(process.cwd(), "..", "..", "packages", "dataset", "generated", "catalog.json");

export async function getGraph(): Promise<Graph> {
  return JSON.parse(await readFile(catalogPath, "utf8")) as Graph;
}

export async function getDetails(id: string): Promise<{ id: string; description: string; examples: string[] }> {
  return JSON.parse(await readFile(path.join(dataDir, "detail", `${id}.json`), "utf8"));
}

export async function getSkillBySlug(slug: string): Promise<GraphNode | undefined> {
  return (await getGraph()).nodes.find((node) => node.slug === slug);
}
