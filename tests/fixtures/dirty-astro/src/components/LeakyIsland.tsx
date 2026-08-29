import { readFileSync } from "node:fs";
import { INTERNAL_TOKEN } from "astro:env/server";

export default function LeakyIsland() {
  const marker = readFileSync("./private-marker.txt", "utf8");
  return <p>{INTERNAL_TOKEN}:{marker}</p>;
}
