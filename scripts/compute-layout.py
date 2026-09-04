#!/usr/bin/env python3
"""Build the immutable SkillGraph map layout and a reviewable PNG preview."""

from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from typing import Any

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "packages" / "dataset"
DEFAULT_OUTPUT = DATASET / "generated" / "layout.json"
DEFAULT_PREVIEW = ROOT / "docs" / "map-preview.png"

# Deliberately asymmetric: this reads as a map rather than a dashboard grid.
DOMAIN_CENTRES = {
    "body": (-1320, -650),
    "care": (-660, -860),
    "social": (60, -820),
    "lang": (760, -690),
    "art": (1330, -260),
    "food": (-1260, 30),
    "home": (-680, 40),
    "world": (-80, 40),
    "learn": (530, -40),
    "digital": (1080, 340),
    "reason": (-230, 700),
    "eng": (520, 760),
}


def stable_unit(seed: int, value: str, axis: str) -> float:
    digest = hashlib.sha256(f"{seed}:{value}:{axis}".encode()).digest()
    return int.from_bytes(digest[:8], "big") / ((1 << 64) - 1)


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def load_data() -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    domain_doc = json.loads((DATASET / "domains" / "domains.json").read_text(encoding="utf-8"))
    domains = domain_doc["domains"]
    skills: list[dict[str, Any]] = []
    for path in sorted((DATASET / "skills").glob("*.jsonl")):
        skills.extend(read_jsonl(path))
    for path in sorted((DATASET / "spines").glob("*.jsonl")):
        skills.extend(read_jsonl(path))
    skills.sort(key=lambda skill: skill["id"])
    if len(skills) != 1000:
        raise ValueError(f"Expected exactly 1000 skills, found {len(skills)}")
    return domains, skills


def build_layout(seed: int) -> tuple[dict[str, Any], list[dict[str, Any]], list[dict[str, Any]]]:
    domains, skills = load_data()
    by_domain: dict[str, list[dict[str, Any]]] = {domain["id"]: [] for domain in domains}
    for skill in skills:
        by_domain[skill["domain"]].append(skill)

    nodes: dict[str, dict[str, float]] = {}
    cluster_centres: dict[str, tuple[float, float]] = {}

    for domain in domains:
        domain_id = domain["id"]
        domain_x, domain_y = DOMAIN_CENTRES[domain_id]
        clusters = domain["clusters"]
        ring_radius = 205 + max(0, len(clusters) - 5) * 8
        rotation = (stable_unit(seed, domain_id, "rotation") - 0.5) * 0.4

        for cluster_index, cluster in enumerate(clusters):
            angle = rotation + (2 * math.pi * cluster_index / len(clusters))
            cluster_x = domain_x + math.cos(angle) * ring_radius
            cluster_y = domain_y + math.sin(angle) * ring_radius * 0.72
            cluster_centres[f"{domain_id}.{cluster['id']}"] = (cluster_x, cluster_y)

        domain_skills = sorted(by_domain[domain_id], key=lambda skill: (skill["tags"][0], skill["difficulty"], skill["id"]))
        grouped: dict[str, list[dict[str, Any]]] = {cluster["id"]: [] for cluster in clusters}
        for skill in domain_skills:
            cluster_id = skill["id"].split(".")[1]
            grouped.setdefault(cluster_id, []).append(skill)

        for cluster in clusters:
            cluster_id = cluster["id"]
            cluster_nodes = grouped.get(cluster_id, [])
            cluster_x, cluster_y = cluster_centres[f"{domain_id}.{cluster_id}"]
            # A sunflower spiral produces compact, even spacing without simulation drift.
            golden_angle = math.pi * (3 - math.sqrt(5))
            ordered = sorted(cluster_nodes, key=lambda skill: (skill["difficulty"], skill["id"]))
            for index, skill in enumerate(ordered):
                radius = 31 * math.sqrt(index)
                angle = index * golden_angle + stable_unit(seed, skill["id"], "angle") * 0.22
                difficulty_bias = (skill["difficulty"] - 3.5) * 7
                x = cluster_x + math.cos(angle) * radius + difficulty_bias
                y = cluster_y + math.sin(angle) * radius * 0.78
                nodes[skill["id"]] = {"x": round(x, 3), "y": round(y, 3)}

    values = list(nodes.values())
    bbox = {
        "min_x": min(node["x"] for node in values),
        "min_y": min(node["y"] for node in values),
        "max_x": max(node["x"] for node in values),
        "max_y": max(node["y"] for node in values),
    }
    layout = {
        "version": "1.0.0",
        "seed": seed,
        "coordinate_system": "world",
        "bbox": bbox,
        "nodes": {skill_id: nodes[skill_id] for skill_id in sorted(nodes)},
    }
    return layout, domains, skills


