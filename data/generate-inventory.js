/**
 * generate-inventory.js
 * Génère products-inventory.json et products-inventory.html
 * depuis le dump SQL Supabase + les fichiers ASIN connus.
 */

const fs = require('fs');
const path = require('path');

// ── 1. Lecture des sources ─────────────────────────────────────────────────────

const SQL_DUMP = 'C:/Users/defis/.claude/projects/C--Users-defis-alkamar-info/f84f4222-3fd1-4d95-85b8-589e6c62ccdd/tool-results/mcp-plugin_supabase_supabase-execute_sql-1776611594533.txt';
const ASINS_JSON = 'C:/Users/defis/alkamar-info/scripts/asins.json';
const SCRAPING_MD = 'C:/Users/defis/alkamar-info/data-import/composants-scraping-report.md';
const OUT_DIR = 'C:/Users/defis/alkamar-info/data';

const rawTxt = fs.readFileSync(SQL_DUMP, 'utf8');
// The file is a JSON object: {"result":"...escaped string with JSON array inside..."}
const outer = JSON.parse(rawTxt);
const resultStr = outer.result || rawTxt;
// Extract the JSON array from between the XML tags or directly
const match = resultStr.match(/<untrusted-data[^>]*>\n(\[[\s\S]*?\])\n<\/untrusted-data/);
let products;
if (match) {
  products = JSON.parse(match[1]);
} else {
  // Fallback: find first [ to last ]
  const start = resultStr.indexOf('[{');
  const end = resultStr.lastIndexOf('}]') + 2;
  products = JSON.parse(resultStr.slice(start, end));
}

// ── 2. Construction d'une map ASIN depuis toutes les sources ──────────────────

// Map : keyword (lowercase) -> ASIN
const asinMap = new Map();

// 2a. asins.json
try {
  const asinsJson = JSON.parse(fs.readFileSync(ASINS_JSON, 'utf8'));
  for (const [subcat, entries] of Object.entries(asinsJson)) {
    for (const [key, asin] of Object.entries(entries)) {
      if (asin && asin.trim()) {
        asinMap.set(key.toLowerCase(), asin.trim());
      }
    }
  }
} catch (e) { /* fichier absent */ }

// 2b. composants-scraping-report.md — extraire les lignes de tableau Markdown
// Format: | Nom DB | ASIN Amazon | ...
try {
  const mdTxt = fs.readFileSync(SCRAPING_MD, 'utf8');
  const tableRows = mdTxt.match(/^\|[^|]+\|[^|]+\|/gm) || [];
  for (const row of tableRows) {
    const cols = row.split('|').map(s => s.trim()).filter(Boolean);
    if (cols.length >= 2) {
      const name = cols[0].toLowerCase();
      const asin = cols[1].trim();
      // ASIN = 10 chars alphanumériques commençant par B
      if (/^B[A-Z0-9]{9}$/.test(asin)) {
        asinMap.set(name, asin);
        // Aussi indexer les mots individuels du nom pour matching partiel
        for (const word of name.split(/\s+/)) {
          if (word.length > 3) asinMap.set(word, asin);
        }
      }
    }
  }
} catch (e) { /* fichier absent */ }

// 2c. ASINs manuels connus pour les reconditionnés (depuis asins.json)
const MANUAL_ASINS = {
  'ThinkPad T480': 'B0916TZGJH',
  'Latitude 5400': 'B0F6T9V2NN',
  'OptiPlex 7060': 'B0G1C334YW',
};

