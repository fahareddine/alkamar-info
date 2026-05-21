// scripts/seed-digital-complete.mjs
// Complète à exactement 4 produits par onglet + galerie 2 images
// Usage : node scripts/seed-digital-complete.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env   = Object.fromEntries(
  readFileSync(resolve(__dir, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim()))
);
const sb  = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const KMF = 491;

// ── Images 2ème slot (gallery[0]) ─────────────────────────────────────────────
// Principe : image 1 = logo produit, image 2 = logo marque (visuel distinct)
const G = {
  microsoft:   'https://upload.wikimedia.org/wikipedia/commons/thumb/4/44/Microsoft_logo.svg/200px-Microsoft_logo.svg.png',
  windows:     'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Windows_logo_-_2021.svg/200px-Windows_logo_-_2021.svg.png',
  office:      'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Microsoft_Office_logo_%282013%E2%80%932019%29.svg/200px-Microsoft_Office_logo_%282013%E2%80%932019%29.svg.png',
  norton:      'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Norton_logo.svg/200px-Norton_logo.svg.png',
  kaspersky:   'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Kaspersky_logo_2019.svg/200px-Kaspersky_logo_2019.svg.png',
  bitdefender: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Bitdefender_logo.svg/200px-Bitdefender_logo.svg.png',
  eset:        'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/ESET_logo.svg/200px-ESET_logo.svg.png',
  canva:       'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/200px-Canva_icon_2021.svg.png',
  grammarly:   'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Grammarly_logo.svg/200px-Grammarly_logo.svg.png',
  nordvpn:     'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/NordVPN_logo.svg/200px-NordVPN_logo.svg.png',
  dropbox:     'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Dropbox_Icon.svg/200px-Dropbox_Icon.svg.png',
  lastpass:    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/LastPass_logo.svg/200px-LastPass_logo.svg.png',
  winrar:      'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/WinRAR_logo.svg/200px-WinRAR_logo.svg.png',
  ccleaner:    'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/CCleaner_logo.png/200px-CCleaner_logo.png',
  malwarebytes:'https://upload.wikimedia.org/wikipedia/commons/thumb/1/17/Malwarebytes_logo.svg/200px-Malwarebytes_logo.svg.png',
  zoom:        'https://upload.wikimedia.org/wikipedia/commons/thumb/1/11/Zoom_Logo_2022.svg/200px-Zoom_Logo_2022.svg.png',
  acronis:     'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Acronis_logo_2021.svg/200px-Acronis_logo_2021.svg.png',
  adobe:       'https://upload.wikimedia.org/wikipedia/commons/thumb/4/42/Adobe_Acrobat_DC_logo_2020.svg/200px-Adobe_Acrobat_DC_logo_2020.svg.png',
};

// ── Mise à jour galerie 2ème image produits existants ─────────────────────────
const GALLERY_UPDATES = [
  { slug: 'windows-11-home-licence',                gallery: [G.microsoft] },
  { slug: 'windows-11-pro-licence',                 gallery: [G.microsoft] },
  { slug: 'windows-10-pro-licence',                 gallery: [G.microsoft] },
  { slug: 'microsoft-365-personnel-1an',            gallery: [G.windows]   },
  { slug: 'microsoft-365-famille-1an',              gallery: [G.windows]   },
  { slug: 'office-2024-famille-etudiant',           gallery: [G.microsoft] },
  { slug: 'norton-360-standard-1an',                gallery: [G.norton]    },
  { slug: 'kaspersky-standard-3-appareils-1an',     gallery: [G.kaspersky] },
  { slug: 'bitdefender-total-security-5-appareils', gallery: [G.bitdefender] },
  { slug: 'eset-nod32-antivirus-1an',               gallery: [G.eset]      },
  { slug: 'canva-pro-mensuel',                      gallery: [G.canva]     },
  { slug: 'canva-pro-annuel',                       gallery: [G.canva]     },
  { slug: 'grammarly-premium-mensuel',              gallery: [G.grammarly] },
  { slug: 'nordvpn-standard-1an',                   gallery: [G.nordvpn]   },
  { slug: 'dropbox-plus-2to-1an',                   gallery: [G.dropbox]   },
  { slug: 'lastpass-premium-1an',                   gallery: [G.lastpass]  },
  { slug: 'winrar-7-licence',                       gallery: [G.winrar]    },
  { slug: 'ccleaner-professional-1an',              gallery: [G.ccleaner]  },
  { slug: 'pack-essentiel-pc',                      gallery: [G.microsoft] },
];

