// scripts/check-external-links.mjs — vérifie les href externes des pages HTML
import { readFileSync, readdirSync } from 'node:fs';

const files = readdirSync('.').filter(f => f.endsWith('.html'));
const set = new Set();
for (const f of files) {
  for (const m of readFileSync(f, 'utf8').matchAll(/href="(https?:[^"]+)"/g)) {
    const u = m[1];
    if (u.includes('wa.me') || u.includes('fonts.g')) continue;
    set.add(u.split('#')[0]);
  }
}
const urls = [...set];
console.log(`${urls.length} URLs externes uniques`);

const dead = [];
await Promise.all(urls.map(async (u) => {
  try {
    const c = new AbortController();
    setTimeout(() => c.abort(), 9000);
    let r = await fetch(u, { method: 'HEAD', signal: c.signal, redirect: 'follow' });
    if (r.status === 405 || r.status === 403) {
      r = await fetch(u, { method: 'GET', headers: { Range: 'bytes=0-0' }, signal: c.signal, redirect: 'follow' });
    }
    if (!r.ok && r.status !== 206) dead.push(`${u} [${r.status}]`);
  } catch {
    dead.push(`${u} [erreur réseau]`);
  }
}));
console.log(dead.length ? 'MORTS:\n' + dead.join('\n') : 'Tous vivants');
