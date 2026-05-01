// scripts/cleanup-reseau-data.js
// Nettoyage complet section Réseau : qualité données + 5 produits par onglet
// Phase 1: fix noms, features, specs
// Phase 2: créer 5ème produit essentiel-reseau
// Phase 3: générer rapport

const path  = require('path');
const sharp = require('sharp');
const fs    = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const { createClient } = require('@supabase/supabase-js');
const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const REPORT_PATH = path.join(__dirname, '../data-cleanup/products-cleanup-report.md');

// ── Données qualité par produit ───────────────────────────────────────────────
const FIXES = [

  // ══ ROUTEURS WIFI ══════════════════════════════════════════════════════════
  {
    id: 'ccc285b6-0be9-4ff5-b370-99996dafa408',
    name: 'TP-Link Archer AX55 WiFi 6',
    badge: 'WiFi 6', badge_class: 'badge--popular',
    features: [
      'WiFi 6 AX3000 double bande 2.4 + 5 GHz',
      'Couverture jusqu\'à 200 m² avec signal stable',
      '4 ports Gigabit LAN + 1 WAN Gigabit',
      'OFDMA + MU-MIMO — connexions simultanées',
      'Configuration rapide via app Tether',
    ],
    specs_add: { 'Norme Wi-Fi': 'WiFi 6 (802.11ax)', 'Vitesse': 'AX3000 (3000 Mbps)', 'Bandes': 'Dual Band 2.4 + 5 GHz', 'Ports LAN': '4 × Gigabit', 'USB': 'USB 3.0', 'Sécurité': 'WPA3', 'Antennes': '4 externes' },
  },
  {
    id: '0cee144e-22d7-4c60-a5bf-f2a150487db8',
    name: 'ASUS RT-AX56U WiFi 6',
    badge: 'WiFi 6', badge_class: 'badge--popular',
    features: [
      'WiFi 6 AX1800 — débit accru, latence réduite',
      '4 ports Gigabit LAN + port USB 3.0',
      'AiProtection — sécurité réseau automatique',
      'MU-MIMO 2x2 pour appareils simultanés',
      'Gestion réseau via app ASUS Router',
    ],
    specs_add: { 'Standard': 'WiFi 6 (802.11ax)', 'Vitesse': 'AX1800', 'Bandes': 'Dual Band', 'Ports LAN': '4 × Gigabit', 'USB': 'USB 3.0', 'Sécurité': 'WPA3', 'Antennes': '4 antennes' },
  },
  {
    id: '7638a19e-5d74-4afa-8138-78ad67b01947',
    name: 'TP-Link Archer AX20 WiFi 6',
    badge: 'Bon prix', badge_class: 'badge--deal',
    features: [
      'WiFi 6 AX1800 — idéal maison et télétravail',
      '4 ports Gigabit LAN',
      'OFDMA pour plus de connexions stables',
      'Beamforming intelligent vers chaque appareil',
      'Installation en 5 min via Tether App',
    ],
    specs_add: { 'Standard': 'WiFi 6', 'Vitesse': 'AX1800', 'Bandes': 'Dual Band', 'Ports LAN': '4 × Gigabit', 'WAN': '1 × Gigabit', 'Sécurité': 'WPA3' },
  },
  {
    id: '0433e327-4de8-41f6-a903-7f8556e995e6',
    name: 'TP-Link Archer AX73 WiFi 6',
    badge: 'WiFi 6', badge_class: 'badge--popular',
    features: [
      'WiFi 6 AX5400 — vitesse maximale',
      '6 antennes hautes performances',
      'Processeur tri-cœur 1.5 GHz',
      'OFDMA + MU-MIMO 4×4 simultané',
      'USB 3.0 pour partage fichiers réseau',
    ],
    specs_add: { 'Standard': 'WiFi 6', 'Vitesse': 'AX5400', 'Bandes': 'Dual Band', 'Antennes': '6 externes', 'CPU': '1.5 GHz triple-core', 'RAM': '256 MB', 'USB': 'USB 3.0', 'Sécurité': 'WPA3' },
  },
  {
    id: '7273be25-f6d5-4899-a508-bc5d1bb383d6', // Tenda AX1500
    name: 'Tenda AX1500 Routeur WiFi 6',
    badge: 'Entrée gamme', badge_class: 'badge--deal',
    features: [
      'WiFi 6 AX1500 double bande',
      '4 ports WAN/LAN Gigabit',
      'Configuration en 3 minutes via app Tenda',
      'WPA3 + contrôle parental intégré',
      'Compatible tous opérateurs internet',
    ],
    specs_add: { 'Standard': 'WiFi 6', 'Vitesse': 'AX1500', 'Bandes': 'Dual Band', 'Ports': '4 × Gigabit', 'Antennes': '5 externes', 'Sécurité': 'WPA3', 'VPN': 'OpenVPN, PPTP' },
  },

  // ══ ROUTEURS 4G/5G ══════════════════════════════════════════════════════════
  {
    id: '2c507956-6a42-4ef8-b697-303ccc2b423f', // Huawei B535
    features: [
      'Routeur 4G LTE Cat7 jusqu\'à 300 Mbps',
      'WiFi AC1200 double bande intégré',
      '4 ports LAN Gigabit',
      'Compatible SIM toutes opérateurs',
      'Basculement auto 4G/fixe',
    ],
    specs_add: { 'Type': '4G LTE Cat7', 'Débit max': '300 Mbps DL', 'WiFi': 'AC1200 Dual Band', 'Ports LAN': '4 × Gigabit', 'SIM': 'Nano SIM', 'Antennes ext.': 'Oui (TS-9)' },
  },
  {
    id: '2f3d9efc-7b76-4544-9c91-684878bf5e4b', // Netgear Nighthawk M6
    features: [
      'Routeur 5G Sub-6 GHz + WiFi 6 AX3600',
      'Jusqu\'à 4 Gbps en download 5G',
      'Batterie 5040 mAh pour usage nomade',
      '1 port LAN Gigabit',
      'Compatible SIM nano — partage jusqu\'à 32 appareils',
    ],
    specs_add: { 'Réseau': '5G Sub-6 + LTE Cat20', 'WiFi': 'AX3600', 'Batterie': '5040 mAh', 'Appareils': '32 simultanés', 'SIM': 'Nano SIM', 'Ports': '1 × LAN Gigabit' },
  },
  {
    id: '984f3678-854c-49fd-bfa0-c7f19b628ffa', // MR6400
    name: 'TP-Link TL-MR6400 Routeur 4G',
    features: [
      '4G LTE Cat4 jusqu\'à 150 Mbps',
      'WiFi N300 — partage internet sans fil',
      '4 ports LAN Fast Ethernet',
      'Compatible SIM nano toutes opérateurs',
      'Plug & Play — installation simple',
    ],
    specs_add: { 'Réseau': '4G LTE Cat4', 'Débit DL': '150 Mbps', 'WiFi': 'N300 2.4 GHz', 'Ports LAN': '4 × 100 Mbps', 'SIM': 'Nano SIM' },
  },
  {
    id: 'c347cf83-7ead-4abe-a952-c578e6527963', // MR100
    name: 'TP-Link TL-MR100 Routeur 4G',
    features: [
      '4G LTE 150 Mbps — connexion sans câble',
      'WiFi N300 2.4 GHz',
      '4 ports LAN 100 Mbps',
      'Compatible SIM nano — sans abonnement box',
      'Idéal résidence secondaire ou chantier',
    ],
    specs_add: { 'Type': '4G LTE Cat4', 'WiFi': 'N300', 'Ports': '4 × Fast Ethernet', 'SIM': 'Nano SIM' },
  },
  {
    id: 'ee6e5acc-f66e-4e6c-8c42-53bcbbbec582', // Zyxel
    features: [
      'Routeur 5G NR Sub-6 GHz Pro',
      'Débit jusqu\'à 3.6 Gbps en 5G',
      'WiFi 6 AX3600 double bande',
      '1 port SFP fibre + 4 ports LAN Gigabit',
      'Compatible bandes 5G n1/n3/n28/n78',
    ],
    specs_add: { 'Réseau': '5G NR SA/NSA', 'WiFi': 'AX3600', 'Ports LAN': '4 × Gigabit', 'SFP': '1 × 2.5G', 'Bandes 5G': 'n1/n3/n28/n78' },
  },

  // ══ SWITCHES ═══════════════════════════════════════════════════════════════
  {
    id: '1587f10e-3224-42ce-9e65-ad95bf45812a',
    name: 'TP-Link TL-SG105 Switch 5P',
    features: [
      '5 ports Gigabit 10/100/1000 Mbps',
      'Plug & Play — aucune configuration',
      'Boîtier métal compact et silencieux',
      'Auto-négociation MDI/MDIX',
      'Économie d\'énergie auto par port',
    ],
    specs_add: { 'Ports': '5 × Gigabit', 'Type': 'Non géré', 'Boîtier': 'Métal', 'Standards': 'IEEE 802.3ab', 'Buffer': '1.5 Mbit', 'Switching': '10 Gbps' },
  },
  {
    id: 'a3fb16fb-a7f1-4c65-86aa-5d805a07e554',
    name: 'TP-Link TL-SG108 Switch 8P',
    features: [
      '8 ports Gigabit 10/100/1000 Mbps',
      'Plug & Play sans logiciel',
      'Boîtier métal robuste bureau/rack',
      'IGMP snooping automatique',
      'Indicateurs LED état par port',
    ],
    specs_add: { 'Ports': '8 × Gigabit', 'Type': 'Non géré', 'Boîtier': 'Métal', 'Switching': '16 Gbps', 'Buffer': '1.5 Mbit' },
  },
  {
    id: 'cd68bb52-4b21-425a-b51f-d7469f0e23c4',
    name: 'Netgear GS308 Switch 8P',
    features: [
      '8 ports Gigabit 10/100/1000 Mbps',
      'Design silencieux sans ventilateur',
      'Boîtier métal élégant',
      'Auto MDI/MDIX sur tous les ports',
      'Économie d\'énergie IEEE 802.3az',
    ],
    specs_add: { 'Ports': '8 × Gigabit', 'Type': 'Non géré', 'Boîtier': 'Métal', 'Standard': 'IEEE 802.3az', 'Switching': '16 Gbps' },
  },
  {
    id: 'eb670eec-8ffb-4aeb-a38b-994620908a46',
    features: [
      '16 ports Gigabit gérables en VLAN',
      'QoS 802.1p — priorité du trafic',
      'Gestion via SNMP et interface web',
      'Détection de boucle LoopBack',
      'Idéal PME et réseaux d\'entreprise',
    ],
    specs_add: { 'Ports': '16 × Gigabit', 'Type': 'Smart switch', 'VLAN': 'Oui (802.1Q)', 'QoS': 'Oui (802.1p)', 'Gestion': 'Web + SNMP', 'Switching': '32 Gbps' },
  },
  {
    id: 'dfa7a00f-135a-4257-9686-99a343851abf',
    features: [
      '10 ports Gigabit gérés niveau 2+',
      'Routage statique intégré',
      'VLAN 802.1Q, ACL, QoS avancée',
      'PoE sur ports 1-8 (optionnel)',
      'Interface web intuitive Cisco Business',
    ],
    specs_add: { 'Ports': '10 × Gigabit', 'Type': 'Smart managed L2+', 'VLAN': '802.1Q', 'QoS': 'Avancée', 'Routage': 'Statique IPv4/IPv6', 'Boîtier': 'Rack 1U' },
  },

  // ══ POINTS D'ACCÈS ══════════════════════════════════════════════════════════
  {
    id: '691f966c-d11e-427c-8ce6-6438cd74473f',
    name: 'ASUS ExpertWiFi EBP68',
    features: [
      'WiFi 6 AX3000 point d\'accès Pro',
      'PoE 802.3at — zéro câble électrique',
      'WPA3-Enterprise — sécurité pro',
      'Montage plafond inclus',
      'Gestion centralisée multi-bornes',
    ],
    specs_add: { 'Standard': 'WiFi 6 AX3000', 'PoE': '802.3at (25.5W)', 'Montage': 'Plafond', 'WPA3': 'Enterprise', 'VLAN': 'Multi-SSID' },
  },
  {
    id: '7a465d4a-d188-414d-bbae-1d06e5b5f453',
    features: [
      'WiFi 6 AX1800 point d\'accès plafond',
      'PoE 802.3af inclus',
      '2 SSID simultanés',
      'WPA3 Personal',
      'Compatible Insight App Netgear',
    ],
    specs_add: { 'Standard': 'WiFi 6 AX1800', 'PoE': '802.3af', 'SSID': '2 simultanés', 'Sécurité': 'WPA3', 'Montage': 'Plafond' },
  },
  {
    id: '4dfa2513-8234-4502-99df-e3349bbd23e0',
    name: 'TP-Link EAP225 WiFi 5 AP',
    features: [
      'WiFi 5 AC1350 point d\'accès',
      'PoE 802.3af — alimentation par câble',
      'Montage plafond facile',
      'Gestion Omada centralisée',
      'Signal stable longue portée',
    ],
    specs_add: { 'Standard': 'WiFi 5 AC1350', 'PoE': '802.3af', 'Bandes': '2.4 + 5 GHz', 'Montage': 'Plafond', 'Gestion': 'Omada App' },
  },
  {
    id: '6e3bc102-313f-497c-8162-711681b6cabe',
    features: [
      'WiFi 6 AX3000 point d\'accès plafond',
      'PoE 802.3at 802.3af',
      'OFDMA + MU-MIMO 2×2',
      'Gestion centralisée Omada',
      'Couverture jusqu\'à 300 m²',
    ],
    specs_add: { 'Standard': 'WiFi 6 AX3000', 'PoE': '802.3at/af', 'MU-MIMO': '2×2', 'Gestion': 'Omada', 'Sécurité': 'WPA3' },
  },
  {
    id: '9766c53e-022d-4b7f-8b4f-3ddaa1c7b8a8',
    features: [
      'WiFi 6 AX1500 point d\'accès indoor',
      'PoE 802.3af — installation sans prise',
      'Signal uniforme jusqu\'à 140 m²',
      'WPA3 — sécurité maximale',
      'Gestion UniFi OS centralisée',
    ],
    specs_add: { 'Standard': 'WiFi 6 AX1500', 'PoE': '802.3af', 'Couverture': '140 m²', 'Sécurité': 'WPA3', 'Gestion': 'UniFi OS' },
  },

  // ══ CÂBLES ═════════════════════════════════════════════════════════════════
  {
    id: '9c8f3554-ddc2-4b74-acc9-0715d5655ccf',
    name: 'Câble RJ45 Cat6 Plat 20m',
    features: [
      'Câble plat discret — passe sous moquette',
      'Cat6 Gigabit jusqu\'à 1000 Mbps',
      'Connecteurs RJ45 plaqués or',
      'Longueur 20 mètres',
      'Compatible PoE et PoE+',
    ],
    specs_add: { 'Catégorie': 'Cat6 (600 MHz)', 'Longueur': '20 m', 'Débit max': '1 Gbps', 'Blindage': 'U/UTP', 'Connecteurs': 'RJ45 plaqués or', 'Format': 'Plat', 'Compatible PoE': 'Oui' },
  },
  {
    id: '459aed6c-3472-4676-b06d-767ac0cb3fc1',
    name: 'Câble RJ45 Cat6A 10m',
    features: [
      'Cat6A — 10 Gbps sur 100 m',
      'Blindage F/UTP contre interférences',
      'Connecteurs RJ45 sertis en usine',
      'Longueur 10 mètres',
      'Compatible PoE++ jusqu\'à 90W',
    ],
    specs_add: { 'Catégorie': 'Cat6A (500 MHz)', 'Longueur': '10 m', 'Débit max': '10 Gbps', 'Blindage': 'F/UTP', 'Connecteurs': 'RJ45 sertis', 'PoE++': 'Oui (90W)' },
  },
  {
    id: 'cb8506e6-6382-4ffd-9377-c004d8a650f9',
    name: 'Câble RJ45 Cat8 2m',
    features: [
      'Cat8 ultra-rapide — 40 Gbps',
      'Blindage SFTP double — interférences nulles',
      'Idéal data center et NAS haute vitesse',
      'Longueur 2 mètres',
      'Connecteurs RJ45 métal renforcé',
    ],
    specs_add: { 'Catégorie': 'Cat8 (2000 MHz)', 'Longueur': '2 m', 'Débit max': '40 Gbps', 'Blindage': 'SFTP', 'Connecteurs': 'Métal RJ45', 'Usage': 'Data center / NAS' },
  },
  {
    id: 'c4c6897d-469e-42ea-b0d1-3ab76cf7949c',
    name: 'Testeur Câble Réseau RJ45',
    features: [
      'Teste câbles RJ45, RJ11 et RJ45 blinde',
      '8 LED indicatrices par pin',
      'Détecte court-circuit et fil croisé',
      'Batterie 9V incluse',
      'Livré avec récepteur distant',
    ],
    specs_add: { 'Compatibilité': 'RJ45/RJ11/RJ12', 'LEDs': '8 par paire', 'Alimentation': 'Batterie 9V', 'Détection': 'Court-circuit, croisé, ouvert', 'Récepteur': 'Distant inclus' },
  },
  {
    id: '0438f76f-65ec-4d15-ab3d-a9cebe50b9b5',
    name: 'Câble RJ45 Cat6 5m',
    features: [
      'Cat6 Gigabit jusqu\'à 1000 Mbps',
      'Longueur idéale 5 mètres',
      'Connecteurs RJ45 dorés',
      'Gaine PVC flexible',
      'Compatible PoE',
    ],
    specs_add: { 'Catégorie': 'Cat6', 'Longueur': '5 m', 'Débit max': '1 Gbps', 'Connecteurs': 'RJ45 dorés', 'PoE': 'Oui' },
  },

  // ══ ESSENTIELS RÉSEAU ═══════════════════════════════════════════════════════
  {
    id: '8fea0da0-3c2a-460f-bf28-1b276aa1d2a6',
    name: 'Prise CPL TP-Link AV1000 Kit',
    features: [
      'CPL 1000 Mbps — internet par le réseau électrique',
      'Kit 2 prises — prêt à l\'emploi',
      'Port Gigabit LAN sur chaque prise',
      'Prise gigogne — ne bloque pas la prise murale',
      'Cryptage AES 128 bits automatique',
    ],
    specs_add: { 'Standard': 'HomePlug AV2', 'Débit': '1000 Mbps', 'Ports LAN': '1 × Gigabit / prise', 'Cryptage': 'AES 128 bits', 'Prise': 'Gigogne intégrée', 'Plug & Play': 'Oui' },
  },
  {
    id: '85e6b04a-024f-4c9f-b29a-2e072a1bd151',
    name: 'TP-Link T3U Clé WiFi AC1300',
    features: [
      'Clé WiFi AC1300 double bande USB 3.0',
      'Antenne orientable haute performance',
      'Compatible Windows, Mac et Linux',
      'Plug & Play — installation pilote simple',
      'Débit jusqu\'à 400 + 867 Mbps',
    ],
    specs_add: { 'Standard': 'WiFi 5 AC1300', 'Interface': 'USB 3.0', 'Bandes': '2.4 GHz + 5 GHz', 'Antenne': 'Pliable orientable', 'OS': 'Windows/Mac/Linux', 'Chipset': 'Realtek' },
  },
  {
    id: '77802859-a2a7-48cb-97c9-94fba3a9bbfa',
    name: 'TP-Link RE305 Répéteur WiFi',
    features: [
      'Répéteur WiFi AC1200 double bande',
      'Port Ethernet Gigabit intégré',
      'LED indicateur de signal optimal',
      'Compatible tous routeurs',
      'Configuration en 1 clic WPS',
    ],
    specs_add: { 'Standard': 'WiFi 5 AC1200', 'Bandes': '2.4 + 5 GHz', 'Port LAN': '1 × Gigabit', 'Bouton': 'WPS 1 clic', 'LED': 'Indicateur signal' },
  },
  {
    id: '8501ba29-d1fa-48cc-be3a-46fc12dcb69e',
    name: 'Câble RJ45 Cat6 3m',
    features: [
      'Cat6 Gigabit — longueur courte 3 m',
      'Idéal connexion box/routeur/switch',
      'Connecteurs RJ45 dorés',
      'Gaine flexible',
      'Compatible PoE',
    ],
    specs_add: { 'Catégorie': 'Cat6', 'Longueur': '3 m', 'Débit': '1 Gbps', 'Connecteurs': 'RJ45 dorés' },
  },
];

