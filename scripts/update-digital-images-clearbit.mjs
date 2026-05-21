// scripts/update-digital-images-clearbit.mjs
// Remplace toutes les images Wikipedia par Clearbit Logo API (logos officiels, fiables)
// + ajoute 8 nouveaux produits pour avoir 5 par onglet
// Usage : node scripts/update-digital-images-clearbit.mjs

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

// Clearbit Logo API — logos officiels HD, CDN global, gratuit
const C = {
  microsoft:    'https://logo.clearbit.com/microsoft.com',
  windows:      'https://logo.clearbit.com/microsoft.com',
  norton:       'https://logo.clearbit.com/norton.com',
  kaspersky:    'https://logo.clearbit.com/kaspersky.com',
  bitdefender:  'https://logo.clearbit.com/bitdefender.com',
  eset:         'https://logo.clearbit.com/eset.com',
  canva:        'https://logo.clearbit.com/canva.com',
  grammarly:    'https://logo.clearbit.com/grammarly.com',
  nordvpn:      'https://logo.clearbit.com/nordvpn.com',
  dropbox:      'https://logo.clearbit.com/dropbox.com',
  lastpass:     'https://logo.clearbit.com/lastpass.com',
  adobe:        'https://logo.clearbit.com/adobe.com',
  zoom:         'https://logo.clearbit.com/zoom.us',
  acronis:      'https://logo.clearbit.com/acronis.com',
  malwarebytes: 'https://logo.clearbit.com/malwarebytes.com',
  bitwarden:    'https://logo.clearbit.com/bitwarden.com',
  nero:         'https://logo.clearbit.com/nero.com',
  iobit:        'https://logo.clearbit.com/iobit.com',
  easeus:       'https://logo.clearbit.com/easeus.com',
  winrar:       'https://logo.clearbit.com/rarlab.com',
  ccleaner:     'https://logo.clearbit.com/ccleaner.com',
  avast:        'https://logo.clearbit.com/avast.com',
  notion:       'https://logo.clearbit.com/notion.so',
  proton:       'https://logo.clearbit.com/proton.me',
  auslogics:    'https://logo.clearbit.com/auslogics.com',
  infoexperts:  'https://logo.clearbit.com/microsoft.com',
};

