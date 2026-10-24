#!/usr/bin/env node
/**
 * Live Open Library search demo for Route A (same endpoint + User-Agent as the plugin).
 */
const query = process.argv[2] ?? 'why we laugh';
const contact = process.argv[3] ?? 'tilounguyen@gmail.com';
const userAgent = `ObsidianBookSearchPlugin/0.7.6 (${contact})`;

const url = new URL('https://openlibrary.org/search.json');
url.searchParams.set('q', query);
url.searchParams.set('limit', '8');
url.searchParams.set('fields', 'key,title,author_name,first_publish_year,isbn,cover_i');

console.log(`Open Library Route A demo — query: "${query}"`);
console.log(`User-Agent: ${userAgent}\n`);

const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': userAgent } });
if (!res.ok) {
  console.error(`HTTP ${res.status}`);
  process.exit(1);
}

const data = await res.json();
const docs = data.docs ?? [];
console.log(`numFound: ${data.numFound ?? 0}`);
console.log('--- results ---');
for (const doc of docs) {
  const authors = (doc.author_name ?? []).join(', ');
  const year = doc.first_publish_year ?? '';
  const link = doc.key ? `https://openlibrary.org${doc.key}` : '';
  console.log(`• ${doc.title}${year ? ` (${year})` : ''}`);
  if (authors) console.log(`  ${authors}`);
  if (link) console.log(`  ${link}`);
}
console.log('\nDone — plugin uses this path as the default global provider.');
