// scripts/create-imprimantes.js
// Crée 25 produits imprimantes avec vraies images Amazon via Playwright
const { chromium } = require('playwright');
const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function dl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'image/*' } }, res => {
      if ([301,302,307].includes(res.statusCode) && res.headers.location) return dl(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode));
      const ct = res.headers['content-type'] || 'image/jpeg';
      const c = []; res.on('data', d => c.push(d)); res.on('end', () => resolve({ buf: Buffer.concat(c), ct }));
    });
    req.on('error', reject); req.setTimeout(15000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}
async function up(buf, ct, slug, n) {
  const ext = ct.includes('png') ? 'png' : 'jpg';
  const p = `imprimantes/${slug}-${n}.${ext}`;
  const { error } = await sb.storage.from('products').upload(p, buf, { contentType: ct, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl;
}

// ── Catalogue 25 produits ─────────────────────────────────────────────────────
const PRODUCTS = [

  // ── JET D'ENCRE (0029d2b4-b4bc-4792-97ee-2253b6b701e4) ──────────────────
  { cat: '0029d2b4-b4bc-4792-97ee-2253b6b701e4', slug: 'hp-deskjet-2820e',
    name: 'HP DeskJet 2820e',
    subtitle: 'Jet d\'encre · WiFi · Noir+Couleur',
    brand: 'HP', price_eur: 59.99, price_kmf: 29515,
    badge: 'Entrée gamme', badge_class: 'badge--deal',
    rating: 4, rating_count: 3842,
    query: 'HP DeskJet 2820e imprimante jet encre wifi',
    description: "L'HP DeskJet 2820e est l'imprimante jet d'encre idéale pour la maison. WiFi intégré, impression recto-verso automatique et compatible HP+ pour des cartouches livrées automatiquement. Compacte et facile à installer via l'application HP Smart.",
    features: ['WiFi intégré — impression depuis mobile ou PC','Impression recto-verso automatique','Compatible HP+ — cartouches livrées automatiquement','Scanner à plat intégré 1200 dpi','Configuration rapide via app HP Smart'],
    specs: {'Technologie':'Jet d\'encre thermique','Couleur':'Oui (noir + couleur)','Vitesse (noir)':'8 pages/min','Vitesse (couleur)':'5,5 pages/min','Résolution max':'1200×1200 dpi','Connectivité':'WiFi, USB','Scanner':'Oui, 1200 dpi','Format papier':'A4, A5, B5, enveloppe','Capacité bac':'60 feuilles','Cartouches':'305 / 305XL','Recto-verso':'Automatique','Dimensions':'42,6 × 21,7 × 15,8 cm','Poids':'4,98 kg','Compatible':'Windows, macOS','Garantie':'1 an constructeur'} },

  { cat: '0029d2b4-b4bc-4792-97ee-2253b6b701e4', slug: 'epson-xp-2200',
    name: 'Epson Expression XP-2200',
    subtitle: 'Jet d\'encre · WiFi · Scanner plat',
    brand: 'Epson', price_eur: 49.99, price_kmf: 24595,
    badge: 'Populaire', badge_class: 'badge--popular',
    rating: 4, rating_count: 2156,
    query: 'Epson Expression Home XP-2200 imprimante',
    description: "L'Epson Expression Home XP-2200 est une imprimante 3-en-1 (impression, copie, numérisation) compacte pour la maison. Impression WiFi sans fil, cartouches individuelles pour économiser l'encre, et interface simple pour une utilisation quotidienne.",
    features: ['3-en-1 : impression, copie, scan','Cartouches individuelles — remplacez uniquement ce qui est vide','WiFi direct sans routeur','Écran LCD de navigation','Compatible Epson Creative Print'],
    specs: {'Technologie':'Jet d\'encre Micro Piezo','Couleur':'Oui','Vitesse (noir)':'8,8 ipm','Vitesse (couleur)':'4,7 ipm','Résolution':'5760×1440 dpi','Connectivité':'WiFi, USB 2.0','Scanner':'Oui, plat 600×1200 dpi','Format':'A4','Bac papier':'100 feuilles','Cartouches':'603 / 603XL','Dimensions':'38,9×18,5×22,8 cm','Poids':'3,7 kg','OS':'Windows 10/11, macOS','Garantie':'1 an','Certifications':'Energy Star'} },

  { cat: '0029d2b4-b4bc-4792-97ee-2253b6b701e4', slug: 'canon-pixma-ts3550i',
    name: 'Canon PIXMA TS3550i',
    subtitle: 'Jet d\'encre · WiFi · 3-en-1',
    brand: 'Canon', price_eur: 79.99, price_kmf: 39355,
    badge: 'Best seller', badge_class: 'badge--best',
    rating: 4, rating_count: 4521,
    query: 'Canon PIXMA TS3550i imprimante jet encre',
    description: "Le Canon PIXMA TS3550i est une imprimante jet d'encre multifonction WiFi pour toute la famille. Compatible avec Canon PRINT Inkjet/SELPHY pour imprimer depuis smartphone, tablette ou ordinateur. La technologie FINE garantit des textes nets et des photos éclatantes.",
    features: ['PIXMA Print Plan — abonnement cartouches auto','Impression sans fil depuis mobile (AirPrint, Mopria)','Technologie FINE — textes nets, photos éclatantes','Copie directe sans PC','Interface intuitive — boutons simplifiés'],
    specs: {'Technologie':'Jet d\'encre FINE','Couleur':'Oui (4 cartouches)','Vitesse (noir)':'8 ipm','Vitesse (couleur)':'5 ipm','Résolution':'4800×1200 dpi','WiFi':'Oui + Wi-Fi Direct','Scanner':'1200×1200 dpi optique','Format':'A4','Bac entrée':'60 feuilles','Cartouches':'PG-560 / CL-561','Recto-verso':'Manuel','Formats photo':'10×15 cm, 13×18 cm','Poids':'4,4 kg','Garantie':'1 an','Eco mode':'Oui'} },

  { cat: '0029d2b4-b4bc-4792-97ee-2253b6b701e4', slug: 'brother-dcpj1200w',
    name: 'Brother DCP-J1200W',
    subtitle: 'Jet d\'encre · WiFi · Compact',
    brand: 'Brother', price_eur: 69.99, price_kmf: 34435,
    badge: 'Compact', badge_class: 'badge--popular',
    rating: 4, rating_count: 1873,
    query: 'Brother DCP-J1200W imprimante jet encre wifi',
    description: "Le Brother DCP-J1200W est une imprimante 3-en-1 jet d'encre ultra-compacte pour les petits espaces. Sa consommation d'encre optimisée et la compatibilité avec Brother Print&Scan en font un choix économique pour le bureau à domicile.",
    features: ['Ultra-compact — le plus petit de sa gamme','Cartouches LC420 longue durée','3-en-1 : impression, copie, numérisation','WiFi + USB 2.0','Application Brother Print & Scan'],
    specs: {'Technologie':'Jet d\'encre piézoélectrique','Couleur':'Oui','Vitesse':'17 ppm noir / 9,5 ppm couleur','Résolution':'1200×6000 dpi','WiFi':'Oui','Bluetooth':'Non','Scanner':'600×1200 dpi','Capacité bac':'100 feuilles','Cartouches':'LC420','Format max':'A4','Dimensions':'37,2×18,5×19,8 cm','Poids':'4,0 kg','Interface':'USB 2.0, WiFi','OS':'Windows, macOS, Linux','Garantie':'1 an'} },

  { cat: '0029d2b4-b4bc-4792-97ee-2253b6b701e4', slug: 'epson-ecotank-et2870',
    name: 'Epson EcoTank ET-2870',
    subtitle: 'Jet d\'encre · Réservoir · WiFi',
    brand: 'Epson', price_eur: 199.99, price_kmf: 98395,
    badge: 'Économique', badge_class: 'badge--popular',
    rating: 5, rating_count: 2891,
    query: 'Epson EcoTank ET-2870 imprimante réservoir',
    description: "L'Epson EcoTank ET-2870 révolutionne l'impression avec ses réservoirs d'encre rechargeables. Zéro cartouche — les bouteilles incluses permettent d'imprimer jusqu'à 4500 pages en noir et 7500 en couleur. Idéale pour les familles qui impriment beaucoup.",
    features: ['Réservoirs rechargeables — pas de cartouches','4500 pages noir / 7500 couleur incluses','Économies jusqu\'à 90% vs cartouches classiques','3-en-1 : impression, copie, scan','WiFi + Wi-Fi Direct'],
    specs: {'Technologie':'Jet d\'encre Micro Piezo','Réservoirs':'Rechargeables (sans cartouche)','Capacité initiale':'4500 pages noir / 7500 couleur','Vitesse':'10 ipm noir / 5 ipm couleur','Résolution':'5760×1440 dpi','WiFi':'Oui + Wi-Fi Direct','Scanner':'1200×2400 dpi','Format':'A4','Bac':'100 feuilles','Dimensions':'37,5×20,8×23,5 cm','Poids':'4,0 kg','Couleurs encre':'Noir, Cyan, Magenta, Jaune','Garantie':'1 an (2 ans avec enregistrement)','Certification':'Energy Star','EAN':'8715946720913'} },

  // ── MULTIFONCTION (77117756-d1be-4857-84a1-67c478c1dab9) ────────────────
  { cat: '77117756-d1be-4857-84a1-67c478c1dab9', slug: 'hp-officejet-pro-9015e',
    name: 'HP OfficeJet Pro 9015e',
    subtitle: 'Multifonction · WiFi · Recto-verso',
    brand: 'HP', price_eur: 249.99, price_kmf: 122995,
    badge: 'Pro', badge_class: 'badge--exclusive',
    rating: 5, rating_count: 3241,
    query: 'HP OfficeJet Pro 9015e multifonction imprimante',
    description: "L'HP OfficeJet Pro 9015e est une imprimante multifonction professionnelle WiFi 4-en-1. Impression recto-verso automatique, chargeur de documents 35 feuilles, fax intégré et compatible HP+ pour une gestion simplifiée. Idéale pour les PME et le télétravail.",
    features: ['4-en-1 : impression, copie, scan, fax','Chargeur automatique 35 feuilles (ADF)','Recto-verso automatique impression et scan','Compatible HP+ — 6 mois d\'encre offerts','Impression sécurisée avec PIN'],
    specs: {'Technologie':'Jet d\'encre thermique','Fonctions':'Impression, Copie, Scan, Fax','Vitesse':'22 ppm noir / 18 ppm couleur','Résolution':'4800×1200 dpi','WiFi':'Oui + Ethernet + USB','Scanner':'1200 dpi','ADF':'35 feuilles','Capacité bac':'250 feuilles','Recto-verso':'Automatique','Format':'A4','Écran':'2,65" tactile couleur','Cartouches':'910 / 910XL','Poids':'9 kg','Dimensions':'42,2×36,3×20,3 cm','Garantie':'1 an'} },

  { cat: '77117756-d1be-4857-84a1-67c478c1dab9', slug: 'epson-ecotank-et4850',
    name: 'Epson EcoTank ET-4850',
    subtitle: 'Multifonction · Réservoir · Fax',
    brand: 'Epson', price_eur: 379.99, price_kmf: 186955,
    badge: 'Premium', badge_class: 'badge--exclusive',
    rating: 5, rating_count: 1654,
    query: 'Epson EcoTank ET-4850 multifonction imprimante',
    description: "L'Epson EcoTank ET-4850 est une multifonction premium avec réservoirs rechargeables. Son chargeur automatique de documents 50 feuilles, le fax intégré et les réservoirs basse consommation en font la solution idéale pour les petites entreprises économes.",
    features: ['Réservoirs rechargeables — coût à la page minimal','ADF 50 feuilles pour scan/copie recto-verso','Fax intégré avec mémoire 180 pages','Écran tactile 4,3 pouces','Impression A4 et photos jusqu\'à 13×18 cm'],
    specs: {'Technologie':'Micro Piezo','Fonctions':'Impression, Copie, Scan, Fax','Vitesse':'15 ipm / 8 ipm couleur','Résolution':'4800×1200 dpi','Scanner':'1200 dpi optique','ADF':'50 feuilles','Bac':'250 feuilles','Recto-verso':'Automatique','Connectivité':'WiFi, Ethernet, USB','Écran':'4,3" tactile','Fax':'Oui, 180 pages mémoire','Poids':'7,5 kg','Format':'A4','EAN':'8715946710488','Garantie':'2 ans avec enregistrement'} },

  { cat: '77117756-d1be-4857-84a1-67c478c1dab9', slug: 'canon-pixma-ts8351a',
    name: 'Canon PIXMA TS8351a',
    subtitle: 'Multifonction · 6 encres · WiFi',
    brand: 'Canon', price_eur: 149.99, price_kmf: 73795,
    badge: 'Photo', badge_class: 'badge--popular',
    rating: 4, rating_count: 2187,
    query: 'Canon PIXMA TS8351a multifonction photo',
    description: "Le Canon PIXMA TS8351a est une multifonction 3-en-1 haut de gamme avec système 6 cartouches d'encre pour une qualité photo professionnelle. Son écran tactile de 10,8 cm et la compatibilité AirPrint/Mopria en font une solution complète pour la maison et le bureau.",
    features: ['6 encres — qualité photo professionnelle','Impression photo 10×15 cm sans bordure','Écran tactile 4,3 pouces','Compatible AirPrint, Mopria, Google Cloud Print','Numérisation 9600×9600 dpi optique'],
    specs: {'Technologie':'Jet d\'encre FINE','Encres':'6 couleurs dont gris','Vitesse':'15 ipm / 10 ipm couleur','Résolution':'4800×1200 dpi','Scanner':'4800×4800 dpi optique','Format max':'A4','Bac':'100 feuilles','Recto-verso':'Automatique','Connectivité':'WiFi, USB, Bluetooth','Écran':'4,3" tactile couleur','Cartouches':'PGI-580 / CLI-581','Photo 10×15':'1 min 42 s','Poids':'6,3 kg','Garantie':'1 an','Certifications':'Energy Star'} },

  { cat: '77117756-d1be-4857-84a1-67c478c1dab9', slug: 'brother-mfcj5340dw',
    name: 'Brother MFC-J5340DW',
    subtitle: 'Multifonction · A3 · Pro',
    brand: 'Brother', price_eur: 229.99, price_kmf: 113155,
    badge: 'Pro A3', badge_class: 'badge--exclusive',
    rating: 4, rating_count: 892,
    query: 'Brother MFC-J5340DW multifonction A3 imprimante',
    description: "Le Brother MFC-J5340DW est une multifonction jet d'encre A3 professionnelle. Seule multifonction à prix abordable capable d'imprimer en A3, idéale pour les artistes, architectes et professionnels ayant besoin de grands formats. WiFi, Ethernet et ADF 50 feuilles inclus.",
    features: ['Format A3 — impression grands formats','ADF 50 feuilles pour scan/copie rapide','Cartouches XXL ultra longue durée','Connectivité WiFi + Ethernet + USB','Impression recto-verso automatique A4 et A3'],
    specs: {'Technologie':'Jet d\'encre','Format max':'A3 (impression), A4 (scan)','Fonctions':'Impression, Copie, Scan, Fax','Vitesse':'22 ipm / 20 ipm','Résolution':'1200×4800 dpi','Scanner':'1200 dpi','ADF':'50 feuilles A4','Bac':'250 feuilles','Connectivité':'WiFi, Ethernet, USB, NFC','Cartouches':'LC3617 / LC3619XL','Recto-verso':'Automatique A4/A3','Poids':'17 kg','Garantie':'1 an','Certifications':'ISO/IEC 24711'} },

  { cat: '77117756-d1be-4857-84a1-67c478c1dab9', slug: 'hp-laserjet-mfp-m140we',
    name: 'HP LaserJet MFP M140we',
    subtitle: 'Multifonction · Laser · Compact',
    brand: 'HP', price_eur: 139.99, price_kmf: 68875,
    badge: 'Bureau', badge_class: 'badge--popular',
    rating: 4, rating_count: 1543,
    query: 'HP LaserJet MFP M140we imprimante laser multifonction',
    description: "L'HP LaserJet MFP M140we est une imprimante multifonction laser compacte pour le bureau à domicile. Compatible HP+, elle offre 2 ans de service HP Instant Ink inclus et une impression rapide à 20 pages/min. Son format compact s'intègre partout.",
    features: ['2 ans HP Instant Ink inclus avec HP+','20 pages/min — impression laser rapide','3-en-1 : impression, copie, numérisation','WiFi + Wi-Fi Direct + USB','Application HP Smart pour mobile'],
    specs: {'Technologie':'Laser monochrome','Fonctions':'Impression, Copie, Scan','Vitesse':'20 ppm','Résolution':'600×600 dpi','Scanner':'1200 dpi','Capacité bac':'150 feuilles','Format':'A4','Connectivité':'WiFi, USB 2.0','Cartouche':'W1143A/W1143X','Cycle mensuel max':'8000 pages','Dimensions':'36×22,9×21,4 cm','Poids':'4,1 kg','Écran':'LED','Garantie':'1 an','Certification':'Energy Star'} },

  // ── LASER (806b3473-646a-489f-adbb-d37b81bbe50b) ─────────────────────────
  { cat: '806b3473-646a-489f-adbb-d37b81bbe50b', slug: 'hp-laserjet-pro-m15w',
    name: 'HP LaserJet Pro M15w',
    subtitle: 'Laser · Compact · WiFi',
    brand: 'HP', price_eur: 99.99, price_kmf: 49195,
    badge: 'Compact', badge_class: 'badge--deal',
    rating: 4, rating_count: 3125,
    query: 'HP LaserJet Pro M15w imprimante laser wifi compact',
    description: "L'HP LaserJet Pro M15w est l'imprimante laser WiFi la plus compacte du marché. Sa technologie Micro Laser garantit une qualité professionnelle à 600 dpi. Parfaite pour les petits bureaux et le télétravail où l'espace est limité.",
    features: ['La plus compacte des lasers HP','WiFi intégré — impression sans câble','19 pages/min — rapidité laser','Toner HP 48A longue durée disponible','Empreinte ultra-réduite : 26 cm de largeur'],
    specs: {'Technologie':'Laser monochrome','Vitesse':'19 ppm','Résolution':'600×600 dpi (1200×1200 lpi)','Capacité bac':'150 feuilles','Format':'A4, A5, Lettre, enveloppe','Connectivité':'WiFi, USB 2.0','Cartouche':'CF248A (48A)','Cycle mensuel':'8000 pages','Dimensions':'26,5×14,6×21,3 cm','Poids':'4,35 kg','Écran':'LED + boutons','Compatibilité':'Windows, macOS','Garantie':'1 an','Certification':'Energy Star','EAN':'0192018460701'} },

  { cat: '806b3473-646a-489f-adbb-d37b81bbe50b', slug: 'brother-hl-l2350dw',
    name: 'Brother HL-L2350DW',
    subtitle: 'Laser · Recto-verso · WiFi',
    brand: 'Brother', price_eur: 129.99, price_kmf: 63955,
    badge: 'Recto-verso', badge_class: 'badge--popular',
    rating: 4, rating_count: 2453,
    query: 'Brother HL-L2350DW imprimante laser recto-verso wifi',
    description: "Le Brother HL-L2350DW est une imprimante laser monochrome avec impression recto-verso automatique intégrée. Jusqu'à 30 ppm, WiFi natif et bac 250 feuilles font de cette imprimante la référence pour les petites équipes ou le télétravail intensif.",
    features: ['Recto-verso automatique — économie papier 50%','30 ppm — parmi les plus rapides de sa gamme','WiFi + Ethernet + USB','Bac 250 feuilles — moins de rechargements','Toner TN-2420 haute capacité'],
    specs: {'Technologie':'Laser monochrome','Vitesse':'30 ppm','Résolution':'2400×600 dpi','Recto-verso':'Automatique','Bac':'250 feuilles','Format':'A4','Connectivité':'WiFi, Ethernet, USB 2.0','Toner':'TN-2420 (3000 pages)','Cycle mensuel max':'15000 pages','Dimensions':'36×18×18,6 cm','Poids':'7,5 kg','Mémoire':'32 Mo','Garantie':'1 an','Certifications':'ISO 9001, Energy Star','EAN':'4977766782876'} },

  { cat: '806b3473-646a-489f-adbb-d37b81bbe50b', slug: 'canon-sensys-lbp6030w',
    name: 'Canon i-SENSYS LBP6030w',
    subtitle: 'Laser · WiFi · Silencieux',
    brand: 'Canon', price_eur: 89.99, price_kmf: 44275,
    badge: 'Silencieux', badge_class: 'badge--popular',
    rating: 4, rating_count: 1876,
    query: 'Canon i-SENSYS LBP6030w imprimante laser wifi',
    description: "Le Canon i-SENSYS LBP6030w est une imprimante laser WiFi compacte et silencieuse. Sa technologie Whisper Mode garantit une impression discrète à moins de 49 dB. Idéale pour les appartements, bibliothèques et espaces de travail partagés.",
    features: ['Mode silencieux Whisper — moins de 49 dB','WiFi natif — installation sans câble','Impression 1ère page en moins de 8 secondes','Consommation veille : 0,9 W seulement','Cartouche CRG-725 facilement remplaçable'],
    specs: {'Technologie':'Laser monochrome','Vitesse':'18 ppm','Résolution':'2400 (IP) × 600 dpi','Mode silencieux':'< 49 dB','Bac':'150 feuilles','Format':'A4','Connectivité':'WiFi, USB 2.0','Cartouche':'CRG-725 (1600 pages)','Mémoire':'32 Mo','1ère page':'< 8 secondes','Dimensions':'33×21,7×19,8 cm','Poids':'4,6 kg','Consommation veille':'0,9 W','Garantie':'1 an','Certification':'Energy Star'} },

  { cat: '806b3473-646a-489f-adbb-d37b81bbe50b', slug: 'samsung-xpress-m2026w',
    name: 'Samsung Xpress M2026W',
    subtitle: 'Laser · Compact · Économique',
    brand: 'Samsung', price_eur: 109.99, price_kmif: 54115,
    price_kmf: 54115,
    badge: 'Économique', badge_class: 'badge--deal',
    rating: 4, rating_count: 1243,
    query: 'Samsung Xpress M2026W imprimante laser compact',
    description: "Le Samsung Xpress SL-M2026W est une imprimante laser monochrome WiFi compacte et économique. Sa technologie ReCP (Rendering Engine for Clean Page) garantit des impressions nettes même à haute vitesse. Cartouches rechargeables compatibles disponibles.",
    features: ['Technologie ReCP — textes nets à haute vitesse','WiFi intégré — impression mobile','Toner MLT-D111L haute capacité 1000 pages','Démarrage rapide en 15 secondes','Interface intuitive — 1 bouton d\'impression'],
    specs: {'Technologie':'Laser monochrome','Vitesse':'21 ppm','Résolution':'1200×1200 dpi','Bac':'150 feuilles','Format':'A4, Lettre','Connectivité':'WiFi, USB 2.0','Toner':'MLT-D111S/L','Mémoire':'32 Mo','Démarrage':'15 secondes','1ère page':'< 8,5 s','Dimensions':'33×21,4×17,7 cm','Poids':'4,62 kg','Consommation':'300 W impression / 1,2 W veille','Garantie':'1 an','Cycles mensuels':'10000 pages'} },

  { cat: '806b3473-646a-489f-adbb-d37b81bbe50b', slug: 'lexmark-b2236dw',
    name: 'Lexmark B2236dw',
    subtitle: 'Laser · Recto-verso · Pro',
    brand: 'Lexmark', price_eur: 149.99, price_kmf: 73795,
    badge: 'Pro', badge_class: 'badge--popular',
    rating: 4, rating_count: 743,
    query: 'Lexmark B2236dw imprimante laser recto-verso wifi',
    description: "Le Lexmark B2236dw est une imprimante laser professionnelle avec recto-verso automatique et une vitesse de 36 ppm. Sa conception robuste et son cycle mensuel de 30000 pages en font le choix idéal pour les petites équipes professionnelles.",
    features: ['36 ppm — une des plus rapides de sa gamme','Recto-verso automatique intégré','Cycle mensuel 30000 pages — robustesse pro','WiFi + Ethernet + USB 2.0','Bac 250 feuilles extensible à 900'],
    specs: {'Technologie':'Laser monochrome','Vitesse':'36 ppm','Résolution':'1200×1200 dpi','Recto-verso':'Automatique','Bac standard':'250 feuilles','Bac max':'900 feuilles','Format':'A4','Connectivité':'WiFi, Ethernet, USB 2.0','Toner':'B220H00 (3000 pages)','Cycle mensuel':'30000 pages','Mémoire':'256 Mo','Dimensions':'36,7×28,4×22,2 cm','Poids':'8,4 kg','Garantie':'1 an','Certifications':'Energy Star, EPEAT Silver'} },

  // ── MATRICIELLE (a2be77ae-4858-4983-9487-f4655621401d) ───────────────────
  { cat: 'a2be77ae-4858-4983-9487-f4655621401d', slug: 'epson-lx-350',
    name: 'Epson LX-350',
    subtitle: 'Matricielle · A4 · Continu',
    brand: 'Epson', price_eur: 299.99, price_kmf: 147595,
    badge: 'Pro', badge_class: 'badge--exclusive',
    rating: 4, rating_count: 892,
    query: 'Epson LX-350 imprimante matricielle aiguilles',
    description: "L'Epson LX-350 est une imprimante matricielle à aiguilles fiable pour les environnements professionnels nécessitant l'impression sur papier continu, multicouches ou tickets. Sa robustesse, sa compatibilité grand format et sa vitesse de 350 cps en font une référence industrie.",
    features: ['350 cps — vitesse haute performance','Compatible papier continu et feuilles simples','Impression multicouches (jusqu\'à 5 copies)','Tête d\'impression 9 aiguilles haute durabilité','Interface USB + parallèle inclus'],
    specs: {'Technologie':'Matricielle 9 aiguilles','Vitesse':'350 cps (mode brouillon)','Largeur papier':'A4 (max 257 mm)','Papier':'Continu, feuilles, multicouches','Copies':'Original + 4 copies carbone','Connectivité':'USB 2.0 + Parallèle','Résolution':'240×144 dpi','MTBF':'10 millions de caractères','Format':'LX-350','Dimensions':'36×15,7×10,9 cm','Poids':'2,4 kg','Tension':'220-240 V','Garantie':'1 an','Compatible':'Windows, Linux DOS','EAN':'8715946553283'} },

  { cat: 'a2be77ae-4858-4983-9487-f4655621401d', slug: 'epson-fx-890ii',
    name: 'Epson FX-890II',
    subtitle: 'Matricielle · A4 · Grande vitesse',
    brand: 'Epson', price_eur: 599.99, price_kmf: 295195,
    badge: 'Industriel', badge_class: 'badge--exclusive',
    rating: 5, rating_count: 423,
    query: 'Epson FX-890II imprimante matricielle industrielle',
    description: "L'Epson FX-890II est une imprimante matricielle industrielle haute vitesse pour les environnements de production intensive. Avec 680 cps et une tête d'impression de 1 million de caractères MTBF, elle est conçue pour les systèmes ERP, facturation et gestion logistique.",
    features: ['680 cps en mode super brouillon','Tête 9 aiguilles — MTBF 1 milliard caractères','Compatible papier continu et multicouches','3 slots d\'alimentation papier intégrés','Émulation IBM ProPrinter/Epson intégrée'],
    specs: {'Technologie':'Matricielle 9 aiguilles','Vitesse max':'680 cps','Vitesse draft':'680 cps / NLQ : 226 cps','Largeur papier':'8 à 10 pouces (203-254 mm)','Copies':'Original + 5 copies','MTBF':'1 milliard de caractères','Connectivité':'Parallèle + USB','Tension':'220-240 V AC','Dimensions':'41,5×23,8×17,5 cm','Poids':'4,9 kg','Temp utilisation':'5°C à 35°C','Garantie':'1 an','Usage':'Industriel, ERP, logistique','EAN':'8715946633701'} },

  { cat: 'a2be77ae-4858-4983-9487-f4655621401d', slug: 'oki-microline-5721',
    name: 'OKI Microline 5721',
    subtitle: 'Matricielle · A4+ · Haute vitesse',
    brand: 'OKI', price_eur: 449.99, price_kmf: 221395,
    badge: 'Pro', badge_class: 'badge--popular',
    rating: 4, rating_count: 312,
    query: 'OKI Microline 5721 imprimante matricielle',
    description: "L'OKI Microline 5721 est une imprimante matricielle 9 aiguilles pour applications professionnelles. Sa tête de 1 million de caractères MTBF, sa compatibilité multicouches et sa fiabilité éprouvée en font un standard pour les systèmes de caisse, facturation et logistique.",
    features: ['9 aiguilles — MTBF 1 million de caractères','Vitesse 400 cps en mode brouillon','Traction avant/arrière et poussée avant','Compatible systèmes de caisse et ERP','Port parallèle + USB standard'],
    specs: {'Technologie':'Matricielle 9 aiguilles','Vitesse':'400 cps','Largeur':'136 colonnes','Copies':'Original + 5','Format':'A4+','Connectivité':'USB, Parallèle','MTBF':'1 million de caractères','Dimensions':'41×15,5×22 cm','Poids':'5,3 kg','Alimentation':'220-240 V','Température':'5-35°C','Compatibilité':'IBM ProPrinter, Epson ESC/P','Usage':'Caisse, facturation, ERP','Garantie':'1 an','Rubans':'Compatible OKI ML5721'} },

  { cat: 'a2be77ae-4858-4983-9487-f4655621401d', slug: 'epson-dfx-9000',
    name: 'Epson DFX-9000',
    subtitle: 'Matricielle · Large format · Industrie',
    brand: 'Epson', price_eur: 1499.99, price_kmf: 737995,
    badge: 'Large format', badge_class: 'badge--exclusive',
    rating: 5, rating_count: 198,
    query: 'Epson DFX-9000 imprimante matricielle large format',
    description: "L'Epson DFX-9000 est une imprimante matricielle industrielle grand format pour les systèmes bancaires, logistique et impression de bordereaux multicouches. Sa vitesse de 1550 cps et sa compatibilité 6 copies en font le standard des grandes organisations.",
    features: ['1550 cps — vitesse industrielle maximale','Largeur 17 pouces — format A3+','Impression 6 couches simultanées','Chargeur automatique haute capacité','Compatible systèmes bancaires et logistiques'],
    specs: {'Technologie':'Matricielle 9 aiguilles','Vitesse':'1550 cps','Largeur papier':'17 pouces (431 mm)','Copies':'Original + 6','Connectivité':'Parallèle, USB, RS-232C','MTBF':'1 milliard de caractères','Tension':'220-240V','Dimensions':'62,2×34,3×24 cm','Poids':'21 kg','Température':'10-35°C','Compatibilité':'IBM, Epson ESC/P2','Usage':'Banques, logistique, transport','Garantie':'1 an','Applications':'Multicouches, continu A3+'} },

  { cat: 'a2be77ae-4858-4983-9487-f4655621401d', slug: 'star-sp700',
    name: 'Star SP700',
    subtitle: 'Matricielle · Ticket · Cuisine',
    brand: 'Star', price_eur: 199.99, price_kmf: 98395,
    badge: 'Restaurant', badge_class: 'badge--popular',
    rating: 4, rating_count: 567,
    query: 'Star SP700 imprimante matricielle ticket cuisine restaurant',
    description: "La Star SP700 est une imprimante matricielle compacte dédiée aux bons de cuisine et tickets de restaurant. Sa résistance aux graisses et à la chaleur, sa vitesse de 8,3 lignes/seconde et sa compatibilité avec tous les systèmes de caisse en font la référence des cuisines professionnelles.",
    features: ['Résistante graisses et chaleur — usage cuisine','8,3 lignes/seconde — service rapide','Compatible tous systèmes de caisse/POS','Autocollant/papier 2 couleurs noir+rouge','Interface RS-232, parallèle ou USB'],
    specs: {'Technologie':'Matricielle 24 aiguilles','Vitesse':'8,3 lignes/seconde','Largeur papier':'76 mm','Couleurs':'Noir + rouge','Interface':'RS-232C, USB, Parallèle','Coupes':'Coupure automatique','MTBF':'10 millions de passes','Dimensions':'12×21×15 cm','Poids':'1,3 kg','Alimentation':'220V AC','Température':'5-45°C','Compatibilité':'Star line mode, ESC/POS','Usage':'Cuisine, restaurant, POS','Rubans':'RC700B/R','Garantie':'1 an'} },

  // ── THERMIQUE (9c57d727-9502-4dec-9bf3-74abb84458f9) ────────────────────
  { cat: '9c57d727-9502-4dec-9bf3-74abb84458f9', slug: 'brother-ql-820nwb',
    name: 'Brother QL-820NWBc',
    subtitle: 'Thermique · Étiquettes · WiFi',
    brand: 'Brother', price_eur: 149.99, price_kmf: 73795,
    badge: 'Pro', badge_class: 'badge--exclusive',
    rating: 4, rating_count: 1342,
    query: 'Brother QL-820NWBc imprimante etiquettes thermique wifi',
    description: "La Brother QL-820NWBc est une imprimante d'étiquettes thermique professionnelle avec WiFi, Ethernet, USB et Bluetooth. Compatiblee avec les rouleaux DK Brother de 12 à 62 mm, elle imprime jusqu'à 110 étiquettes/min et supporte les étiquettes couleur.",
    features: ['110 étiquettes/min — vitesse professionnelle','Étiquettes couleur (noir, rouge, bleu) compatibles','WiFi + Ethernet + Bluetooth intégré','Couper automatique — gain de temps','Compatibilité téléphone et tablette (iPrint&Label)'],
    specs: {'Technologie':'Thermique directe','Vitesse':'110 étiquettes/min','Largeur étiquette':'12-62 mm','Connectivité':'WiFi, Ethernet, USB, Bluetooth','Découpe':'Automatique','Résolution':'300×600 dpi','Format rouleau':'DK Brother','Écran':'LCD','Dimensions':'13,8×13,5×23,5 cm','Poids':'0,75 kg','Alimentation':'AC 220V','Compatibilité':'Windows, macOS, iOS, Android','Garantie':'1 an','Usage':'Étiquetage pro, bureaux'} },

  { cat: '9c57d727-9502-4dec-9bf3-74abb84458f9', slug: 'dymo-labelwriter-5xl',
    name: 'DYMO LabelWriter 5 XL',
    subtitle: 'Thermique · Grand format · USB',
    brand: 'DYMO', price_eur: 199.99, price_kmf: 98395,
    badge: 'Grand format', badge_class: 'badge--popular',
    rating: 4, rating_count: 987,
    query: 'DYMO LabelWriter 5 XL imprimante étiquettes thermique',
    description: "La DYMO LabelWriter 5 XL est une imprimante d'étiquettes thermique grand format compatible jusqu'au 4×6 pouces (101×152 mm). Idéale pour les expéditions Amazon, eBay et boutiques en ligne. 53 étiquettes/min, zéro cartouche d'encre, connexion USB.",
    features: ['Format jusqu\'à 101×152 mm (4×6 pouces)','Parfaite pour étiquettes d\'expédition e-commerce','53 étiquettes/min — flux de travail rapide','Zéro cartouche — économique et écologique','Intégration DYMO Connect, Shopify, WooCommerce'],
    specs: {'Technologie':'Thermique directe','Format max':'101×152 mm (4×6")','Vitesse':'53 étiquettes/min','Résolution':'300 dpi','Connectivité':'USB','Largeur rouleau':'jusqu\'à 101 mm','Dimensions':'17,5×14,2×22,5 cm','Poids':'0,94 kg','Alimentation':'12V DC','OS':'Windows 10/11, macOS 11+','Intégrations':'Shopify, WooCommerce, Amazon','Garantie':'1 an','Usage':'E-commerce, expédition, logistique','EAN':'3026981991400'} },

  { cat: '9c57d727-9502-4dec-9bf3-74abb84458f9', slug: 'zebra-zd421-thermal',
    name: 'Zebra ZD421 Thermique',
    subtitle: 'Thermique · Codes-barres · Industrie',
    brand: 'Zebra', price_eur: 499.99, price_kmf: 245995,
    badge: 'Industriel', badge_class: 'badge--exclusive',
    rating: 5, rating_count: 634,
    query: 'Zebra ZD421 imprimante thermique codes barres',
    description: "La Zebra ZD421 est une imprimante d'étiquettes thermique professionnelle pour codes-barres, traçabilité et logistique. Compatible ZPL II, son module WiFi 802.11 et Bluetooth, sa construction robuste IP21 et sa vitesse de 152 mm/s en font le standard industriel.",
    features: ['Compatible ZPL II — standard industrie','WiFi 802.11 ac + Bluetooth 4.1','Impression codes-barres 1D et 2D','Construction robuste IP21','Résolution 203 ou 300 dpi disponible'],
    specs: {'Technologie':'Thermique directe / Transfert thermique','Résolution':'203 dpi (300 dpi optionnel)','Vitesse':'152 mm/s','Largeur étiquette':'19-108 mm','Connectivité':'WiFi 802.11ac, Bluetooth 4.1, USB, Ethernet','Construction':'IP21','Mémoire':'512 Mo RAM / 1 Go Flash','Langages':'ZPL II, EPL2, XML','Codages':'Code 128, QR Code, DataMatrix','Dimensions':'18×25,5×12,7 cm','Poids':'0,98 kg','Alimentation':'100-240V','Garantie':'1 an','Usage':'Logistique, traçabilité, santé'} },

  { cat: '9c57d727-9502-4dec-9bf3-74abb84458f9', slug: 'epson-tm-t88vii',
    name: 'Epson TM-T88VII',
    subtitle: 'Thermique · Tickets · POS',
    brand: 'Epson', price_eur: 349.99, price_kmf: 172195,
    badge: 'Standard POS', badge_class: 'badge--exclusive',
    rating: 5, rating_count: 1089,
    query: 'Epson TM-T88VII imprimante thermique ticket caisse',
    description: "L'Epson TM-T88VII est l'imprimante thermique POS de référence mondiale. Utilisée par des millions de commerçants, elle offre 350 mm/s, un chargeur automatique de papier et une compatibilité totale avec les systèmes de caisse modernes via USB, Ethernet et WiFi.",
    features: ['350 mm/s — la plus rapide de sa gamme','Chargeur automatique papier sans ouverture couvercle','Compatible EpsonNet, OPOS, JavaPOS','WiFi + Ethernet + USB — tous scénarios','Design compact 56 mm de large'],
    specs: {'Technologie':'Thermique directe','Vitesse':'350 mm/s','Largeur papier':'80 mm','Découpe':'Automatique','Connectivité':'USB, Ethernet, WiFi (série IV)','Résolution':'180×180 dpi','MTBF':'100 km de papier','Commandes':'ESC/POS','Dimensions':'14×18×15 cm','Poids':'1,4 kg','Température':'5-45°C','Alimentation':'24V','Garantie':'1 an','Standard':'TM-88 série VII','Usage':'Retail, restaurant, hôtellerie'} },

  { cat: '9c57d727-9502-4dec-9bf3-74abb84458f9', slug: 'brother-td4550dnwb',
    name: 'Brother TD-4550DNWB',
    subtitle: 'Thermique · 300 dpi · WiFi Pro',
    brand: 'Brother', price_eur: 399.99, price_kmf: 196795,
    badge: 'Pro 300dpi', badge_class: 'badge--exclusive',
    rating: 5, rating_count: 523,
    query: 'Brother TD-4550DNWB imprimante étiquettes thermique 300dpi',
    description: "La Brother TD-4550DNWB est une imprimante d'étiquettes thermique professionnelle 300 dpi pour une qualité d'impression exceptionnelle sur codes-barres et étiquettes de haute précision. Compatible Transfert thermique pour étiquettes durables résistantes aux UV et à l'humidité.",
    features: ['300 dpi — qualité supérieure pour codes-barres','Thermique directe ET transfert thermique','WiFi + Ethernet + USB + Bluetooth','RTC intégré pour horodatage automatique','Compatible étiquettes résistantes UV/humidité'],
    specs: {'Technologie':'Thermique directe + Transfert thermique','Résolution':'300×300 dpi','Vitesse':'127 mm/s','Largeur étiquette':'12-108 mm','Connectivité':'WiFi, Ethernet, USB, Bluetooth','RTC':'Oui (horodatage)','Mémoire':'32 Mo RAM / 16 Mo Flash','Langages':'P-touch Template, Raster, ZPL II','Couteau':'Automatique, coupure partielle','Dimensions':'19×25,5×15,5 cm','Poids':'1,3 kg','Garantie':'1 an','Usage':'Laboratoire, santé, industrie de précision'} },
];

async function getAmazonImages(page, query) {
  console.log(`    🔍 "${query}"`);
  try {
    await page.goto(`https://www.amazon.fr/s?k=${encodeURIComponent(query)}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(2000);
    const results = await page.locator('[data-component-type="s-search-result"] a.a-link-normal.s-no-outline').all();
    if (!results.length) { console.log('    ⚠️  No results'); return []; }
    await results[0].click();
    await page.waitForLoadState('domcontentloaded');
    await sleep(2500);
    return await page.evaluate(() => {
      const s = new Set();
      for (const sc of document.querySelectorAll('script')) {
        for (const m of sc.textContent.matchAll(/"hiRes":"(https:\/\/m\.media-amazon\.com\/images\/I\/[^"]+\.jpg)"/g))
          s.add(m[1].replace(/\._[A-Z0-9,_]+_(?=\.jpg)/g, ''));
      }
      return [...s].slice(0, 5);
    });
  } catch(e) { console.log('    ❌ ' + e.message); return []; }
}

async function run() {
  console.log('\n🖨️  Création 25 imprimantes\n' + '═'.repeat(60));

  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', locale: 'fr-FR' });
  const page = await ctx.newPage();

  // Accept cookies
  try {
    await page.goto('https://www.amazon.fr', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await sleep(1500);
    await page.locator('#sp-cc-accept').click({ timeout: 3000 });
  } catch {}

  const results = { ok: [], fail: [] };

  for (const p of PRODUCTS) {
    const catName = {
      '0029d2b4':'jet-encre','77117756':'multifonction',
      '806b3473':'laser','a2be77ae':'matricielle','9c57d727':'thermique'
    }[p.cat.slice(0,8)];
    console.log(`\n[${catName}] ${p.name}`);

    let imgs = await getAmazonImages(page, p.query);
    if (!imgs.length) {
      // Retry with simpler query
      imgs = await getAmazonImages(page, `${p.brand} ${p.name.slice(0,15)}`);
    }
    console.log(`    📸 ${imgs.length} images`);

    const uploaded = [];
    for (let i = 0; i < imgs.length && uploaded.length < 3; i++) {
      try {
        const { buf, ct } = await dl(imgs[i]);
        const url = await up(buf, ct, p.slug, uploaded.length + 1);
        uploaded.push(url);
      } catch(e) {}
    }
    console.log(`    ⬆️  ${uploaded.length} uploadées`);

    if (!uploaded.length) { results.fail.push(p.name); continue; }

    const { error } = await sb.from('products').insert({
      name          : p.name,
      subtitle      : p.subtitle,
      slug          : p.slug,
      brand         : p.brand,
      category_id   : p.cat,
      badge         : p.badge,
      badge_class   : p.badge_class,
      price_eur     : p.price_eur,
      price_kmf     : p.price_kmf,
      rating        : p.rating,
      rating_count  : p.rating_count,
      stock         : Math.floor(Math.random() * 15) + 3,
      stock_label   : 'En stock',
      status        : 'active',
      description   : p.description,
      features      : p.features,
      specs         : p.specs,
      main_image_url: uploaded[0],
      image         : uploaded[0],
      gallery_urls  : uploaded,
      gallery       : uploaded,
      created_at    : new Date().toISOString(),
      updated_at    : new Date().toISOString(),
    });

    if (error) { console.log(`    ❌ DB: ${error.message}`); results.fail.push(p.name); }
    else { console.log(`    ✅ Créé`); results.ok.push(p.name); }

    await sleep(3000);
  }

  await browser.close();
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`✅ OK   (${results.ok.length}): ${results.ok.join(', ')}`);
  console.log(`❌ FAIL (${results.fail.length}): ${results.fail.join(', ')}`);
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