// ── Mise à jour images tous les produits existants ────────────────────────────
const IMAGE_UPDATES = [
  // Licences Windows
  { slug: 'windows-11-home-licence',                image: C.microsoft,    gallery: [C.windows]    },
  { slug: 'windows-11-pro-licence',                 image: C.microsoft,    gallery: [C.windows]    },
  { slug: 'windows-10-pro-licence',                 image: C.microsoft,    gallery: [C.windows]    },
  { slug: 'office-2024-professionnel-plus',         image: C.microsoft,    gallery: [C.adobe]      },
  // Microsoft 365 / Office
  { slug: 'microsoft-365-personnel-1an',            image: C.microsoft,    gallery: [C.microsoft]  },
  { slug: 'microsoft-365-famille-1an',              image: C.microsoft,    gallery: [C.microsoft]  },
  { slug: 'office-2024-famille-etudiant',           image: C.microsoft,    gallery: [C.microsoft]  },
  // Antivirus
  { slug: 'norton-360-standard-1an',                image: C.norton,       gallery: [C.norton]     },
  { slug: 'kaspersky-standard-3-appareils-1an',     image: C.kaspersky,    gallery: [C.kaspersky]  },
  { slug: 'bitdefender-total-security-5-appareils', image: C.bitdefender,  gallery: [C.bitdefender]},
  { slug: 'eset-nod32-antivirus-1an',               image: C.eset,         gallery: [C.eset]       },
  // Outils IA
  { slug: 'canva-pro-mensuel',                      image: C.canva,        gallery: [C.canva]      },
  { slug: 'canva-pro-annuel',                       image: C.canva,        gallery: [C.canva]      },
  { slug: 'grammarly-premium-mensuel',              image: C.grammarly,    gallery: [C.grammarly]  },
  { slug: 'adobe-express-premium-mensuel',          image: C.adobe,        gallery: [C.adobe]      },
  // SaaS / Cloud
  { slug: 'nordvpn-standard-1an',                   image: C.nordvpn,      gallery: [C.nordvpn]    },
  { slug: 'dropbox-plus-2to-1an',                   image: C.dropbox,      gallery: [C.dropbox]    },
  { slug: 'lastpass-premium-1an',                   image: C.lastpass,     gallery: [C.lastpass]   },
  { slug: 'bitwarden-premium-1an',                  image: C.bitwarden,    gallery: [C.bitwarden]  },
  // Abonnements
  { slug: 'adobe-creative-cloud-all-apps-mensuel',  image: C.adobe,        gallery: [C.adobe]      },
  { slug: 'zoom-pro-annuel',                        image: C.zoom,         gallery: [C.zoom]       },
  // Logiciels
  { slug: 'malwarebytes-premium-3-appareils-1an',   image: C.malwarebytes, gallery: [C.malwarebytes]},
  { slug: 'winrar-7-licence',                       image: C.winrar,       gallery: [C.winrar]     },
  { slug: 'ccleaner-professional-1an',              image: C.ccleaner,     gallery: [C.ccleaner]   },
  // Téléchargements
  { slug: 'easeus-todo-backup-pro-1an',             image: C.easeus,       gallery: [C.easeus]     },
  { slug: 'acronis-cyber-protect-home-1an',         image: C.acronis,      gallery: [C.acronis]    },
  { slug: 'iobit-driver-booster-pro-1an',           image: C.iobit,        gallery: [C.iobit]      },
  { slug: 'nero-platinum-suite-1an',                image: C.nero,         gallery: [C.nero]       },
  // Premium
  { slug: 'pack-essentiel-pc',                      image: C.microsoft,    gallery: [C.norton]     },
  { slug: 'pack-securite-total',                    image: C.bitdefender,  gallery: [C.nordvpn]    },
  { slug: 'pack-creatif-pro',                       image: C.canva,        gallery: [C.grammarly]  },
  { slug: 'pack-teletravail-pro',                   image: C.microsoft,    gallery: [C.zoom]       },
];

