// scripts/add-digital-nav.mjs
// Injecte le nav-item Digital dans tous les fichiers HTML du projet.
// Stratégie : insertion après le dernier nav-item existant (Services).
// Idempotent : ne réinsère pas si le lien est déjà présent.
// Usage : node scripts/add-digital-nav.mjs

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { resolve, join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// HTML du nav-item Digital à insérer après Services
const NAV_ITEM_DIGITAL = `      <div class="nav-item">
        <a href="digital.html" class="nav-item__btn" style="text-decoration:none;color:#a78bfa;font-weight:800">
          <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"/></svg>
          Digital
          <svg viewBox="0 0 20 20" fill="currentColor" width="12" height="12"><path d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"/></svg>
        </a>
        <div class="nav-dropdown">
          <a href="digital.html?tab=logiciels">💿 Logiciels</a>
          <a href="digital.html?tab=abonnements">🔄 Abonnements</a>
          <a href="digital.html?tab=licences">🔑 Licences</a>
          <a href="digital.html?tab=antivirus">🛡️ Antivirus</a>
          <a href="digital.html?tab=outils-ia">🤖 Outils IA</a>
          <a href="digital.html?tab=saas">☁️ SaaS</a>
          <a href="digital.html?tab=premium">⭐ Offres Premium</a>
        </div>
      </div>`;

// Quick-cat Digital à insérer après Services dans la barre de raccourcis
const QUICK_CAT_DIGITAL = `      <a href="digital.html" class="quick-cat"><span class="icon">💿</span>Digital</a>`;

// Marqueur utilisé pour détecter Services dans la nav (ancre stable)
const SERVICES_NAV_MARKER = `<a href="services.html" class="nav-item__btn" style="text-decoration:none">🛠️ Services</a>`;
const SERVICES_NAV_CLOSE  = '</div>\n    </div>\n  </nav>';

// Marqueur pour quick-cats
const SERVICES_QUICK_MARKER = `<a href="services.html" class="quick-cat"><span class="icon">🛠️</span>Services</a>`;

// Fichiers HTML à la racine uniquement (pas admin/, pas node_modules/)
function getRootHtmlFiles() {
  return readdirSync(ROOT)
    .filter(f => f.endsWith('.html') && !f.startsWith('email-') && f !== 'taste-skill-demo.html')
    .map(f => join(ROOT, f));
}

let updated = 0; let skipped = 0;

for (const filePath of getRootHtmlFiles()) {
  let html = readFileSync(filePath, 'utf8');

  // Idempotent — déjà patché
  if (html.includes('digital.html" class="nav-item__btn"')) {
    console.log(`⏭  Ignoré (déjà présent) : ${filePath.split(/[\\/]/).pop()}`);
    skipped++;
    continue;
  }

  let changed = false;

  // 1. Injecter nav-item Digital après le bloc Services
  //    Trouve : </div>\n      <div class="nav-item">\n        <a href="services.html"...
  //    → on cherche la fermeture </div> du nav-item Services puis on insère
  const servicesNavItemPattern = /(<a href="services\.html" class="nav-item__btn" style="text-decoration:none">🛠️ Services<\/a>\n      <\/div>\n    <\/div>\n  <\/nav>)/;
  if (servicesNavItemPattern.test(html)) {
    html = html.replace(
      servicesNavItemPattern,
      `$1`.replace(
        '<a href="services.html" class="nav-item__btn" style="text-decoration:none">🛠️ Services</a>\n      </div>\n    </div>\n  </nav>',
        `<a href="services.html" class="nav-item__btn" style="text-decoration:none">🛠️ Services</a>\n      </div>\n${NAV_ITEM_DIGITAL}\n    </div>\n  </nav>`
      )
    );
    changed = true;
  } else {
    // Fallback : cherche le dernier nav-item Services avec regex plus souple
    const idx = html.indexOf('<a href="services.html" class="nav-item__btn"');
    if (idx !== -1) {
      const closeIdx = html.indexOf('</div>', idx);
      if (closeIdx !== -1) {
        html = html.slice(0, closeIdx + 6) + '\n' + NAV_ITEM_DIGITAL + html.slice(closeIdx + 6);
        changed = true;
      }
    }
  }

  // 2. Injecter quick-cat Digital après Services dans la quick-cats bar
  if (html.includes(SERVICES_QUICK_MARKER) && !html.includes('digital.html" class="quick-cat"')) {
    html = html.replace(
      SERVICES_QUICK_MARKER,
      `${SERVICES_QUICK_MARKER}\n${QUICK_CAT_DIGITAL}`
    );
    changed = true;
  }

  if (changed) {
    writeFileSync(filePath, html, 'utf8');
    console.log(`✅ Mis à jour : ${filePath.split(/[\\/]/).pop()}`);
    updated++;
  } else {
    console.log(`⚠️  Aucun marqueur trouvé (nav statique différente ?) : ${filePath.split(/[\\/]/).pop()}`);
    skipped++;
  }
}

console.log(`\n📊 ${updated} fichiers mis à jour, ${skipped} ignorés`);