// ASINs depuis le rapport de scraping (composants)
const SCRAPING_ASINS = {
  'Core i3-12100F':  'B09QG131DT',
  'Core i5-12400F':  'B09NPJRDGD',
  'Core i5-13600K':  'B0BS98MM6K',
  'Ryzen 5 5600X':   'B08166SLDF',
  'Ryzen 7 5800X3D': 'B09VCJ2SHD',
  // GPUs
  'RTX 3060':        'B08W8BN7YS',
  'RTX 3060 Ti':     'B09G93H8BT',
  'RTX 4060':        'B0C3WFKDXR',
  'RTX 4070':        'B0C3WFHMC7',
  'RX 6600 XT':      'B09BMMMHSW',
  // RAM
  'Vengeance LPX 16Go': 'B013V1ZTMC',
  'Ballistix 16Go': 'B083VDSP3G',
  'Fury Beast 32Go': 'B09MHX44XH',
  'Ripjaws V 32Go':  'B07XFM5KNL',
  'Trident Z Neo 32Go': 'B0BWGSGC1Q',
  // Cartes mères
  'B660M Pro RS': 'B09WBGJ2MK',
  'MAG B550M Mortar': 'B08CFSZLQH',
  'ROG Strix B550-F': 'B089W9QGR7',
  'Prime X570-P': 'B07SXF8GY3',
  'Z690 Aorus Elite': 'B09MLKCFMN',
  // Alimentations
  'Corsair RM750x': 'B079H6141W',
  'EVGA SuperNOVA 650 G6': 'B09MLJL95X',
  'Seasonic Focus GX-750': 'B082VWBD4P',
  'Be Quiet! Straight Power 11': 'B07D93N56X',
  'MSI MAG A650BN': 'B09ZWY3F1Y',
  // Boîtiers
  '4000D Airflow': 'B08C7BGV3D',
  'Focus 2 ATX': 'B095YBWDXT',
  'H510 Flow': 'B0D2MJT1FY',
  'O11 Dynamic EVO': 'B0CGM5HJM8',
  'Torrent': 'B08699B69Z',
  // Refroidissement
  'Hyper 212 Black': 'B07W6WQLHG',
  'NH-D15': 'B00L7UZMAK',
  'AIO 240mm': 'B07WSDLRVP',
  'Kraken X53': 'B08559NG7V',
  'Dark Rock Pro 4': 'B07BYDFHPM',
  // Essentiels montage
  'Pâte thermique Thermal Grizzly': 'B07HCS3KFN',
  'Tournevis iFixit': 'B078GF4DS3',
  'Antistatique': 'B07PD5FHK2',
};

// ── 3. Résolution ASIN par produit ─────────────────────────────────────────────

function findAsin(product) {
  // Priorité 1 : champ asin direct en DB
  if (product.asin && product.asin.trim()) return product.asin.trim();

  // Priorité 2 : image_source_payload (chercher un ASIN dedans)
  if (product.image_source_payload && product.image_source_payload.length > 0) {
    const payloadStr = JSON.stringify(product.image_source_payload);
    const asinInPayload = payloadStr.match(/B[A-Z0-9]{9}/g);
    if (asinInPayload && asinInPayload.length > 0) return asinInPayload[0];
  }

  // Priorité 3 : asins.json reconditionnés manuels
  for (const [keyword, asin] of Object.entries(MANUAL_ASINS)) {
    if (product.name.includes(keyword)) return asin;
  }

  // Priorité 4 : scraping composants — correspondance sur le nom
  for (const [keyword, asin] of Object.entries(SCRAPING_ASINS)) {
    if (product.name.toLowerCase().includes(keyword.toLowerCase())) return asin;
  }

  // Priorité 5 : map générale depuis MD + asins.json
  const nameLower = product.name.toLowerCase();
  for (const [key, asin] of asinMap.entries()) {
    if (nameLower.includes(key)) return asin;
  }

  // Aucun ASIN trouvé
  return null;
}

// ── 4. Construction de l'inventaire ───────────────────────────────────────────

const inventory = products.map(p => {
  const asin = findAsin(p);
  return {
    name: p.name,
    brand: p.brand || '',
    price_eur: parseFloat(p.price_eur) || 0,
    cat_name: p.cat_name || '',
    cat_slug: p.cat_slug || '',
    subcat_name: p.subcat_name || '',
    subcat_slug: p.subcat_slug || '',
    asin: asin || null,
    external_url: asin ? `https://www.amazon.fr/dp/${asin}` : null,
  };
});

// ── 5. Écriture de products-inventory.json ────────────────────────────────────

fs.writeFileSync(
  path.join(OUT_DIR, 'products-inventory.json'),
  JSON.stringify(inventory, null, 2),
  'utf8'
);

// ── 6. Génération HTML ────────────────────────────────────────────────────────

// Groupement par catégorie puis sous-catégorie
const byCategory = {};
for (const p of inventory) {
  const catKey = p.cat_name || 'Sans catégorie';
  const subcatKey = p.subcat_name || 'Sans sous-catégorie';
  if (!byCategory[catKey]) byCategory[catKey] = {};
  if (!byCategory[catKey][subcatKey]) byCategory[catKey][subcatKey] = [];
  byCategory[catKey][subcatKey].push(p);
}