// ── 8 nouveaux produits pour passer à 5 par onglet ───────────────────────────
const NEW_PRODUCTS = [
  // licences +1
  {
    name: 'Windows 11 Pro — 3 PC',
    subtitle: 'Licence OEM 3 utilisateurs',
    slug: 'windows-11-pro-3pc',
    description: 'Windows 11 Pro en lot de 3 licences OEM. Idéal pour équiper plusieurs postes en entreprise ou famille. 3 clés distinctes livrées par email, activation immédiate.',
    price_eur: 79.90, price_kmf: Math.round(79.90 * KMF),
    price_old: 99.00,
    badge: '-19%', badge_class: 'badge--promo',
    brand: 'Microsoft', rating: 4, rating_count: 612,
    product_type: 'one_time', digital_category: 'licences', max_devices: 3,
    specs: { Type: 'OEM Numérique x3', Appareils: '3 PC', Économie: '19 €' },
    image: C.microsoft, gallery: [C.microsoft],
  },
  // abonnements +1
  {
    name: 'Microsoft 365 Business Basic',
    subtitle: 'PME · 1 utilisateur, 1 an',
    slug: 'microsoft-365-business-basic-1an',
    description: 'Microsoft 365 Business Basic pour TPE/PME. Apps web Office, Teams, Exchange (boîte mail pro), SharePoint et OneDrive 1 To. Idéal pour les entrepreneurs et petites équipes.',
    price_eur: 72.00, price_kmf: Math.round(72.00 * KMF),
    badge: 'Business', badge_class: 'badge--new',
    brand: 'Microsoft', rating: 4, rating_count: 2341,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'abonnements', max_devices: 5,
    specs: { Durée: '1 an', Apps: 'Teams · Exchange · SharePoint', Stockage: '1 To' },
    image: C.microsoft, gallery: [C.microsoft],
  },
  // logiciels +1
  {
    name: 'Avast Cleanup Premium',
    subtitle: 'Optimisation PC — 1 appareil, 1 an',
    slug: 'avast-cleanup-premium-1an',
    description: 'Avast Cleanup Premium supprime les applications inutiles, nettoie le registre et libère de l\'espace disque. Mise en veille automatique des programmes gourmands pour un PC toujours rapide.',
    price_eur: 29.99, price_kmf: Math.round(29.99 * KMF),
    price_old: 39.99,
    badge: '-25%', badge_class: 'badge--promo',
    brand: 'Avast', rating: 4, rating_count: 3142,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'logiciels', max_devices: 1,
    specs: { Durée: '1 an', Appareils: '1 PC', Fonctions: 'Nettoyage · Optimisation · Hibernation' },
    image: C.avast, gallery: [C.avast],
  },
  // antivirus +1
  {
    name: 'Avast One Individual',
    subtitle: 'Antivirus + VPN + protection identité — 1 an',
    slug: 'avast-one-individual-1an',
    description: 'Avast One Individual — antivirus primé, VPN illimité et surveillance de l\'identité en ligne en un seul abonnement. Protection complète sur tous vos appareils Windows, Mac, iOS et Android.',
    price_eur: 49.99, price_kmf: Math.round(49.99 * KMF),
    price_old: 69.99,
    badge: '-29%', badge_class: 'badge--promo',
    brand: 'Avast', rating: 4, rating_count: 5234,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'antivirus', max_devices: 5,
    specs: { Durée: '1 an', Appareils: '5', Inclus: 'Antivirus + VPN illimité + ID protection' },
    image: C.avast, gallery: [C.avast],
  },
  // outils-ia +1
  {
    name: 'Notion AI — Pro',
    subtitle: 'IA dans votre espace de travail — 1 mois',
    slug: 'notion-ai-pro-mensuel',
    description: 'Notion AI + Plan Pro — rédaction IA, résumés automatiques, traduction et extraction d\'informations directement dans votre workspace Notion. Bases de données, wikis d\'équipe et outils IA réunis.',
    price_eur: 16.00, price_kmf: Math.round(16.00 * KMF),
    badge: null, badge_class: null,
    brand: 'Notion', rating: 4, rating_count: 4521,
    product_type: 'subscription', billing_period: 'monthly', digital_category: 'outils-ia', max_devices: 1,
    specs: { Type: 'Abonnement mensuel', IA: 'Rédaction + Résumé + Traduction', Stockage: 'Illimité' },
    image: C.notion, gallery: [C.notion],
  },
  // saas +1
  {
    name: 'Proton Pass Plus',
    subtitle: 'Gestionnaire de mots de passe chiffré — 1 an',
    slug: 'proton-pass-plus-1an',
    description: 'Proton Pass Plus — gestionnaire de mots de passe open source avec chiffrement E2E, masques email pour préserver votre vie privée, 2FA intégré et surveillance des fuites de données.',
    price_eur: 23.88, price_kmf: Math.round(23.88 * KMF),
    badge: 'Privé', badge_class: 'badge--new',
    brand: 'Proton', rating: 4, rating_count: 3201,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'saas', max_devices: 999,
    specs: { Durée: '1 an', Appareils: 'Illimité', 'Email masqués': '10 inclus' },
    image: C.proton, gallery: [C.proton],
  },
  // telechargements +1
  {
    name: 'Auslogics BoostSpeed Pro',
    subtitle: 'Accélérateur PC complet — 1 an',
    slug: 'auslogics-boostspeed-pro-1an',
    description: 'Auslogics BoostSpeed Pro accélère votre PC en supprimant les fichiers inutiles, corrigeant les erreurs registre et optimisant les paramètres Windows. Interface simple, résultats immédiats.',
    price_eur: 39.95, price_kmf: Math.round(39.95 * KMF),
    price_old: 49.95,
    badge: '-20%', badge_class: 'badge--promo',
    brand: 'Auslogics', rating: 4, rating_count: 2198,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'telechargements', max_devices: 1,
    specs: { Durée: '1 an', Appareils: '1 PC', Fonctions: 'Boost · Nettoyage · Registre' },
    image: C.auslogics, gallery: [C.auslogics],
  },
  // premium +1
  {
    name: 'Pack Gaming & Création',
    subtitle: 'Windows 11 Pro + Canva Pro + NordVPN — 1 an',
    slug: 'pack-gaming-creation',
    description: 'Pack Gaming & Création — Windows 11 Pro (licence OEM), Canva Pro annuel pour vos créas, NordVPN Standard 1 an pour jouer en sécurité et accéder à tous les contenus. 3 clés email.',
    price_eur: 169.90, price_kmf: Math.round(169.90 * KMF),
    price_old: 220.89,
    badge: '-23%', badge_class: 'badge--promo',
    brand: 'Info Experts', rating: 5, rating_count: 47,
    product_type: 'one_time', digital_category: 'premium', max_devices: 1,
    specs: { Contenu: 'Win11 Pro + Canva Pro + NordVPN', Durée: '1 an (Canva + VPN)', Économie: '51 €' },
    image: C.microsoft, gallery: [C.canva],
  },
];

