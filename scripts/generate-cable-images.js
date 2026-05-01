// scripts/generate-cable-images.js
// Génère des images produit professionnelles pour les câbles réseau
// Les uploade dans Supabase Storage et met à jour la base

const path = require('path');
const sharp = require('sharp');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Génère une image produit cable/réseau via SVG + Sharp
function buildSVG(config) {
  const { label, subtitle, color1, color2, icon, brand } = config;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f8fafc"/>
        <stop offset="100%" style="stop-color:#e2e8f0"/>
      </linearGradient>
      <linearGradient id="card" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:${color1}"/>
        <stop offset="100%" style="stop-color:${color2}"/>
      </linearGradient>
    </defs>

    <!-- Fond -->
    <rect width="800" height="600" fill="url(#bg)" rx="16"/>

    <!-- Carte produit centrale -->
    <rect x="80" y="60" width="640" height="480" rx="20" fill="white" filter="url(#shadow)"/>
    <filter id="shadow"><feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#00000022"/></filter>

    <!-- Bande couleur top -->
    <rect x="80" y="60" width="640" height="8" rx="20" fill="url(#card)"/>

    <!-- Icône câble ou testeur -->
    ${icon}

    <!-- Badge catégorie -->
    <rect x="120" y="100" width="140" height="28" rx="14" fill="url(#card)"/>
    <text x="190" y="119" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="white" letter-spacing="1">${brand}</text>

    <!-- Nom produit -->
    <text x="400" y="390" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="800" fill="#0f172a">${label}</text>
    <text x="400" y="425" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#64748b">${subtitle}</text>

    <!-- Spec pills -->
    <rect x="220" y="450" width="160" height="32" rx="16" fill="#f1f5f9"/>
    <text x="300" y="471" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#1e3a8a">Gigabit 1000 Mbps</text>
    <rect x="420" y="450" width="160" height="32" rx="16" fill="#f1f5f9"/>
    <text x="500" y="471" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#1e3a8a">Plug &amp; Play</text>
  </svg>`;
}

const CABLE_ICON = `
  <!-- Câble stylisé -->
  <rect x="160" y="180" width="480" height="12" rx="6" fill="#cbd5e1"/>
  <rect x="160" y="190" width="480" height="4" rx="2" fill="#94a3b8" opacity="0.5"/>
  <!-- Connecteur gauche -->
  <rect x="140" y="168" width="36" height="36" rx="4" fill="#334155"/>
  <rect x="148" y="172" width="20" height="28" rx="2" fill="#475569"/>
  <rect x="152" y="176" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="158" y="176" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="164" y="176" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="152" y="181" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="158" y="181" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="164" y="181" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="152" y="186" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="158" y="186" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="164" y="186" width="4" height="3" rx="1" fill="#94a3b8"/>
  <!-- Connecteur droit -->
  <rect x="624" y="168" width="36" height="36" rx="4" fill="#334155"/>
  <rect x="632" y="172" width="20" height="28" rx="2" fill="#475569"/>
  <rect x="636" y="176" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="642" y="176" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="648" y="176" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="636" y="181" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="642" y="181" width="4" height="3" rx="1" fill="#94a3b8"/>
  <rect x="648" y="181" width="4" height="3" rx="1" fill="#94a3b8"/>
  <!-- Câble torsadé effect -->
  <path d="M200,186 q20,-12 40,0 q20,12 40,0 q20,-12 40,0 q20,12 40,0 q20,-12 40,0 q20,12 40,0 q20,-12 40,0 q20,12 40,0" stroke="#a0aec0" stroke-width="3" fill="none" opacity="0.6"/>`;

const TESTER_ICON = `
  <!-- Testeur câble réseau -->
  <rect x="290" y="140" width="220" height="160" rx="12" fill="#1e293b"/>
  <rect x="300" y="150" width="200" height="80" rx="8" fill="#0f172a"/>
  <!-- LED indicators -->
  <circle cx="330" cy="175" r="8" fill="#22c55e"/>
  <circle cx="355" cy="175" r="8" fill="#22c55e"/>
  <circle cx="380" cy="175" r="8" fill="#f59e0b"/>
  <circle cx="405" cy="175" r="8" fill="#22c55e"/>
  <circle cx="430" cy="175" r="8" fill="#22c55e"/>
  <circle cx="455" cy="175" r="8" fill="#ef4444"/>
  <circle cx="480" cy="175" r="8" fill="#22c55e"/>
  <circle cx="330" cy="205" r="8" fill="#22c55e" opacity="0.3"/>
  <circle cx="355" cy="205" r="8" fill="#22c55e"/>
  <circle cx="380" cy="205" r="8" fill="#22c55e"/>
  <circle cx="405" cy="205" r="8" fill="#f59e0b"/>
  <circle cx="430" cy="205" r="8" fill="#22c55e"/>
  <circle cx="455" cy="205" r="8" fill="#22c55e"/>
  <circle cx="480" cy="205" r="8" fill="#22c55e"/>
  <!-- Port RJ45 -->
  <rect x="340" y="260" width="50" height="30" rx="4" fill="#334155"/>
  <rect x="350" y="265" width="30" height="20" rx="2" fill="#0f172a"/>
  <rect x="420" y="260" width="50" height="30" rx="4" fill="#334155"/>
  <rect x="430" y="265" width="30" height="20" rx="2" fill="#0f172a"/>
  <!-- Label TESTER -->
  <text x="400" y="245" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="#94a3b8" letter-spacing="2">CABLE TESTER</text>`;

// ── Définition des 5 produits câbles ────────────────────────────────────────
const PRODUCTS = [
  {
    id       : '9c8f3554-ddc2-4b74-acc9-0715d5655ccf',
    slug     : 'cable-rj45-cat6-plat-20m',
    label    : 'Câble RJ45 Cat6 Plat',
    subtitle : '20 mètres — Ethernet Gigabit',
    brand    : 'Cat6',
    color1   : '#1e3a8a', color2: '#3b82f6',
    icon     : CABLE_ICON,
  },
  {
    id       : '459aed6c-3472-4676-b06d-767ac0cb3fc1',
    slug     : 'cable-rj45-cat6a-10m',
    label    : 'Câble RJ45 Cat6A',
    subtitle : '10 mètres — 10 Gbps',
    brand    : 'Cat6A',
    color1   : '#0f766e', color2: '#14b8a6',
    icon     : CABLE_ICON,
  },
  {
    id       : 'cb8506e6-6382-4ffd-9377-c004d8a650f9',
    slug     : 'cable-rj45-cat8-2m',
    label    : 'Câble RJ45 Cat8',
    subtitle : '2 mètres — 40 Gbps Blindé',
    brand    : 'Cat8',
    color1   : '#7c3aed', color2: '#a855f7',
    icon     : CABLE_ICON,
  },
  {
    id       : 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c',
    slug     : 'testeur-rj45',
    label    : 'Testeur Câble RJ45/RJ11',
    subtitle : 'Détection de câblage défectueux',
    brand    : 'Testeur',
    color1   : '#b45309', color2: '#f59e0b',
    icon     : TESTER_ICON,
  },
  {
    // 5ème produit : déplacer Amazon Basics Cat6 5m → cable
    id       : '0438f76f-65ec-4d15-ab3d-a9cebe50b9b5',
    slug     : 'cable-rj45-cat6-5m',
    label    : 'Câble RJ45 Cat6',
    subtitle : '5 mètres — Gigabit Ethernet',
    brand    : 'Cat6',
    color1   : '#1e3a8a', color2: '#60a5fa',
    icon     : CABLE_ICON,
    move_to_cable: true, // Changer la catégorie
  },
];

const CABLE_CAT_ID = '746fd402-03a0-4408-8b90-895d4da85cf0';

async function uploadImg(svg, storagePath) {
  const buf = await sharp(Buffer.from(svg)).png({ quality: 90 }).toBuffer();
  const { error } = await sb.storage.from('products').upload(storagePath, buf, {
    contentType: 'image/png', upsert: true, cacheControl: '31536000',
  });
  if (error) throw error;
  return sb.storage.from('products').getPublicUrl(storagePath).data.publicUrl;
}

async function run() {
  console.log('\n🖼️  Génération images câbles réseau\n' + '─'.repeat(50));

  for (const p of PRODUCTS) {
    console.log(`\n📦 ${p.label} (${p.subtitle})`);

    // Génère image principale
    const svg1 = buildSVG(p);
    const path1 = `reseau/${p.slug}-1.png`;

    let url1;
    try {
      url1 = await uploadImg(svg1, path1);
      console.log(`  ✅ Uploadé: ${url1.slice(0,70)}`);
    } catch(e) {
      console.log(`  ❌ Upload échoué: ${e.message}`);
      continue;
    }

    // Update DB
    const update = {
      main_image_url: url1,
      image         : url1,
      gallery_urls  : [url1],
      gallery       : [url1],
      updated_at    : new Date().toISOString(),
    };
    if (p.move_to_cable) {
      update.category_id = CABLE_CAT_ID;
      console.log(`  🔀 Déplacé vers catégorie câble`);
    }

    const { error } = await sb.from('products').update(update).eq('id', p.id);
    if (error) console.log(`  ❌ DB: ${error.message}`);
    else console.log(`  💾 Mis à jour en base`);
  }

  console.log('\n✅ Terminé\n');
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
