// scripts/update-digital-products.mjs
// Met à jour les produits digitaux existants : brand, badge_class, specs display, images
// Usage : node scripts/update-digital-products.mjs

import { createClient } from '@supabase/supabase-js';
import { readFileSync }  from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath }    from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const env   = Object.fromEntries(
  readFileSync(resolve(__dir, '../.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => l.split('=').map(s => s.trim()))
);
const sb = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

// Images depuis Amazon CDN (déjà autorisé dans CSP)
// ou Wikipedia (autorisé après fix CSP)
const UPDATES = [

  // ── Windows Licences ───────────────────────────────────────────────────────
  {
    slug: 'windows-11-home-licence',
    brand: 'Microsoft',
    badge: 'Populaire', badge_class: 'badge--deal',
    image: 'https://m.media-amazon.com/images/I/71Y1-U9k7QL._AC_SL300_.jpg',
    rating: 4, rating_count: 3241,
    specs: { Type: 'OEM Numérique', Appareils: '1 PC', Livraison: 'Email sous 5 min' },
    description: 'Windows 11 Home en licence numérique OEM. Activez votre PC immédiatement avec une clé authentique Microsoft. Compatible avec tous les PC 64 bits. Livraison instantanée par email, activation en ligne en 2 minutes.',
  },
  {
    slug: 'windows-11-pro-licence',
    brand: 'Microsoft',
    badge: 'Pro', badge_class: 'badge--new',
    image: 'https://m.media-amazon.com/images/I/71Y1-U9k7QL._AC_SL300_.jpg',
    rating: 5, rating_count: 1876,
    specs: { Type: 'OEM Numérique', Fonctions: 'BitLocker · Remote Desktop', Appareils: '1 PC' },
    description: 'Windows 11 Pro avec toutes les fonctionnalités professionnelles : BitLocker, Remote Desktop, Hyper-V, Azure AD. Idéal pour les professionnels et entreprises. Clé OEM authentique Microsoft, activation immédiate.',
  },
  {
    slug: 'windows-10-pro-licence',
    brand: 'Microsoft',
    badge: 'Bon prix', badge_class: 'badge--deal',
    image: 'https://m.media-amazon.com/images/I/71Y1-U9k7QL._AC_SL300_.jpg',
    rating: 4, rating_count: 5432,
    specs: { Type: 'OEM Numérique', Appareils: '1 PC', 'Mise à jour Win11': 'Possible' },
    description: 'Windows 10 Pro en licence numérique OEM. Toujours pris en charge, mise à niveau vers Windows 11 possible. Clé authentique Microsoft, activation immédiate.',
  },

  // ── Microsoft 365 ──────────────────────────────────────────────────────────
  {
    slug: 'microsoft-365-personnel-1an',
    brand: 'Microsoft',
    badge: '-14%', badge_class: 'badge--promo',
    image: 'https://m.media-amazon.com/images/I/71fvVGnmBEL._AC_SL300_.jpg',
    rating: 5, rating_count: 8234,
    specs: { Durée: '1 an', Appareils: '5', Stockage: '1 To OneDrive' },
    description: 'Microsoft 365 Personnel inclut Word, Excel, PowerPoint, Outlook, Teams et 1 To OneDrive. Applications toujours à jour, sur 5 appareils simultanés (PC, Mac, tablette, mobile). Code d\'activation envoyé par email.',
  },
  {
    slug: 'microsoft-365-famille-1an',
    brand: 'Microsoft',
    badge: 'Famille', badge_class: 'badge--new',
    image: 'https://m.media-amazon.com/images/I/71fvVGnmBEL._AC_SL300_.jpg',
    rating: 5, rating_count: 4521,
    specs: { Durée: '1 an', Utilisateurs: '6', Stockage: '6 To total' },
    description: 'Microsoft 365 Famille pour 6 utilisateurs. Chaque utilisateur dispose d\'applications Office complètes sur 5 appareils et 1 To OneDrive. La solution idéale pour équiper toute la famille ou une petite équipe.',
  },
  {
    slug: 'office-2024-famille-etudiant',
    brand: 'Microsoft',
    badge: 'Perpétuel', badge_class: 'badge--deal',
    image: 'https://m.media-amazon.com/images/I/71fvVGnmBEL._AC_SL300_.jpg',
    rating: 4, rating_count: 2103,
    specs: { Type: 'Licence perpétuelle', Apps: 'Word · Excel · PowerPoint · OneNote', Appareils: '1 PC/Mac' },
    description: 'Office 2024 Famille & Étudiant — licence perpétuelle sans abonnement. Word, Excel, PowerPoint et OneNote pour 1 PC ou Mac. Payez une fois, utilisez à vie. Code d\'activation envoyé immédiatement.',
  },

  // ── Antivirus ──────────────────────────────────────────────────────────────
  {
    slug: 'norton-360-standard-1an',
    brand: 'Norton',
    badge: '-40%', badge_class: 'badge--promo',
    image: 'https://m.media-amazon.com/images/I/61X0VnacxQL._AC_SL300_.jpg',
    rating: 4, rating_count: 6782,
    specs: { Durée: '1 an', Appareils: '1', VPN: 'Illimité inclus' },
    description: 'Norton 360 Standard protège 1 appareil contre virus, ransomware et menaces en ligne. VPN illimité, gestionnaire de mots de passe et 10 Go de sauvegarde cloud inclus. Protection en temps réel 24h/24.',
  },
  {
    slug: 'kaspersky-standard-3-appareils-1an',
    brand: 'Kaspersky',
    badge: null, badge_class: null,
    image: 'https://m.media-amazon.com/images/I/71R1R3BSKZL._AC_SL300_.jpg',
    rating: 4, rating_count: 3892,
    specs: { Durée: '1 an', Appareils: '3', Protection: 'Anti-ransomware inclus' },
    description: 'Kaspersky Standard protège 3 appareils contre les menaces numériques avec un impact minimal sur les performances. Anti-ransomware, anti-phishing et optimisateur PC inclus.',
  },
  {
    slug: 'bitdefender-total-security-5-appareils',
    brand: 'Bitdefender',
    badge: 'Top AV-TEST', badge_class: 'badge--new',
    image: 'https://m.media-amazon.com/images/I/71vX2eAcCNL._AC_SL300_.jpg',
    rating: 5, rating_count: 9214,
    specs: { Durée: '1 an', Appareils: '5', Note: '6/6 AV-TEST' },
    description: 'Bitdefender Total Security — noté 6/6 par AV-TEST pendant 8 années consécutives. Protection complète pour 5 appareils : Windows, Mac, iOS et Android. VPN 200 Mo/jour et contrôle parental inclus.',
  },
  {
    slug: 'eset-nod32-antivirus-1an',
    brand: 'ESET',
    badge: 'Léger', badge_class: 'badge--deal',
    image: 'https://m.media-amazon.com/images/I/61U7WGPFIOL._AC_SL300_.jpg',
    rating: 4, rating_count: 2341,
    specs: { Durée: '1 an', Appareils: '1', Type: 'Ultra-léger' },
    description: 'ESET NOD32 — antivirus léger reconnu pour ses performances exceptionnelles sur PC anciens et récents. Protection anti-ransomware, anti-exploit et anti-phishing sans ralentir votre machine.',
  },

  // ── Outils IA ──────────────────────────────────────────────────────────────
  {
    slug: 'canva-pro-mensuel',
    brand: 'Canva',
    badge: null, badge_class: null,
    image: 'https://m.media-amazon.com/images/I/41WXbAteBIL._AC_SL300_.jpg',
    rating: 5, rating_count: 12450,
    specs: { Type: 'Abonnement mensuel', Assets: '100M+ templates', Stockage: '1 To cloud' },
    description: 'Canva Pro mensuel — 100 millions de templates premium, suppression de fond IA, redimensionnement magique et 1 To de stockage. Créez des designs professionnels sans expérience graphique.',
  },
  {
    slug: 'canva-pro-annuel',
    brand: 'Canva',
    badge: '-29%', badge_class: 'badge--promo',
    image: 'https://m.media-amazon.com/images/I/41WXbAteBIL._AC_SL300_.jpg',
    rating: 5, rating_count: 12450,
    specs: { Type: 'Abonnement annuel', 'Économie': '2 mois offerts', Stockage: '1 To cloud' },
    description: 'Canva Pro annuel — économisez 2 mois par rapport au mensuel. Accédez à tous les outils Pro : IA génération d\'images, 100M+ templates, marque personnalisée et collaboration en équipe.',
  },
  {
    slug: 'grammarly-premium-mensuel',
    brand: 'Grammarly',
    badge: null, badge_class: null,
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fd/Grammarly_logo.svg/200px-Grammarly_logo.svg.png',
    rating: 4, rating_count: 7823,
    specs: { Type: 'Abonnement mensuel', Plateformes: 'Web · Desktop · Mobile', Langues: 'FR · EN · ES +' },
    description: 'Grammarly Premium corrige grammaire, style, ton et clarté dans tous vos textes. Extension navigateur, intégration Google Docs, Microsoft Office. Idéal pour rédiger des emails et documents professionnels.',
  },

  // ── SaaS / Cloud ───────────────────────────────────────────────────────────
  {
    slug: 'nordvpn-standard-1an',
    brand: 'NordVPN',
    badge: '-42%', badge_class: 'badge--promo',
    image: 'https://m.media-amazon.com/images/I/41PG4OYVMPL._AC_SL300_.jpg',
    rating: 5, rating_count: 15234,
    specs: { Durée: '1 an', Appareils: '6', Serveurs: '5700+ dans 60 pays' },
    description: 'NordVPN Standard — le VPN le plus rapide selon des tests indépendants. 5700+ serveurs dans 60 pays, Threat Protection contre malwares et trackers, Double VPN, Kill Switch. 6 appareils simultanés.',
  },
  {
    slug: 'dropbox-plus-2to-1an',
    brand: 'Dropbox',
    badge: null, badge_class: null,
    image: 'https://m.media-amazon.com/images/I/61KCgVqf8dL._AC_SL300_.jpg',
    rating: 4, rating_count: 3421,
    specs: { Durée: '1 an', Stockage: '2 To', Historique: '180 jours' },
    description: 'Dropbox Plus — 2 To de stockage sécurisé dans le cloud. Synchronisez vos fichiers sur 3 appareils, partagez avec n\'importe qui, récupérez vos fichiers jusqu\'à 180 jours en arrière.',
  },
  {
    slug: 'lastpass-premium-1an',
    brand: 'LastPass',
    badge: null, badge_class: null,
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/LastPass_logo.svg/200px-LastPass_logo.svg.png',
    rating: 4, rating_count: 4123,
    specs: { Durée: '1 an', Appareils: 'Illimité', 'Dark Web': 'Surveillance incluse' },
    description: 'LastPass Premium — gérez tous vos mots de passe sur appareils illimités. Surveillance Dark Web, partage sécurisé, authentification multifacteur. La solution de sécurité adoptée par 25 millions d\'utilisateurs.',
  },

  // ── Logiciels ──────────────────────────────────────────────────────────────
  {
    slug: 'winrar-7-licence',
    brand: 'win.rar GmbH',
    badge: 'Perpétuel', badge_class: 'badge--deal',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/WinRAR_logo.svg/200px-WinRAR_logo.svg.png',
    rating: 4, rating_count: 8921,
    specs: { Type: 'Perpétuel', Formats: 'RAR · ZIP · 7Z · TAR · GZ', Chiffrement: 'AES-256' },
    description: 'WinRAR 7 — le compresseur de référence depuis 1995. Licence perpétuelle, 1 PC, sans abonnement. Compresse et décompresse tous les formats (RAR, ZIP, 7Z, TAR, GZ). Chiffrement AES-256 intégré.',
  },
  {
    slug: 'ccleaner-professional-1an',
    brand: 'Piriform',
    badge: null, badge_class: null,
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/10/CCleaner_logo.png/200px-CCleaner_logo.png',
    rating: 4, rating_count: 5672,
    specs: { Durée: '1 an', Appareils: '1 PC', Fonctions: 'Nettoyage · Pilotes · Démarrage' },
    description: 'CCleaner Professional — nettoyez, optimisez et protégez votre PC Windows. Mise à jour automatique des pilotes, planification des nettoyages, désactivation des démarrages inutiles. PC toujours performant.',
  },

  // ── Pack Premium ───────────────────────────────────────────────────────────
  {
    slug: 'pack-essentiel-pc',
    brand: 'Info Experts',
    badge: '-32%', badge_class: 'badge--promo',
    image: 'https://m.media-amazon.com/images/I/71Y1-U9k7QL._AC_SL300_.jpg',
    rating: 5, rating_count: 127,
    specs: { Contenu: 'Win11 Pro + Office 2024 + Norton', Appareils: '1 PC', Économie: '35 €' },
    description: 'Pack Essentiel PC — équipez votre PC d\'un seul coup : Windows 11 Pro + Office 2024 Famille & Étudiant + Norton 360 1 an. 3 clés distinctes livrées par email. Économisez 35 € par rapport à l\'achat séparé.',
  },
];

async function run() {
  console.log('🔄 Mise à jour des produits digitaux...\n');
  let ok = 0; let fail = 0;

  for (const u of UPDATES) {
    const update = {};
    if (u.brand       !== undefined) update.brand        = u.brand;
    if (u.badge       !== undefined) update.badge        = u.badge;
    if (u.badge_class !== undefined) update.badge_class  = u.badge_class;
    if (u.image       !== undefined) update.image        = u.image;
    if (u.rating      !== undefined) update.rating       = u.rating;
    if (u.rating_count !== undefined) update.rating_count = u.rating_count;
    if (u.specs       !== undefined) update.specs        = u.specs;
    if (u.description !== undefined) update.description  = u.description;

    const { error } = await sb.from('products').update(update).eq('slug', u.slug);
    if (error) {
      console.error(`❌ ${u.slug} — ${error.message}`);
      fail++;
    } else {
      console.log(`✅ ${u.slug}`);
      ok++;
    }
  }
  console.log(`\n📊 ${ok} mis à jour, ${fail} échecs`);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
