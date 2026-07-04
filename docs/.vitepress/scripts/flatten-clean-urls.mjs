/**
 * Post-build step for cleanUrls: normalize the dist to ONE page shape.
 *
 * VitePress emits leaf pages as `foo.html` but section indexes as
 * `foo/index.html`. This moves every `foo.html` → `foo/index.html` so all
 * pages have the same shape, which lets the CDN serve extensionless URLs
 * (/llm/openai → /llm/openai/index.html) with a single convention rule and
 * no hardcoded path list.
 *
 * Also rewrites sitemap.xml so section-index URLs lose their trailing slash
 * (/executor/ → /executor), matching the canonical tags.
 *
 * Runs automatically after `npm run docs:build` (postdocs:build).
 */
import { readdirSync, mkdirSync, renameSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const DIST = join(process.cwd(), "docs/.vitepress/dist");
const KEEP_FLAT = new Set(["index.html", "404.html"]);

let moved = 0;

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "assets") continue;
      walk(full);
    } else if (
      entry.name.endsWith(".html") &&
      !(dir === DIST && KEEP_FLAT.has(entry.name)) &&
      entry.name !== "index.html"
    ) {
      const pageDir = join(dir, basename(entry.name, ".html"));
      mkdirSync(pageDir, { recursive: true });
      renameSync(full, join(pageDir, "index.html"));
      moved++;
    }
  }
}

if (!existsSync(DIST)) {
  console.error(`[flatten-clean-urls] dist not found at ${DIST} — did the build run?`);
  process.exit(1);
}

walk(DIST);

const sitemapPath = join(DIST, "sitemap.xml");
if (existsSync(sitemapPath)) {
  const sitemap = readFileSync(sitemapPath, "utf8").replace(
    /<loc>(https?:\/\/[^<]*?)\/<\/loc>/g,
    (match, url) => (new URL(url + "/").pathname === "/" ? match : `<loc>${url}</loc>`)
  );
  writeFileSync(sitemapPath, sitemap);
}

// Guard against the silent-empty-build failure mode: a healthy build has
// dozens of pages. Fail loudly if the dist is suspiciously empty.
if (moved < 20) {
  console.error(
    `[flatten-clean-urls] only ${moved} pages found — dist looks incomplete, failing the build.`
  );
  process.exit(1);
}

console.log(`[flatten-clean-urls] normalized ${moved} pages to directory form.`);
