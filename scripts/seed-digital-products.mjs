// scripts/seed-digital-products.mjs
// Insère ~20 produits digitaux de démonstration dans Supabase.
// Exécuter après avoir appliqué la migration 015_digital_products.sql :
//   node scripts/seed-digital-products.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env   = Object.fromEntries(
  readFileSync(resolve(__dir, '../.env.local'), 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => l.split('=').map(s => s.trim()))
);

const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Catégorie "digital" dans Supabase (crée si absente)
async function getOrCreateCategory() {
  const { data: existing } = await sb
    .from('categories').select('id').eq('slug', 'digital').single();
  if (existing) return existing.id;
  const { data, error } = await sb.from('categories').insert({
    name: 'Produits Digitaux', slug: 'digital', icon: '💿', sort_order: 99,
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

const PRODUCTS = [
  // ── Windows Licences ────────────────────────────────────────────────────────
  {
    name: 'Windows 11 Home',
    subtitle: 'Licence numérique OEM — 1 PC',
    slug: 'windows-11-home-licence',
    description: 'Windows 11 Home en licence numérique OEM. Activation en ligne immédiate, 1 PC, livraison instantanée par email.',
    price_eur: 22.90, price_kmf: 11244,
    badge: 'Activation instantanée', badge_class: 'badge-new',
    product_type: 'one_time', digital_category: 'licences', max_devices: 1,
    file_version: null,
    compatibility: ['windows'],
    features: ['Activation en ligne immédiate','Clé valide à vie','Support Microsoft inclus','Compatible PC 64-bit'],
    specs: { Éditeur: 'Microsoft', Type: 'OEM', Appareils: '1 PC', Architecture: '64-bit', Langue: 'Multilingue', Livraison: 'Par email sous 5 min' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Windows_11_Home.png/200px-Windows_11_Home.png',
  },
  {
    name: 'Windows 11 Pro',
    subtitle: 'Licence numérique OEM — 1 PC',
    slug: 'windows-11-pro-licence',
    description: 'Windows 11 Pro avec BitLocker, Remote Desktop, Hyper-V et domaine Active Directory. Licence numérique OEM, 1 PC.',
    price_eur: 32.90, price_kmf: 16154,
    badge: 'Professionnel', badge_class: 'badge-pro',
    product_type: 'one_time', digital_category: 'licences', max_devices: 1,
    compatibility: ['windows'],
    features: ['BitLocker chiffrement','Remote Desktop intégré','Hyper-V virtualization','Azure AD Connect','Activation immédiate'],
    specs: { Éditeur: 'Microsoft', Type: 'OEM', Appareils: '1 PC', Architecture: '64-bit', Langue: 'Multilingue', Livraison: 'Par email sous 5 min' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Windows_logo_-_2021.svg/200px-Windows_logo_-_2021.svg.png',
  },
  {
    name: 'Windows 10 Pro',
    subtitle: 'Licence numérique OEM — 1 PC',
    slug: 'windows-10-pro-licence',
    description: 'Windows 10 Pro, licence numérique OEM. Compatible avec tous les PC modernes, activation en ligne.',
    price_eur: 18.90, price_kmf: 9280,
    badge: 'Populaire', badge_class: 'badge-hot',
    product_type: 'one_time', digital_category: 'licences', max_devices: 1,
    compatibility: ['windows'],
    features: ['Activation en ligne','Clé valide à vie','Mise à jour vers Win11 possible','Support étendu 2025'],
    specs: { Éditeur: 'Microsoft', Type: 'OEM', Appareils: '1 PC', Langue: 'Multilingue', Livraison: 'Par email sous 5 min' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Windows_logo_-_2021.svg/200px-Windows_logo_-_2021.svg.png',
  },

  // ── Microsoft 365 ────────────────────────────────────────────────────────────
  {
    name: 'Microsoft 365 Personnel',
    subtitle: 'Abonnement 1 an — 1 utilisateur, 5 appareils',
    slug: 'microsoft-365-personnel-1an',
    description: 'Microsoft 365 Personnel inclut Word, Excel, PowerPoint, Outlook, Teams, OneDrive 1 To. 1 utilisateur, 5 appareils simultanés.',
    price_eur: 59.00, price_kmf: 28969,
    price_old: 69.00,
    badge: '-14%', badge_class: 'badge-promo',
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'abonnements', max_devices: 5,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['Word, Excel, PowerPoint','1 To OneDrive','5 appareils simultanés','Mises à jour incluses','Support Microsoft 24h/7j'],
    specs: { Éditeur: 'Microsoft', Type: 'Abonnement', Durée: '1 an', Utilisateurs: '1', Appareils: '5', Stockage: '1 To OneDrive', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Microsoft_Office_logo_%282013%E2%80%932019%29.svg/200px-Microsoft_Office_logo_%282013%E2%80%932019%29.svg.png',
  },
  {
    name: 'Microsoft 365 Famille',
    subtitle: 'Abonnement 1 an — 6 utilisateurs, 5 appareils chacun',
    slug: 'microsoft-365-famille-1an',
    description: 'Microsoft 365 Famille pour 6 utilisateurs avec chacun 1 To de stockage OneDrive et accès sur 5 appareils.',
    price_eur: 79.00, price_kmf: 38789,
    price_old: 99.00,
    badge: 'Famille', badge_class: 'badge-new',
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'abonnements', max_devices: 30,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['6 utilisateurs inclus','1 To OneDrive par utilisateur','Applications Office complètes','Support prioritaire'],
    specs: { Éditeur: 'Microsoft', Type: 'Abonnement', Durée: '1 an', Utilisateurs: '6', Appareils: '5 par utilisateur', Stockage: '6 To total', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Microsoft_Office_logo_%282013%E2%80%932019%29.svg/200px-Microsoft_Office_logo_%282013%E2%80%932019%29.svg.png',
  },
  {
    name: 'Office 2024 Famille & Étudiant',
    subtitle: 'Licence perpétuelle — 1 PC ou Mac',
    slug: 'office-2024-famille-etudiant',
    description: 'Office 2024 Famille & Étudiant (Word, Excel, PowerPoint, OneNote) — licence perpétuelle sans abonnement.',
    price_eur: 149.00, price_kmf: 73159,
    badge: 'Perpétuel', badge_class: 'badge-pro',
    product_type: 'one_time', digital_category: 'logiciels', max_devices: 1,
    compatibility: ['windows', 'mac'],
    features: ['Sans abonnement','Word, Excel, PowerPoint, OneNote','Mises à jour sécurité incluses','1 PC ou Mac'],
    specs: { Éditeur: 'Microsoft', Type: 'Perpétuel', Appareils: '1 PC ou Mac', Langue: 'Multilingue', Livraison: 'Code email sous 5 min' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Microsoft_Office_logo_%282013%E2%80%932019%29.svg/200px-Microsoft_Office_logo_%282013%E2%80%932019%29.svg.png',
  },

  // ── Antivirus ────────────────────────────────────────────────────────────────
  {
    name: 'Norton 360 Standard',
    subtitle: 'Protection complète — 1 appareil, 1 an',
    slug: 'norton-360-standard-1an',
    description: 'Norton 360 Standard : antivirus, VPN, gestionnaire de mots de passe, 10 Go de sauvegarde cloud.',
    price_eur: 29.99, price_kmf: 14725,
    price_old: 49.99,
    badge: '-40%', badge_class: 'badge-promo',
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'antivirus', max_devices: 1,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['Antivirus temps réel','VPN sécurisé illimité','Gestionnaire mots de passe','10 Go sauvegarde cloud','Dark Web Monitoring'],
    specs: { Éditeur: 'NortonLifeLock', Type: 'Abonnement', Durée: '1 an', Appareils: '1', VPN: 'Inclus illimité', Sauvegarde: '10 Go', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Norton_logo.svg/200px-Norton_logo.svg.png',
  },
  {
    name: 'Kaspersky Standard',
    subtitle: 'Protection essentielle — 3 appareils, 1 an',
    slug: 'kaspersky-standard-3-appareils-1an',
    description: 'Kaspersky Standard protège 3 appareils contre virus, ransomware, phishing et malwares avec impact minimal sur les performances.',
    price_eur: 24.99, price_kmf: 12270,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'antivirus', max_devices: 3,
    compatibility: ['windows', 'mac', 'android'],
    features: ['Protection antivirus avancée','Anti-ransomware','Protection phishing','Optimisation PC','3 appareils'],
    specs: { Éditeur: 'Kaspersky', Durée: '1 an', Appareils: '3', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/82/Kaspersky_logo_2019.svg/200px-Kaspersky_logo_2019.svg.png',
  },
  {
    name: 'Bitdefender Total Security',
    subtitle: 'Protection totale — 5 appareils, 1 an',
    slug: 'bitdefender-total-security-5-appareils',
    description: 'Bitdefender Total Security : meilleure protection selon AV-TEST. 5 appareils, multiplateforme, VPN 200 Mo/jour inclus.',
    price_eur: 34.99, price_kmf: 17180,
    price_old: 54.99,
    badge: 'Top AV-TEST', badge_class: 'badge-new',
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'antivirus', max_devices: 5,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['Noté 6/6 AV-TEST','Multiplateforme complet','VPN 200 Mo/jour','Contrôle parental','Anti-tracking'],
    specs: { Éditeur: 'Bitdefender', Durée: '1 an', Appareils: '5', VPN: '200 Mo/jour', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b0/Bitdefender_logo.svg/200px-Bitdefender_logo.svg.png',
  },
  {
    name: 'ESET NOD32 Antivirus',
    subtitle: 'Léger et efficace — 1 appareil, 1 an',
    slug: 'eset-nod32-antivirus-1an',
    description: 'ESET NOD32 : protection antivirus légère et rapide, idéale pour les PC anciens. Impact minimal sur les performances.',
    price_eur: 22.99, price_kmf: 11288,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'antivirus', max_devices: 1,
    compatibility: ['windows'],
    features: ['Ultra-léger','Anti-exploit','Protection USB','Mises à jour automatiques'],
    specs: { Éditeur: 'ESET', Durée: '1 an', Appareils: '1', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/b4/ESET_logo.svg/200px-ESET_logo.svg.png',
  },

  // ── Outils IA ────────────────────────────────────────────────────────────────
  {
    name: 'Canva Pro',
    subtitle: 'Design professionnel — 1 utilisateur, 1 mois',
    slug: 'canva-pro-mensuel',
    description: 'Canva Pro : 100 millions d\'assets, suppression d\'arrière-plan, redimensionnement magique, 1 To de stockage cloud.',
    price_eur: 13.99, price_kmf: 6869,
    product_type: 'subscription', billing_period: 'monthly', digital_category: 'outils-ia', max_devices: 1,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['100M+ templates premium','Suppression fond automatique','IA génération d\'images','1 To stockage','Collaboration équipe'],
    specs: { Éditeur: 'Canva', Type: 'Abonnement mensuel', Utilisateurs: '1', Stockage: '1 To', Livraison: 'Accès immédiat' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/200px-Canva_icon_2021.svg.png',
  },
  {
    name: 'Canva Pro — 1 an',
    subtitle: 'Design professionnel — 1 utilisateur, 1 an',
    slug: 'canva-pro-annuel',
    description: 'Canva Pro annuel : économisez 2 mois par rapport à l\'abonnement mensuel.',
    price_eur: 119.00, price_kmf: 58429,
    price_old: 167.88,
    badge: '-29%', badge_class: 'badge-promo',
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'outils-ia', max_devices: 1,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['Tout Canva Pro inclus','2 mois offerts','Facture annuelle unique','1 To stockage'],
    specs: { Éditeur: 'Canva', Type: 'Abonnement annuel', Utilisateurs: '1', Livraison: 'Accès immédiat' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/0/08/Canva_icon_2021.svg/200px-Canva_icon_2021.svg.png',
  },
  {
    name: 'Grammarly Premium',
    subtitle: 'Rédaction IA — 1 utilisateur, 1 mois',
    slug: 'grammarly-premium-mensuel',
    description: 'Grammarly Premium corrige grammaire, style, ton et clarté dans tous vos textes. Idéal pour professionnels et étudiants.',
    price_eur: 12.00, price_kmf: 5892,
    product_type: 'subscription', billing_period: 'monthly', digital_category: 'outils-ia', max_devices: 1,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['Correction grammaire avancée','Suggestions de style','Détection de ton','Extension navigateur','Intégration Google Docs'],
    specs: { Éditeur: 'Grammarly Inc.', Type: 'Abonnement mensuel', Livraison: 'Accès immédiat' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Grammarly_logo.svg/200px-Grammarly_logo.svg.png',
  },

  // ── SaaS / Cloud ─────────────────────────────────────────────────────────────
  {
    name: 'NordVPN Standard — 1 an',
    subtitle: 'VPN premium — 6 appareils simultanés',
    slug: 'nordvpn-standard-1an',
    description: 'NordVPN Standard : 5 700+ serveurs dans 60 pays, protection contre malwares et trackers, Threat Protection incluse.',
    price_eur: 42.00, price_kmf: 20622,
    price_old: 71.88,
    badge: '-42%', badge_class: 'badge-promo',
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'saas', max_devices: 6,
    compatibility: ['windows', 'mac', 'ios', 'android', 'linux'],
    features: ['5700+ serveurs dans 60 pays','6 appareils simultanés','Threat Protection','Double VPN','Kill Switch','P2P optimisé'],
    specs: { Éditeur: 'Nord Security', Durée: '1 an', Appareils: '6', Serveurs: '5700+', Pays: '60+', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/58/NordVPN_logo.svg/200px-NordVPN_logo.svg.png',
  },
  {
    name: 'Dropbox Plus — 2 To',
    subtitle: 'Stockage cloud — 1 utilisateur, 1 an',
    slug: 'dropbox-plus-2to-1an',
    description: 'Dropbox Plus : 2 To de stockage sécurisé, synchronisation intelligente, historique de 180 jours.',
    price_eur: 89.99, price_kmf: 44179,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'saas', max_devices: 3,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['2 To stockage','Partage sécurisé','Historique 180 jours','Synchronisation sélective','Priorité support'],
    specs: { Éditeur: 'Dropbox', Durée: '1 an', Stockage: '2 To', Appareils: '3', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/78/Dropbox_Icon.svg/200px-Dropbox_Icon.svg.png',
  },
  {
    name: 'LastPass Premium',
    subtitle: 'Gestionnaire de mots de passe — 1 an',
    slug: 'lastpass-premium-1an',
    description: 'LastPass Premium : gérez tous vos mots de passe de façon sécurisée sur tous vos appareils, partage familial inclus.',
    price_eur: 29.99, price_kmf: 14725,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'saas', max_devices: 999,
    compatibility: ['windows', 'mac', 'ios', 'android'],
    features: ['Illimité appareils','Partage 1 à 1','Surveillance dark web','Authentification MFA','1 Go stockage sécurisé'],
    specs: { Éditeur: 'LastPass', Durée: '1 an', Appareils: 'Illimité', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/LastPass_logo.svg/200px-LastPass_logo.svg.png',
  },

  // ── Logiciels ────────────────────────────────────────────────────────────────
  {
    name: 'WinRAR 7 — Licence perpétuelle',
    subtitle: 'Compression — 1 PC, licence à vie',
    slug: 'winrar-7-licence',
    description: 'WinRAR 7 : le compresseur de fichiers le plus populaire. Licence perpétuelle, 1 PC, sans abonnement.',
    price_eur: 29.00, price_kmf: 14239,
    product_type: 'one_time', digital_category: 'logiciels', max_devices: 1,
    compatibility: ['windows'],
    features: ['Licence perpétuelle','RAR, ZIP, 7Z, TAR et plus','Chiffrement AES-256','Archives découpées','Interface moderne'],
    specs: { Éditeur: 'win.rar GmbH', Type: 'Perpétuel', Appareils: '1 PC', Livraison: 'Code + téléchargement' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/WinRAR_logo.svg/200px-WinRAR_logo.svg.png',
  },
  {
    name: 'CCleaner Professional',
    subtitle: 'Nettoyage PC — 1 appareil, 1 an',
    slug: 'ccleaner-professional-1an',
    description: 'CCleaner Professional : nettoyez, optimisez et protégez votre PC. Mise à jour automatique des pilotes incluse.',
    price_eur: 19.95, price_kmf: 9795,
    product_type: 'subscription', billing_period: 'yearly', digital_category: 'logiciels', max_devices: 1,
    compatibility: ['windows'],
    features: ['Nettoyage profond registre','Mise à jour pilotes','Planification automatique','Démarrage optimisé','Support prioritaire'],
    specs: { Éditeur: 'Piriform / Avast', Durée: '1 an', Appareils: '1 PC', Livraison: 'Code email' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/CCleaner_logo.png/200px-CCleaner_logo.png',
  },

  // ── Offres Premium (bundles) ─────────────────────────────────────────────────
  {
    name: 'Pack Essentiel PC',
    subtitle: 'Windows 11 Pro + Office 2024 + Antivirus 1 an',
    slug: 'pack-essentiel-pc',
    description: 'Le pack complet pour équiper votre PC : Windows 11 Pro, Office 2024 Famille & Étudiant, et 1 an d\'antivirus Norton 360.',
    price_eur: 74.90, price_kmf: 36776,
    price_old: 110.80,
    badge: 'Pack -32%', badge_class: 'badge-promo',
    product_type: 'one_time', digital_category: 'premium', max_devices: 1,
    compatibility: ['windows'],
    features: ['Windows 11 Pro inclus','Office 2024 inclus','Norton 360 1 an inclus','3 clés distinctes livrées','Activation immédiate'],
    specs: { Contenu: 'Win11 Pro + Office 2024 + Norton 360', Appareils: '1 PC', Économie: '-32% vs séparé', Livraison: '3 codes email sous 5 min' },
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/34/Windows_logo_-_2021.svg/200px-Windows_logo_-_2021.svg.png',
    rating: 5, rating_count: 12,
  },
];

async function seed() {
  console.log('🚀 Démarrage du seed produits digitaux...\n');
  const catId = await getOrCreateCategory();
  console.log('✅ Catégorie "digital" :', catId, '\n');

  let ok = 0; let skip = 0; let fail = 0;

  for (const p of PRODUCTS) {
    const row = {
      name:             p.name,
      subtitle:         p.subtitle,
      slug:             p.slug,
      description:      p.description,
      price_eur:        p.price_eur,
      price_kmf:        p.price_kmf,
      price_old:        p.price_old || null,
      badge:            p.badge || null,
      badge_class:      p.badge_class || null,
      rating:           p.rating || 0,
      rating_count:     p.rating_count || 0,
      image:            p.image,
      features:         p.features || [],
      specs:            p.specs || {},
      stock:            9999,
      stock_label:      'Disponible',
      status:           'active',
      category_id:      catId,
      // Colonnes digitales (migration 015)
      is_digital:       true,
      product_type:     p.product_type,
      billing_period:   p.billing_period || null,
      max_devices:      p.max_devices || 1,
      file_path:        null,
      file_version:     p.file_version || null,
      compatibility:    p.compatibility || [],
      digital_category: p.digital_category,
    };

    // Vérifie si le slug existe déjà
    const { data: ex } = await sb.from('products').select('id').eq('slug', p.slug).single();
    if (ex) {
      console.log(`⏭  Ignoré (déjà présent) : ${p.name}`);
      skip++;
      continue;
    }

    const { error } = await sb.from('products').insert(row);
    if (error) {
      console.error(`❌ Erreur : ${p.name} — ${error.message}`);
      fail++;
    } else {
      console.log(`✅ Inséré : ${p.name} (${p.price_eur} €)`);
      ok++;
    }
  }

  console.log(`\n📊 Résultat : ${ok} insérés, ${skip} ignorés, ${fail} échecs`);
}

seed().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
