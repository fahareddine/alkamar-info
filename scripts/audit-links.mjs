// scripts/audit-links.mjs
// Audit liens morts + images absentes.
// 1) HTML : href/src internes → existence fichier local
// 2) Base produits : image / main_image_url / gallery_urls → HEAD HTTP
// Rapport : reports/dead-links.md + résumé console.
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';

config({ path: '.env.local' });

const ROOT = process.cwd();
const htmlFiles = readdirSync(ROOT).filter(f => f.endsWith('.html'));

// ── 1. Audit statique HTML ───────────────────────────────────────────────────
const deadInternal = [];
const ATTR_RE = /(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"/g;

for (const file of htmlFiles) {
  const html = readFileSync(file, 'utf8');
  for (const m of html.matchAll(ATTR_RE)) {
    const url = m[1].trim();
    if (!url || url.startsWith('http') || url.startsWith('//') || url.startsWith('mailto:')
      || url.startsWith('tel:') || url.startsWith('data:') || url.startsWith('javascript:')) continue;
    const path = url.startsWith('/') ? url.slice(1) : url;
    if (!path || path.endsWith('/')) continue;
    if (!existsSync(`${ROOT}/${path}`)) {
      deadInternal.push({ file, url });
    }
  }
}

// ── 2. Audit images produits (DB) ────────────────────────────────────────────
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

async function headOk(url, timeoutMs = 8000) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    let res = await fetch(url, { method: 'HEAD', signal: ctrl.signal, redirect: 'follow' });
    // Certains CDN refusent HEAD → retente en GET léger
    if (res.status === 405 || res.status === 403) {
      res = await fetch(url, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: ctrl.signal, redirect: 'follow' });
    }
    clearTimeout(t);
    return res.ok || res.status === 206;
  } catch {
    return false;
  }
}

async function checkPool(items, worker, concurrency = 12) {
  const queue = [...items];
  const results = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (queue.length) {
      const item = queue.shift();
      results.push(await worker(item));
    }
  }));
  return results;
}

const { data: products } = await sb.from('products')
  .select('id, slug, legacy_id, name, status, image, main_image_url, gallery_urls')
  .eq('status', 'active').order('name');

// Collecte URL uniques externes + chemins locaux
const urlMap = new Map(); // url → [{product, champ}]
for (const p of products) {
  const entries = [['image', p.image], ['main_image_url', p.main_image_url]];
  (p.gallery_urls || []).forEach((g, i) => entries.push([`gallery_urls[${i}]`, typeof g === 'string' ? g : g?.src]));
  for (const [field, url] of entries) {
    if (!url || typeof url !== 'string' || url.startsWith('data:')) continue;
    if (!urlMap.has(url)) urlMap.set(url, []);
    urlMap.get(url).push({ name: p.name, id: p.slug || p.legacy_id || p.id, field });
  }
}

const urls = [...urlMap.keys()];
console.log(`HTML : ${htmlFiles.length} pages | refs internes mortes : ${deadInternal.length}`);
console.log(`DB : ${products.length} produits actifs | ${urls.length} URLs image uniques à vérifier…`);

const deadImages = [];
await checkPool(urls, async (url) => {
  if (url.startsWith('/')) {
    // Chemin local servi par Vercel
    if (!existsSync(`${ROOT}/${url.slice(1).split('?')[0]}`)) deadImages.push(url);
    return;
  }
  if (!(await headOk(url))) deadImages.push(url);
});

// ── Rapport ──────────────────────────────────────────────────────────────────
mkdirSync('reports', { recursive: true });
let md = `# Audit liens morts — ${new Date().toISOString()}\n\n## Références internes mortes (HTML)\n\n`;
md += deadInternal.length
  ? deadInternal.map(d => `- \`${d.file}\` → \`${d.url}\``).join('\n')
  : '_Aucune_';
md += `\n\n## Images produits mortes (${deadImages.length})\n\n`;
for (const url of deadImages) {
  const refs = urlMap.get(url) || [];
  md += `- ${url}\n${refs.map(r => `  - ${r.name} (${r.id}) — ${r.field}`).join('\n')}\n`;
}
writeFileSync('reports/dead-links.md', md);

console.log(`Images mortes : ${deadImages.length}`);
console.log('Rapport : reports/dead-links.md');