const totalProducts = inventory.length;
const withLink = inventory.filter(p => p.external_url).length;
const withoutLink = totalProducts - withLink;

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderTable(products) {
  const rows = products.map(p => {
    const link = p.external_url
      ? `<a href="${escHtml(p.external_url)}" target="_blank" rel="noopener" class="btn-buy">Acheter</a>`
      : `<span class="missing">À compléter</span>`;
    return `        <tr data-name="${escHtml(p.name.toLowerCase())}">
          <td class="td-name">${escHtml(p.name)}</td>
          <td class="td-brand">${escHtml(p.brand)}</td>
          <td class="td-price">${p.price_eur > 0 ? p.price_eur.toFixed(2) + ' €' : '—'}</td>
          <td class="td-link">${link}</td>
        </tr>`;
  }).join('\n');
  return `      <table class="product-table">
        <thead>
          <tr><th>Produit</th><th>Marque</th><th>Prix EUR</th><th>Lien externe</th></tr>
        </thead>
        <tbody>
${rows}
        </tbody>
      </table>`;
}

function renderCategories() {
  return Object.entries(byCategory).map(([cat, subcats]) => {
    const catTotal = Object.values(subcats).flat().length;
    const subcatHtml = Object.entries(subcats).map(([subcat, prods]) => {
      return `    <section class="subcat-section">
      <h3 class="subcat-title">${escHtml(subcat)} <span class="count">${prods.length} produit${prods.length > 1 ? 's' : ''}</span></h3>
${renderTable(prods)}
    </section>`;
    }).join('\n');

    return `  <section class="cat-section">
    <h2 class="cat-title">${escHtml(cat)} <span class="count cat-count">${catTotal} produit${catTotal > 1 ? 's' : ''}</span></h2>
${subcatHtml}
  </section>`;
  }).join('\n');
}