def render_preview(layout: dict[str, Any], domains: list[dict[str, Any]], skills: list[dict[str, Any]], path: Path) -> None:
    width, height, padding = 1800, 1080, 80
    image = Image.new("RGB", (width, height), "#07101f")
    draw = ImageDraw.Draw(image, "RGBA")
    bbox = layout["bbox"]
    scale = min((width - padding * 2) / (bbox["max_x"] - bbox["min_x"]), (height - padding * 2) / (bbox["max_y"] - bbox["min_y"]))

    def point(skill_id: str) -> tuple[float, float]:
        node = layout["nodes"][skill_id]
        return ((node["x"] - bbox["min_x"]) * scale + padding, (node["y"] - bbox["min_y"]) * scale + padding)

    colours = {domain["id"]: domain["colour"]["hex"] for domain in domains}
    names = {domain["id"]: domain["name"] for domain in domains}
    skill_by_id = {skill["id"]: skill for skill in skills}

    # Draw only a restrained sample of edges so the preview communicates topology.
    for skill in skills:
        target = point(skill["id"])
        hard_sources = [source for group in skill["unlock_rules"] for source in group["all"]]
        for source in hard_sources[:2]:
            if source not in skill_by_id:
                continue
            start = point(source)
            cross = skill_by_id[source]["domain"] != skill["domain"]
            draw.line((start, target), fill="#d7a56a38" if cross else "#74819724", width=1)

    for skill in skills:
        x, y = point(skill["id"])
        colour = colours[skill["domain"]]
        radius = 2.2 + skill["difficulty"] * 0.22
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=colour + "E8", outline="#ffffff70", width=1)

    try:
        title_font = ImageFont.truetype("arialbd.ttf", 29)
        label_font = ImageFont.truetype("arialbd.ttf", 17)
        meta_font = ImageFont.truetype("arial.ttf", 16)
    except OSError:
        title_font = label_font = meta_font = ImageFont.load_default()

    draw.rounded_rectangle((34, 28, 452, 112), radius=18, fill="#0f1d31e8", outline="#91a1b82f", width=1)
    draw.text((56, 43), "SKILLGRAPH · MAP PREVIEW", font=title_font, fill="#f6f8fb")
    draw.text((57, 80), "1,000 skills · deterministic layout · seed 42", font=meta_font, fill="#99a9bf")

    for domain_id, centre in DOMAIN_CENTRES.items():
        x = (centre[0] - bbox["min_x"]) * scale + padding
        y = (centre[1] - bbox["min_y"]) * scale + padding
        label = names[domain_id].upper()
        label_box = draw.textbbox((0, 0), label, font=label_font)
        label_width = label_box[2] - label_box[0]
        draw.rounded_rectangle((x - label_width / 2 - 9, y - 13, x + label_width / 2 + 9, y + 13), radius=8, fill="#07101fdc")
        draw.text((x - label_width / 2, y - 9), label, font=label_font, fill=colours[domain_id])

    path.parent.mkdir(parents=True, exist_ok=True)
    image.save(path, optimize=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--preview", type=Path, default=DEFAULT_PREVIEW)
    parser.add_argument("--no-preview", action="store_true")
    args = parser.parse_args()

    layout, domains, skills = build_layout(args.seed)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(layout, indent=2, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")
    if not args.no_preview:
        render_preview(layout, domains, skills, args.preview)
    print(json.dumps({"nodes": len(layout["nodes"]), "seed": args.seed, "bbox": layout["bbox"], "output": str(args.output)}))


if __name__ == "__main__":
    main()