// ── Nouveau produit essentiel-reseau (5ème) ───────────────────────────────────
const NEW_PRODUCT = {
  name       : 'TP-Link RE330 Répéteur WiFi 5',
  subtitle   : 'AC1200 — 1200 Mbps — Prise murale',
  brand      : 'TP-Link',
  category_id: '14a21dbd-805a-4a9e-bbbd-f5278766c9ed',
  price_eur  : 34.99,
  price_kmf  : Math.round(34.99 * 492),
  badge      : 'Nouveau', badge_class: 'badge--new',
  status     : 'active',
  description: 'Le TP-Link RE330 est un répéteur WiFi 5 AC1200 prise murale. Il double la couverture de votre réseau WiFi existant. Compatible tous routeurs, il s\'installe en une minute via le bouton WPS.',
  features   : [
    'Répéteur WiFi 5 AC1200 prise murale',
    'Double la couverture WiFi existante',
    'Port Ethernet Gigabit intégré',
    'Installation WPS en 1 clic',
    'Compatible tous routeurs du marché',
  ],
  specs: {
    'Standard'  : 'WiFi 5 AC1200',
    'Bandes'    : '2.4 GHz + 5 GHz',
    'Débit'     : '300 + 867 Mbps',
    'Port LAN'  : '1 × Gigabit',
    'Bouton WPS': 'Oui',
    'Format'    : 'Prise murale',
    'Sécurité'  : 'WPA2/WPA3',
  },
  slug: 'tp-link-re330',
};

