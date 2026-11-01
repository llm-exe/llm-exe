/**
 * Post-build guard for the docs site (runs via postdocs:build).
 *
 * Protects against a failure mode we hit in practice: if node_modules
 * changes while vitepress builds (e.g. a concurrent install), the build can
 * exit 0 having rendered only 404.html — deploying that dist blanks the
 * site with no error anywhere. This fails the build instead.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const DIST = join(process.cwd(), "docs/.vitepress/dist");
const MIN_PAGES = 40;

const sitemapPath = join(DIST, "sitemap.xml");
if (!existsSync(sitemapPath)) {
  console.error("[verify-docs-build] sitemap.xml missing — build is incomplete, failing.");
  process.exit(1);
}

const pageCount = (readFileSync(sitemapPath, "utf8").match(/<loc>/g) || []).length;
if (pageCount < MIN_PAGES) {
  console.error(
    `[verify-docs-build] sitemap has ${pageCount} pages (expected >= ${MIN_PAGES}) — build is incomplete, failing.`
  );
  process.exit(1);
}

if (!existsSync(join(DIST, "index.html")) || !existsSync(join(DIST, "llm", "openai.html"))) {
  console.error("[verify-docs-build] expected pages missing from dist — failing.");
  process.exit(1);
}

console.log(`[verify-docs-build] OK — ${pageCount} pages in sitemap.`);
