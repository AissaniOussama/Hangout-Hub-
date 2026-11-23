// Packt das gebaute Frontend (../frontend/dist) als Base64 in src/static.generated.ts,
// damit die Neon Function es ohne extra Hosting ausliefern kann.
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import { join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const here = fileURLToPath(new URL(".", import.meta.url));
const dist = join(here, "../../frontend/dist");
const out = join(here, "../src/static.generated.ts");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".txt": "text/plain; charset=utf-8",
};

async function walk(dir) {
  const files = [];
  for (const entry of await readdir(dir)) {
    const full = join(dir, entry);
    if ((await stat(full)).isDirectory()) files.push(...(await walk(full)));
    else files.push(full);
  }
  return files;
}

const entries = [];
for (const file of (await walk(dist)).sort()) {
  const path = "/" + relative(dist, file).split("\\").join("/");
  const type = TYPES[extname(file).toLowerCase()] ?? "application/octet-stream";
  const data = (await readFile(file)).toString("base64");
  entries.push(`  ${JSON.stringify(path)}: { type: ${JSON.stringify(type)}, data: ${JSON.stringify(data)} },`);
}

await writeFile(
  out,
  `// Automatisch erzeugt von scripts/embed-frontend.mjs - nicht bearbeiten.\n` +
    `export const STATIC_FILES: Record<string, { type: string; data: string }> = {\n${entries.join("\n")}\n};\n`,
);
console.log(`${entries.length} Dateien eingebettet -> src/static.generated.ts`);