// ── Generate image pour nouveau produit ──────────────────────────────────────
async function generateAndUpload(slug, svgStr) {
  const buf = await sharp(Buffer.from(svgStr)).png({ quality: 90 }).toBuffer();
  const p   = `reseau/${slug}-1.png`;
  const { error } = await sb.storage.from('products').upload(p, buf, { contentType: 'image/png', upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl;
}

function buildRepeaterSVG() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">
    <defs>
      <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#f8fafc"/><stop offset="100%" style="stop-color:#e2e8f0"/>
      </linearGradient>
      <linearGradient id="c" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" style="stop-color:#059669"/><stop offset="100%" style="stop-color:#34d399"/>
      </linearGradient>
    </defs>
    <rect width="800" height="600" fill="url(#bg)" rx="16"/>
    <rect x="80" y="60" width="640" height="480" rx="20" fill="white" filter="url(#sh)"/>
    <filter id="sh"><feDropShadow dx="0" dy="8" stdDeviation="20" flood-color="#00000022"/></filter>
    <rect x="80" y="60" width="640" height="8" rx="20" fill="url(#c)"/>
    <!-- Prise murale dessinée -->
    <rect x="310" y="130" width="180" height="220" rx="20" fill="#1e293b"/>
    <rect x="320" y="140" width="160" height="200" rx="16" fill="#334155"/>
    <!-- LED verte -->
    <circle cx="400" cy="175" r="12" fill="#22c55e"/>
    <circle cx="400" cy="175" r="6" fill="#86efac"/>
    <!-- Signal WiFi -->
    <path d="M360 235 q40,-40 80,0" stroke="#22c55e" stroke-width="6" fill="none" stroke-linecap="round" opacity="0.9"/>
    <path d="M345 215 q55,-60 110,0" stroke="#22c55e" stroke-width="5" fill="none" stroke-linecap="round" opacity="0.6"/>
    <path d="M330 195 q70,-80 140,0" stroke="#22c55e" stroke-width="4" fill="none" stroke-linecap="round" opacity="0.3"/>
    <!-- Broche prise -->
    <rect x="365" y="290" width="20" height="30" rx="4" fill="#94a3b8"/>
    <rect x="415" y="290" width="20" height="30" rx="4" fill="#94a3b8"/>
    <!-- Nom -->
    <text x="400" y="410" text-anchor="middle" font-family="Arial,sans-serif" font-size="28" font-weight="800" fill="#0f172a">RE330 Répéteur WiFi</text>
    <text x="400" y="445" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" fill="#64748b">AC1200 · Prise murale</text>
    <rect x="270" y="460" width="120" height="32" rx="16" fill="#f1f5f9"/>
    <text x="330" y="481" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#059669">WiFi 5 AC1200</text>
    <rect x="410" y="460" width="120" height="32" rx="16" fill="#f1f5f9"/>
    <text x="470" y="481" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="600" fill="#059669">WPS 1-clic</text>
  </svg>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  const log = [];
  let fixed = 0, created = 0;

  console.log(`\n🔧 Nettoyage qualité — ${FIXES.length} produits\n${'─'.repeat(60)}`);

  for (const f of FIXES) {
    const update = { updated_at: new Date().toISOString() };
    if (f.name) update.name = f.name;
    if (f.badge) update.badge = f.badge;
    if (f.badge_class) update.badge_class = f.badge_class;
    if (f.features) update.features = f.features;

    if (f.specs_add) {
      // Merge existing specs with new ones
      const { data: cur } = await sb.from('products').select('name,specs').eq('id', f.id).single();
      update.specs = { ...(cur?.specs || {}), ...f.specs_add };
      console.log(`  📦 ${cur?.name} → specs: ${Object.keys(update.specs).length} lignes`);
    }

    const { error } = await sb.from('products').update(update).eq('id', f.id);
    if (error) {
      console.log(`  ❌ ${f.id}: ${error.message}`);
      log.push({ id: f.id, status: 'error', reason: error.message });
    } else {
      fixed++;
      log.push({ id: f.id, name: f.name || '(unchanged)', status: 'fixed', changes: Object.keys(update).filter(k => k !== 'updated_at') });
    }
  }

  // ── Crée 5ème produit essentiel-reseau ──────────────────────────────────────
  console.log('\n🆕 Création 5ème produit essentiel-reseau...');
  const imgUrl = await generateAndUpload(NEW_PRODUCT.slug, buildRepeaterSVG());
  console.log('  ✅ Image uploadée:', imgUrl.slice(0, 70));

  const np = {
    ...NEW_PRODUCT,
    main_image_url: imgUrl,
    image         : imgUrl,
    gallery_urls  : [imgUrl],
    gallery       : [imgUrl],
    created_at    : new Date().toISOString(),
    updated_at    : new Date().toISOString(),
  };
  delete np.slug;

  const { data: inserted, error: insErr } = await sb.from('products').insert(np).select('id').single();
  if (insErr) {
    console.log('  ❌ Insert:', insErr.message);
  } else {
    created++;
    console.log('  💾 Créé ID:', inserted.id);
    log.push({ id: inserted.id, name: NEW_PRODUCT.name, status: 'created', reason: '5ème produit essentiel-reseau' });
  }

  // ── Rapport ─────────────────────────────────────────────────────────────────
  const counts = {};
  const CAT_IDS = ['34fa9f24-4816-47ae-9812-87bcad4cfd9c','0c45de00-d9ae-4faa-8efe-c43fd4e8f29a','c4126bdd-ec21-4012-b713-548c85847921','31b860d5-f9c3-420f-90ea-4b1e8a6c79d9','746fd402-03a0-4408-8b90-895d4da85cf0','14a21dbd-805a-4a9e-bbbd-f5278766c9ed'];
  const CATNAMES = {'34fa9f24':'routeur-wifi','0c45de00':'routeur-4g5g','c4126bdd':'switch','31b860d5':'point-acces','746fd402':'cable','14a21dbd':'essentiel-reseau'};
  const { data: all } = await sb.from('products').select('id,name,category_id,status,price_eur,main_image_url,features,specs').in('category_id', CAT_IDS).eq('status','active');

  const byTab = {};
  all.forEach(p => {
    const t = CATNAMES[p.category_id.slice(0,8)] || '?';
    if (!byTab[t]) byTab[t] = [];
    byTab[t].push(p);
  });

  let report = `# Rapport nettoyage — Section Réseau\n_${new Date().toLocaleDateString('fr-FR')} — ${new Date().toLocaleTimeString('fr-FR')}_\n\n`;
  report += `## Résumé\n- Produits corrigés : **${fixed}**\n- Produits créés : **${created}**\n- Total onglets : 6\n\n`;
  report += `## Produits par onglet\n\n`;

  for (const [tab, prods] of Object.entries(byTab)) {
    report += `### ${tab} (${prods.length} produits)\n`;
    prods.forEach(p => {
      const specs = Object.keys(p.specs || {}).length;
      const feats = (p.features || []).length;
      const imgs  = 0; // not fetching gallery here
      const q = [p.price_eur > 0, p.name.length <= 30, feats >= 3, specs >= 5].filter(Boolean).length;
      report += `- **${p.name}** · €${p.price_eur} · ${feats} features · ${specs} specs · qualité ${q}/4\n`;
    });
    report += '\n';
  }

  report += `## Décisions\n`;
  report += `| Produit | Statut | Raison |\n|---------|--------|--------|\n`;
  log.forEach(l => {
    report += `| ${l.name || l.id} | ${l.status} | ${l.reason || l.changes?.join(', ') || '—'} |\n`;
  });

  report += `\n## Onglets incomplets\n`;
  let allOk = true;
  for (const [tab, prods] of Object.entries(byTab)) {
    if (prods.length !== 5) {
      report += `- ⚠️ **${tab}**: ${prods.length}/5 produits\n`;
      allOk = false;
    }
  }
  if (allOk) report += `_Tous les onglets ont exactement 5 produits._\n`;

  fs.writeFileSync(REPORT_PATH, report);
  console.log(`\n📄 Rapport: data-cleanup/products-cleanup-report.md`);

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ Corrigés: ${fixed} · Créés: ${created}`);
  for (const [tab, prods] of Object.entries(byTab)) {
    console.log(`  [${tab}]: ${prods.length} produits`);
  }
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
