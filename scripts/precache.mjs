import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const base = process.env.BASE_PATH || "/";
if (!base.startsWith("/") || !base.endsWith("/"))
  throw Error("BASE_PATH must start and end with /");
const files = [
  base,
  base + "index.html",
  base + "icon.svg",
  base + "manifest.webmanifest",
  ...(await readdir("dist/assets")).map((f) => base + "assets/" + f),
];
const template = await readFile("public/sw.js", "utf8");
const hash = createHash("sha256")
  .update(template + files.join("|"))
  .digest("hex")
  .slice(0, 12);
const sw = template
  .replace(
    /const CACHE = .*?;/,
    "const CACHE = " + JSON.stringify("atolye-" + base + "-" + hash) + ";",
  )
  .replace(
    /const FILES = [\s\S]*?;/,
    "const FILES = " + JSON.stringify(files) + ";",
  );
await writeFile("dist/sw.js", sw);