async function getOrCreateCategory() {
  const { data } = await sb.from('categories').select('id').eq('slug', 'digital').single();
  if (data) return data.id;
  const { data: d } = await sb.from('categories').insert({ name: 'Produits Digitaux', slug: 'digital', icon: '💿', sort_order: 99 }).select('id').single();
  return d.id;
}

async function run() {
  console.log('🖼️  Mise à jour images → Clearbit...');
  let imgOk = 0;
  for (const u of IMAGE_UPDATES) {
    const { error } = await sb.from('products').update({ image: u.image, gallery: u.gallery }).eq('slug', u.slug);
    if (error) console.error(`  ❌ ${u.slug}: ${error.message}`);
    else { console.log(`  ✅ ${u.slug}`); imgOk++; }
  }
  console.log(`\n✅ ${imgOk} images mises à jour\n`);

  console.log('🆕 Ajout 8 nouveaux produits (5 par onglet)...');
  const catId = await getOrCreateCategory();
  let nOk = 0;
  for (const p of NEW_PRODUCTS) {
    const { data: ex } = await sb.from('products').select('id').eq('slug', p.slug).single();
    if (ex) { console.log(`  ⏭  ${p.slug}`); continue; }
    const row = {
      name: p.name, subtitle: p.subtitle, slug: p.slug, description: p.description,
      price_eur: p.price_eur, price_kmf: p.price_kmf, price_old: p.price_old || null,
      badge: p.badge || null, badge_class: p.badge_class || null,
      brand: p.brand, rating: p.rating, rating_count: p.rating_count,
      stock: 9999, stock_label: 'Disponible', status: 'active', category_id: catId,
      features: [], specs: p.specs || {}, image: p.image, gallery: p.gallery || [],
      is_digital: true, product_type: p.product_type, billing_period: p.billing_period || null,
      max_devices: p.max_devices || 1, digital_category: p.digital_category, compatibility: [],
    };
    const { error } = await sb.from('products').insert(row);
    if (error) console.error(`  ❌ ${p.slug}: ${error.message}`);
    else { console.log(`  ✅ ${p.name}`); nOk++; }
  }
  console.log(`\n✅ ${nOk} nouveaux produits insérés`);

  // Vérification
  const { data } = await sb.from('products').select('digital_category').eq('is_digital', true).eq('status', 'active');
  const counts = {};
  (data || []).forEach(p => { counts[p.digital_category] = (counts[p.digital_category] || 0) + 1; });
  console.log('\n📊 Résultat final:');
  Object.entries(counts).sort().forEach(([k, v]) => console.log(`  ${k}: ${v} ${v >= 5 ? '✅' : '⚠️'}`));
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