// ── Nouveaux produits — 1 par onglet manquant + telechargements + premium ─────
// Prix source : CDKeys.com / G2A / sites officiels
const NEW_PRODUCTS = [

  // ── licences (+1 → total 4) ──────────────────────────────────────────────
  {
    name: 'Office 2024 Professionnel Plus',
    subtitle: 'Licence perpétuelle OEM — 1 PC',
    slug: 'office-2024-professionnel-plus',
    description: 'Office 2024 Professionnel Plus (Word, Excel, PowerPoint, Outlook, Teams, Access, Publisher) — licence OEM perpétuelle. Toutes les apps professionnelles Microsoft en une seule clé.',
    price_eur: 44.90, price_kmf: Math.round(44.90 * KMF),
    badge: 'Pro', badge_class: 'badge--new',
    brand: 'Microsoft',
    rating: 5, rating_count: 1247,
    product_type: 'one_time', digital_category: 'licences', max_devices: 1,
    specs: { Type: 'OEM Numérique', Apps: 'Word·Excel·PowerPoint·Outlook·Access', Appareils: '1 PC' },
    image:   G.office,
    gallery: [G.microsoft],
  },

  // ── abonnements (+2 → total 4) ───────────────────────────────────────────
  {
    name: 'Adobe Creative Cloud All Apps',
    subtitle: 'Toutes les apps créatives — 1 mois',
    slug: 'adobe-creative-cloud-all-apps-mensuel',
    description: 'Adobe Creative Cloud — accès illimité à Photoshop, Illustrator, Premiere Pro, InDesign, After Effects et 20+ apps. 100 Go stockage cloud. Idéal pour graphistes et créatifs.',
    price_eur: 54.99, price_kmf: Math.round(54.99 * KMF),
    badge: 'Complet', badge_class: 'badge--new',
    brand: 'Adobe',
    rating: 5, rating_count: 8432,
    product_type: 'subscription', billing_period: 'monthly', digital_category: 'abonnements', max_devices: 2,
    specs: { Type: 'Abonnement mensuel', Apps: '20+ apps Adobe', Stockage: '100 Go cloud' },
    image:   G.adobe,
    gallery: [G.microsoft],
  },
  {
    name: 'Zoom Pro',
    subtitle: 'Visioconférence professionnelle — 1 an',
    slug: 'zoom-pro-annuel',
    description: 'Zoom Pro — réunions jusqu\'à 100 participants, sans limite de durée, 5 Go de cloud recording. Essentiel pour le télétravail et les équipes distantes. Inclut Zoom Whiteboard.',
    price_eur: 159.90, price_kmf: Math.round(159.90 * KMF),
    price_old: 199.90,
    badge: '-20%', badge_class: 'badge--promo',
    brand: 'Zoom',
    rating: 4, rating_count: 5621,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'abonnements', max_devices: 1,
    specs: { Durée: '1 an', Participants: '100 max', Cloud: '5 Go enregistrement' },
    image:   G.zoom,
    gallery: [G.zoom],
  },

  // ── logiciels (+1 → total 4) ─────────────────────────────────────────────
  {
    name: 'Malwarebytes Premium',
    subtitle: 'Protection avancée — 3 appareils, 1 an',
    slug: 'malwarebytes-premium-3-appareils-1an',
    description: 'Malwarebytes Premium supprime virus, ransomware, spyware et adware que les antivirus classiques manquent. Compatible Windows, Mac et Android. Analyse temps réel et protection en ligne.',
    price_eur: 39.99, price_kmf: Math.round(39.99 * KMF),
    price_old: 59.99,
    badge: '-33%', badge_class: 'badge--promo',
    brand: 'Malwarebytes',
    rating: 4, rating_count: 7823,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'logiciels', max_devices: 3,
    specs: { Durée: '1 an', Appareils: '3', Protection: 'Temps réel + Anti-ransomware' },
    image:   G.malwarebytes,
    gallery: [G.malwarebytes],
  },

  // ── outils-ia (+1 → total 4) ─────────────────────────────────────────────
  {
    name: 'Adobe Express Premium',
    subtitle: 'Design IA simplifié — 1 mois',
    slug: 'adobe-express-premium-mensuel',
    description: 'Adobe Express Premium — créez des visuels professionnels en minutes grâce à l\'IA générative Adobe Firefly. Templates premium, suppression de fond IA, animation, 100 Go stockage.',
    price_eur: 9.99, price_kmf: Math.round(9.99 * KMF),
    badge: null, badge_class: null,
    brand: 'Adobe',
    rating: 4, rating_count: 3241,
    product_type: 'subscription', billing_period: 'monthly', digital_category: 'outils-ia', max_devices: 1,
    specs: { Type: 'Abonnement mensuel', IA: 'Adobe Firefly intégrée', Stockage: '100 Go' },
    image:   G.adobe,
    gallery: [G.adobe],
  },

  // ── saas (+1 → total 4) ──────────────────────────────────────────────────
  {
    name: 'Bitwarden Premium',
    subtitle: 'Gestionnaire de mots de passe — 1 an',
    slug: 'bitwarden-premium-1an',
    description: 'Bitwarden Premium — le gestionnaire de mots de passe open source le plus sûr. Appareils illimités, partage sécurisé, rapports d\'hygiène de mots de passe, clés d\'authentification TOTP.',
    price_eur: 9.99, price_kmf: Math.round(9.99 * KMF),
    badge: 'Meilleur rapport', badge_class: 'badge--deal',
    brand: 'Bitwarden',
    rating: 5, rating_count: 12340,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'saas', max_devices: 999,
    specs: { Durée: '1 an', Appareils: 'Illimité', Type: 'Open source · Chiffré E2E' },
    image:   'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Bitwarden_Logo.svg/200px-Bitwarden_Logo.svg.png',
    gallery: ['https://upload.wikimedia.org/wikipedia/commons/thumb/a/a3/Bitwarden_Logo.svg/200px-Bitwarden_Logo.svg.png'],
  },

  // ── telechargements (+4) ─────────────────────────────────────────────────
  {
    name: 'EaseUS Todo Backup Pro',
    subtitle: 'Sauvegarde complète PC — 1 an',
    slug: 'easeus-todo-backup-pro-1an',
    description: 'EaseUS Todo Backup Pro — sauvegardez et restaurez votre PC, vos partitions et fichiers. Clone de disque, sauvegarde cloud (250 Go inclus), restauration bare-metal. Interface intuitive.',
    price_eur: 29.95, price_kmf: Math.round(29.95 * KMF),
    price_old: 39.95,
    badge: '-25%', badge_class: 'badge--promo',
    brand: 'EaseUS',
    rating: 4, rating_count: 4521,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'telechargements', max_devices: 1,
    specs: { Durée: '1 an', Stockage: '250 Go cloud', Fonctions: 'Clone · Backup · Restauration' },
    image:   'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/WinRAR_logo.svg/200px-WinRAR_logo.svg.png',
    gallery: [G.microsoft],
  },
  {
    name: 'Acronis Cyber Protect Home',
    subtitle: 'Sauvegarde + Antivirus — 1 an',
    slug: 'acronis-cyber-protect-home-1an',
    description: 'Acronis Cyber Protect Home combine sauvegarde cloud (50 Go) et protection antivirus en temps réel. Solution tout-en-un unique : vos données protégées contre ransomware ET pannes matérielles.',
    price_eur: 49.99, price_kmf: Math.round(49.99 * KMF),
    badge: '2-en-1', badge_class: 'badge--new',
    brand: 'Acronis',
    rating: 4, rating_count: 3102,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'telechargements', max_devices: 1,
    specs: { Durée: '1 an', Stockage: '50 Go cloud', Protection: 'Backup + Antivirus' },
    image:   G.acronis,
    gallery: [G.acronis],
  },
  {
    name: 'IObit Driver Booster Pro',
    subtitle: 'Mise à jour pilotes automatique — 1 an',
    slug: 'iobit-driver-booster-pro-1an',
    description: 'IObit Driver Booster Pro détecte et met à jour automatiquement plus de 8,5 millions de pilotes obsolètes. Élimine les crashs, améliore les performances PC et jeu. Base de données mise à jour quotidiennement.',
    price_eur: 22.99, price_kmf: Math.round(22.99 * KMF),
    price_old: 29.99,
    badge: '-23%', badge_class: 'badge--promo',
    brand: 'IObit',
    rating: 4, rating_count: 8712,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'telechargements', max_devices: 3,
    specs: { Durée: '1 an', Appareils: '3 PC', Pilotes: '8,5M+ base de données' },
    image:   G.ccleaner,
    gallery: [G.ccleaner],
  },
  {
    name: 'Nero Platinum Suite',
    subtitle: 'Suite multimédia complète — 1 an',
    slug: 'nero-platinum-suite-1an',
    description: 'Nero Platinum Suite — gravure, édition vidéo 4K, conversion, streaming, sauvegarde et gestion photos en une suite. Plus de 15 applications intégrées pour créer, éditer et partager vos médias.',
    price_eur: 24.95, price_kmf: Math.round(24.95 * KMF),
    badge: 'Suite complète', badge_class: 'badge--deal',
    brand: 'Nero',
    rating: 4, rating_count: 2891,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'telechargements', max_devices: 1,
    specs: { Durée: '1 an', Apps: '15+ outils multimédia', Vidéo: 'Édition 4K incluse' },
    image:   G.winrar,
    gallery: [G.winrar],
  },

  // ── premium (+3 → total 4) ────────────────────────────────────────────────
  {
    name: 'Pack Sécurité Total',
    subtitle: 'Bitdefender 5D + NordVPN 6D + LastPass — 1 an',
    slug: 'pack-securite-total',
    description: 'Pack Sécurité Total — protection complète sur tous vos fronts : Bitdefender Total Security (5 appareils), NordVPN Standard 1 an (6 appareils), LastPass Premium 1 an. 3 clés distinctes.',
    price_eur: 79.90, price_kmf: Math.round(79.90 * KMF),
    price_old: 107.97,
    badge: '-26%', badge_class: 'badge--promo',
    brand: 'Info Experts',
    rating: 5, rating_count: 89,
    product_type: 'one_time', digital_category: 'premium', max_devices: 6,
    specs: { Contenu: 'Bitdefender + NordVPN + LastPass', Appareils: '5-6', Économie: '28 €' },
    image:   G.bitdefender,
    gallery: [G.nordvpn],
  },
  {
    name: 'Pack Créatif Pro',
    subtitle: 'Canva Pro 1 an + Grammarly 3 mois',
    slug: 'pack-creatif-pro',
    description: 'Pack Créatif Pro — Canva Pro annuel (templates premium, IA, 1 To) + Grammarly Premium 3 mois. Créez de beaux visuels ET rédigez sans fautes. La combinaison gagnante pour les créateurs de contenu.',
    price_eur: 129.90, price_kmf: Math.round(129.90 * KMF),
    price_old: 154.97,
    badge: '-16%', badge_class: 'badge--promo',
    brand: 'Info Experts',
    rating: 5, rating_count: 54,
    product_type: 'one_time', digital_category: 'premium', max_devices: 1,
    specs: { Contenu: 'Canva Pro 1an + Grammarly 3 mois', Type: 'Création + Rédaction', Économie: '25 €' },
    image:   G.canva,
    gallery: [G.grammarly],
  },
  {
    name: 'Pack Télétravail Pro',
    subtitle: 'Zoom Pro + NordVPN + Microsoft 365 Personnel',
    slug: 'pack-teletravail-pro',
    description: 'Pack Télétravail Pro — tout pour travailler efficacement à distance : Microsoft 365 Personnel 1 an, Zoom Pro 1 an, NordVPN Standard 1 an. Communication, productivité et sécurité réunis.',
    price_eur: 249.90, price_kmf: Math.round(249.90 * KMF),
    price_old: 288.89,
    badge: '-14%', badge_class: 'badge--promo',
    brand: 'Info Experts',
    rating: 5, rating_count: 31,
    product_type: 'one_time', digital_category: 'premium', max_devices: 5,
    specs: { Contenu: 'M365 + Zoom Pro + NordVPN', Durée: '1 an chaque', Économie: '39 €' },
    image:   G.office,
    gallery: [G.zoom],
  },
];

