#!/usr/bin/env node
/** Renders search provider pill states to HTML for manual screenshot (gitignored .tmp). */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dir = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dir, '..', '.tmp', 'pill-preview');
mkdirSync(outDir, { recursive: true });

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Book Search provider pill</title>
<link rel="stylesheet" href="../../styles.css"/>
<style>
  body { font-family: system-ui, sans-serif; padding: 24px; background: #1e1e1e; color: #dcddde; }
  .modal-mock { max-width: 420px; padding: 16px; border: 1px solid #333; border-radius: 8px; }
  h2 { margin: 0 0 12px; font-size: 1.25rem; }
  --text-muted: #999; --text-normal: #dcddde; --background-modifier-border: #3d3d3d;
  --background-modifier-border-hover: #555; --background-modifier-hover: #2a2a2a;
  --interactive-accent: #7f6df2; --font-ui-smaller: 12px; --font-medium: 600;
</style>
</head>
<body>
<div class="modal-mock book-search-plugin">
  <h2>Search Book</h2>
  <div class="book-search-plugin__search-provider-pill" data-phase="idle">
    <div class="book-search-plugin__search-provider-pill-inner">
      <span class="book-search-plugin__search-provider-pill-label">Open Library</span>
      <span class="book-search-plugin__search-provider-pill-detail">Google fallback if no matches</span>
    </div>
  </div>
  <div class="book-search-plugin__search-provider-pill" data-phase="searching" data-leg="open_library" style="margin-top:16px">
    <div class="book-search-plugin__search-provider-pill-inner">
      <span class="book-search-plugin__search-provider-pill-label">Searching… Open Library</span>
    </div>
  </div>
  <div class="book-search-plugin__search-provider-pill" data-phase="searching" data-leg="google_books_fallback" style="margin-top:16px">
    <div class="book-search-plugin__search-provider-pill-inner">
      <span class="book-search-plugin__search-provider-pill-label">Searching… Google Books</span>
      <span class="book-search-plugin__search-provider-pill-detail">fallback</span>
    </div>
  </div>
</div>
</body>
</html>`;

const outPath = join(outDir, 'index.html');
writeFileSync(outPath, html);
console.log(outPath);