const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Inventaire produits — Alkamar Info</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0f172a;
      color: #e2e8f0;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 14px;
      line-height: 1.5;
      min-height: 100vh;
    }

    /* ── Header ── */
    header {
      background: #1e293b;
      border-bottom: 1px solid #334155;
      padding: 20px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
    }
    header h1 {
      font-size: 20px;
      font-weight: 700;
      color: #f8fafc;
      letter-spacing: -0.02em;
    }
    header .subtitle {
      font-size: 12px;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* ── Stats bar ── */
    .stats-bar {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      padding: 16px 32px;
      background: #1e293b;
      border-bottom: 1px solid #334155;
    }
    .stat-card {
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 8px;
      padding: 10px 18px;
      min-width: 140px;
      text-align: center;
    }
    .stat-card .num {
      font-size: 24px;
      font-weight: 700;
      display: block;
    }
    .stat-card .lbl {
      font-size: 11px;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .stat-card.total .num { color: #60a5fa; }
    .stat-card.ok .num    { color: #34d399; }
    .stat-card.missing .num { color: #f87171; }

    /* ── Search ── */
    .search-bar {
      padding: 16px 32px;
      background: #0f172a;
      border-bottom: 1px solid #1e293b;
    }
    .search-bar input {
      width: 100%;
      max-width: 400px;
      background: #1e293b;
      border: 1px solid #334155;
      border-radius: 8px;
      color: #e2e8f0;
      padding: 8px 14px;
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    .search-bar input:focus {
      border-color: #60a5fa;
    }
    .search-bar input::placeholder { color: #475569; }

    /* ── Content ── */
    main {
      padding: 24px 32px;
      max-width: 1400px;
      margin: 0 auto;
    }

    /* ── Catégorie ── */
    .cat-section {
      margin-bottom: 36px;
    }
    .cat-title {
      font-size: 18px;
      font-weight: 700;
      color: #f8fafc;
      padding: 10px 14px;
      background: #1e293b;
      border-left: 4px solid #60a5fa;
      border-radius: 4px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* ── Sous-catégorie ── */
    .subcat-section {
      margin-bottom: 20px;
      margin-left: 12px;
    }
    .subcat-title {
      font-size: 14px;
      font-weight: 600;
      color: #94a3b8;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    /* ── Count badges ── */
    .count {
      font-size: 11px;
      font-weight: 500;
      background: #334155;
      color: #94a3b8;
      padding: 2px 8px;
      border-radius: 12px;
    }
    .cat-count {
      background: #1e3a5f;
      color: #60a5fa;
    }

    /* ── Table ── */
    .product-table {
      width: 100%;
      border-collapse: collapse;
      background: #1e293b;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid #334155;
    }
    .product-table th {
      background: #0f172a;
      color: #64748b;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #334155;
    }
    .product-table td {
      padding: 9px 14px;
      border-bottom: 1px solid #1a2744;
      vertical-align: middle;
    }
    .product-table tr:last-child td { border-bottom: none; }
    .product-table tr:hover td { background: #243555; }
    .product-table tr.hidden { display: none; }

    .td-name { font-weight: 500; color: #e2e8f0; }
    .td-brand { color: #94a3b8; }
    .td-price { font-variant-numeric: tabular-nums; color: #7dd3fc; }
    .td-link { white-space: nowrap; }

    /* ── Buttons ── */
    .btn-buy {
      display: inline-block;
      background: #1e3a5f;
      color: #60a5fa;
      border: 1px solid #2563eb;
      border-radius: 5px;
      padding: 3px 12px;
      font-size: 12px;
      font-weight: 600;
      text-decoration: none;
      transition: background 0.15s, color 0.15s;
    }
    .btn-buy:hover {
      background: #2563eb;
      color: #fff;
    }
    .missing {
      color: #f87171;
      font-size: 12px;
      font-style: italic;
    }

    /* ── Footer ── */
    footer {
      text-align: center;
      padding: 20px;
      color: #475569;
      font-size: 12px;
      border-top: 1px solid #1e293b;
      margin-top: 24px;
    }
  </style>
</head>
<body>

<header>
  <div>
    <h1>Inventaire produits — Alkamar Info</h1>
    <div class="subtitle">Généré le ${new Date().toLocaleDateString('fr-FR', {day:'2-digit',month:'long',year:'numeric'})}</div>
  </div>
</header>

<div class="stats-bar">
  <div class="stat-card total">
    <span class="num">${totalProducts}</span>
    <span class="lbl">Produits total</span>
  </div>
  <div class="stat-card ok">
    <span class="num">${withLink}</span>
    <span class="lbl">Avec lien Amazon</span>
  </div>
  <div class="stat-card missing">
    <span class="num">${withoutLink}</span>
    <span class="lbl">Sans lien</span>
  </div>
</div>

<div class="search-bar">
  <input type="search" id="search-input" placeholder="Rechercher un produit..." autocomplete="off">
</div>

<main>
${renderCategories()}
</main>

<footer>
  Alkamar Info &mdash; Inventaire produits &mdash; ${totalProducts} produits &mdash; Données Supabase
</footer>

<script>
  const input = document.getElementById('search-input');
  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    document.querySelectorAll('tr[data-name]').forEach(row => {
      if (!q || row.dataset.name.includes(q)) {
        row.classList.remove('hidden');
      } else {
        row.classList.add('hidden');
      }
    });
    // Masquer les sections vides
    document.querySelectorAll('.subcat-section').forEach(sec => {
      const visible = sec.querySelectorAll('tr[data-name]:not(.hidden)').length;
      sec.style.display = visible === 0 && q ? 'none' : '';
    });
    document.querySelectorAll('.cat-section').forEach(sec => {
      const visible = sec.querySelectorAll('tr[data-name]:not(.hidden)').length;
      sec.style.display = visible === 0 && q ? 'none' : '';
    });
  });
</script>
</body>
</html>`;

fs.writeFileSync(path.join(OUT_DIR, 'products-inventory.html'), html, 'utf8');

// ── 7. Rapport console ────────────────────────────────────────────────────────

console.log('=== RAPPORT INVENTAIRE ===');
console.log(`Total produits : ${totalProducts}`);
console.log(`Avec ASIN/lien : ${withLink}`);
console.log(`Sans lien      : ${withoutLink}`);
console.log('');
console.log('--- Produits avec ASIN connu ---');
inventory.filter(p => p.asin).forEach(p => {
  console.log(`  [${p.asin}] ${p.name} (${p.cat_name} > ${p.subcat_name})`);
});
console.log('');
console.log('--- Produits sans ASIN ---');
inventory.filter(p => !p.asin).forEach(p => {
  console.log(`  [ À compléter ] ${p.name} (${p.cat_name} > ${p.subcat_name})`);
});
console.log('');
console.log('Fichiers générés :');
console.log('  C:/Users/defis/alkamar-info/data/products-inventory.json');
console.log('  C:/Users/defis/alkamar-info/data/products-inventory.html');