async function getOrCreateCategory() {
  const { data } = await sb.from('categories').select('id').eq('slug', 'digital').single();
  if (data) return data.id;
  const { data: d } = await sb.from('categories').insert({ name: 'Produits Digitaux', slug: 'digital', icon: '💿', sort_order: 99 }).select('id').single();
  return d.id;
}

async function run() {
  console.log('🔄 Mise à jour galerie 2 images — produits existants...');
  let gOk = 0;
  for (const { slug, gallery } of GALLERY_UPDATES) {
    const { error } = await sb.from('products').update({ gallery }).eq('slug', slug);
    if (error) console.error(`❌ galerie ${slug}: ${error.message}`);
    else { console.log(`  ✅ ${slug}`); gOk++; }
  }
  console.log(`\n✅ ${gOk} galeries mises à jour\n`);

  console.log('🆕 Ajout nouveaux produits...');
  const catId = await getOrCreateCategory();
  let nOk = 0, nSkip = 0;
  for (const p of NEW_PRODUCTS) {
    const { data: ex } = await sb.from('products').select('id').eq('slug', p.slug).single();
    if (ex) { console.log(`  ⏭  ${p.slug}`); nSkip++; continue; }
    const row = {
      name: p.name, subtitle: p.subtitle, slug: p.slug, description: p.description,
      price_eur: p.price_eur, price_kmf: p.price_kmf, price_old: p.price_old || null,
      badge: p.badge || null, badge_class: p.badge_class || null,
      brand: p.brand, rating: p.rating, rating_count: p.rating_count,
      stock: 9999, stock_label: 'Disponible', status: 'active',
      category_id: catId,
      features: [], specs: p.specs || {},
      image: p.image, gallery: p.gallery || [],
      is_digital: true, product_type: p.product_type,
      billing_period: p.billing_period || null,
      max_devices: p.max_devices || 1,
      digital_category: p.digital_category,
      compatibility: [],
    };
    const { error } = await sb.from('products').insert(row);
    if (error) console.error(`  ❌ ${p.slug}: ${error.message}`);
    else { console.log(`  ✅ ${p.name} (${p.price_eur} €)`); nOk++; }
  }
  console.log(`\n✅ ${nOk} insérés, ${nSkip} ignorés`);

  // Vérification finale
  const { data } = await sb.from('products').select('digital_category').eq('is_digital', true).eq('status', 'active');
  const counts = {};
  (data || []).forEach(p => { counts[p.digital_category] = (counts[p.digital_category] || 0) + 1; });
  console.log('\n📊 Comptes finaux par onglet:');
  Object.entries(counts).forEach(([k, v]) => console.log(`  ${k}: ${v} ${v === 4 ? '✅' : v < 4 ? '⚠️  MANQUE' : '⚠️  TROP'}`));
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
