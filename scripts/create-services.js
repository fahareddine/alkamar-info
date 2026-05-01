// scripts/create-services.js
// Crée les 5 services informatiques inspirés d'info-experts.fr
const https = require('https');
const path  = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env.local') });
const { createClient } = require('@supabase/supabase-js');
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function dl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)', 'Accept': 'image/*' } }, res => {
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
  const p = `services/${slug}-${n}.${ext}`;
  const { error } = await sb.storage.from('products').upload(p, buf, { contentType: ct, upsert: true, cacheControl: '31536000' });
  if (error) throw error;
  return sb.storage.from('products').getPublicUrl(p).data.publicUrl;
}

const PX = 'https://images.pexels.com/photos/';
const CAT = 'b99e8a50-e16a-4f65-9098-e24c59caacba'; // service category

const SERVICES = [
  {
    slug: 'reparation-pc',
    name: 'Réparation PC & Laptop',
    subtitle: 'Diagnostic gratuit · Résultat 24h',
    brand: 'Info Experts',
    badge: 'Express 24h', badge_class: 'badge--deal',
    price_eur: 29.99, price_kmf: 14760,
    rating: 5, rating_count: 1284, stock: 999, stock_label: 'Disponible',
    description: "Votre ordinateur ne démarre plus, est lent ou présente un écran noir ? Nos techniciens certifiés diagnostiquent et réparent votre PC ou laptop en moins de 24 heures. Diagnostic initial offert, réparation transparente sans mauvaises surprises.",
    features: [
      'Diagnostic complet offert dès la réception',
      'Réparation Express — résultat en moins de 24 h',
      'Remplacement de pièces certifiées d\'origine',
      'Garantie 30 jours sur toute intervention',
      'Techniciens certifiés HP, Dell, Lenovo, ASUS',
    ],
    specs: {
      'Délai': 'Moins de 24 heures',
      'Diagnostic': 'Gratuit',
      'Garantie': '30 jours',
      'Marques': 'HP, Dell, Lenovo, ASUS, Toshiba',
      'Pannes traitées': 'Écran, clavier, batterie, disque, mémoire',
      'Localisation': 'Moroni, Comores',
      'Rendez-vous': 'Disponible 6j/7',
      'Devis': 'Sur place ou par téléphone',
    },
    pexels: [
      PX+'4709289/pexels-photo-4709289.jpeg?w=800&auto=compress',
      PX+'4164418/pexels-photo-4164418.jpeg?w=800&auto=compress',
      PX+'3861969/pexels-photo-3861969.jpeg?w=800&auto=compress',
    ],
  },
  {
    slug: 'maintenance-preventive',
    name: 'Maintenance & Optimisation',
    subtitle: 'Nettoyage · Mise à jour · Performance',
    brand: 'Info Experts',
    badge: 'Mensuel', badge_class: 'badge--popular',
    price_eur: 49.99, price_kmf: 24595,
    rating: 5, rating_count: 876, stock: 999, stock_label: 'Disponible',
    description: "Un PC lent et encombré coûte en productivité chaque jour. Notre service de maintenance préventive nettoie en profondeur votre machine, supprime les virus, met à jour les logiciels et optimise les performances pour retrouver une machine comme neuve.",
    features: [
      'Nettoyage logiciel complet (virus, malwares, adwares)',
      'Mise à jour Windows et pilotes drivers',
      'Optimisation démarrage et performances globales',
      'Nettoyage physique (ventilateur, pâte thermique)',
      'Sauvegarde de données avant toute intervention',
    ],
    specs: {
      'Durée': '2 à 4 heures',
      'Fréquence recommandée': 'Tous les 6 mois',
      'Garantie': '30 jours post-intervention',
      'Comprend': 'Antivirus, optimisation, nettoyage physique',
      'Compatible': 'Windows 10 / 11, macOS',
      'Localisation': 'Moroni, Comores',
    },
    pexels: [
      PX+'3861958/pexels-photo-3861958.jpeg?w=800&auto=compress',
      PX+'3861969/pexels-photo-3861969.jpeg?w=800&auto=compress',
      PX+'4164418/pexels-photo-4164418.jpeg?w=800&auto=compress',
    ],
  },
  {
    slug: 'installation-reseau',
    name: 'Installation Réseau WiFi',
    subtitle: 'Configuration · Câblage · Sécurité',
    brand: 'Info Experts',
    badge: 'Clé en main', badge_class: 'badge--popular',
    price_eur: 79.99, price_kmf: 39355,
    rating: 5, rating_count: 542, stock: 999, stock_label: 'Disponible',
    description: "Un réseau mal configuré ralentit toute votre entreprise. Nos techniciens installent et sécurisent votre réseau WiFi et filaire de A à Z : routeur, switches, points d'accès, VPN. Intervention en entreprise, boutique ou domicile à Moroni et dans tout l'archipel.",
    features: [
      'Installation et configuration routeur & switch',
      'Déploiement réseau WiFi multi-zones',
      'Sécurisation réseau (pare-feu, WPA3, VLAN)',
      'Câblage RJ45 Cat6/Cat6A professionnel',
      'Documentation et formation à la prise en main',
    ],
    specs: {
      'Couverture': 'Boutique, bureau, domicile, entrepôt',
      'Marques maîtrisées': 'Cisco, TP-Link, Ubiquiti, Netgear',
      'Standards': 'WiFi 5, WiFi 6, Ethernet Gigabit',
      'Garantie': '30 jours',
      'Zone': 'Moroni + archipel des Comores',
      'Devis': 'Gratuit sur site',
    },
    pexels: [
      PX+'2881229/pexels-photo-2881229.jpeg?w=800&auto=compress',
      PX+'325229/pexels-photo-325229.jpeg?w=800&auto=compress',
      PX+'3861958/pexels-photo-3861958.jpeg?w=800&auto=compress',
    ],
  },
  {
    slug: 'creation-site-web',
    name: 'Création Site Web Pro',
    subtitle: 'Vitrine · E-commerce · Mobile · SEO',
    brand: 'Info Experts',
    badge: 'Clé en main', badge_class: 'badge--exclusive',
    price_eur: 299, price_kmf: 147108,
    rating: 5, rating_count: 218, stock: 999, stock_label: 'Disponible',
    description: "Votre entreprise mérite une présence en ligne sérieuse. Nous concevons des sites web clairs, rapides, visibles sur Google et adaptés au mobile. Site vitrine, e-commerce ou application web — de A à Z, sans vous imposer la technique.",
    features: [
      'Design personnalisé adapté à votre image',
      'Responsive mobile, tablette et desktop',
      'Optimisation SEO pour être trouvé sur Google',
      'Hébergement et nom de domaine inclus (1 an)',
      'Formation et transfert de compétences inclus',
    ],
    specs: {
      'Livraison': '7 à 21 jours selon le projet',
      'Technologies': 'WordPress, HTML/CSS, React',
      'Comprend': 'Design, développement, SEO, déploiement',
      'Hébergement': '1 an offert',
      'Domaine': '1 an offert (.com, .fr ou .km)',
      'Révisions': '3 rounds inclus',
      'Formation': '1 session formation incluse',
      'Garantie': '6 mois de support',
    },
    pexels: [
      PX+'196644/pexels-photo-196644.jpeg?w=800&auto=compress',
      PX+'270557/pexels-photo-270557.jpeg?w=800&auto=compress',
      PX+'3182773/pexels-photo-3182773.jpeg?w=800&auto=compress',
    ],
  },
  {
    slug: 'conseil-audit-it',
    name: 'Conseil & Audit Informatique',
    subtitle: 'Diagnostic · Stratégie · Recommandations',
    brand: 'Info Experts',
    badge: 'Expert', badge_class: 'badge--exclusive',
    price_eur: 69.99, price_kmf: 34435,
    rating: 5, rating_count: 163, stock: 999, stock_label: 'Disponible',
    description: "Vous avez un projet informatique à structurer ou un parc IT à moderniser ? Nos experts vous accompagnent pour faire les bons choix, adaptés à votre budget et à la réalité locale. Audit complet, plan d'action concret, accompagnement à la mise en oeuvre.",
    features: [
      'Audit complet de votre infrastructure actuelle',
      'Recommandations adaptées à votre budget',
      'Plan d\'action détaillé et priorisé',
      'Accompagnement à la mise en oeuvre',
      'Rapport écrit remis dans les 48 heures',
    ],
    specs: {
      'Format': 'Rendez-vous sur site ou en ligne',
      'Durée': '1 à 2 heures d\'audit',
      'Livrable': 'Rapport PDF sous 48 h',
      'Domaines': 'Réseau, sécurité, parc matériel, cloud',
      'Garantie': 'Satisfaction ou remboursé',
      'Zone': 'Moroni + archipel des Comores',
    },
    pexels: [
      PX+'3182773/pexels-photo-3182773.jpeg?w=800&auto=compress',
      PX+'3182812/pexels-photo-3182812.jpeg?w=800&auto=compress',
      PX+'3861969/pexels-photo-3861969.jpeg?w=800&auto=compress',
    ],
  },
];

async function run() {
  console.log('\n🛠️  Création 5 services informatiques\n' + '─'.repeat(50));

  // Vérifier que des services n'existent pas déjà
  const { data: existing } = await sb.from('products').select('id,name').eq('category_id', CAT);
  if (existing?.length) {
    console.log(`ℹ️  ${existing.length} services existants: ${existing.map(s=>s.name).join(', ')}`);
    console.log('   Suppression pour recréation...');
    for (const s of existing) await sb.from('products').delete().eq('id', s.id);
  }

  for (const svc of SERVICES) {
    console.log(`\n📦 ${svc.name}`);

    // Télécharge et uploade 3 images
    const uploaded = [];
    for (let i = 0; i < svc.pexels.length && uploaded.length < 3; i++) {
      try {
        const { buf, ct } = await dl(svc.pexels[i]);
        const url = await up(buf, ct, svc.slug, uploaded.length + 1);
        uploaded.push(url);
        console.log(`  ✅ img${uploaded.length}`);
      } catch(e) { console.log(`  ⚠️  ${e.message}`); }
      await sleep(300);
    }

    if (!uploaded.length) { console.log('  ❌ Aucune image'); continue; }

    const { error } = await sb.from('products').insert({
      name          : svc.name,
      subtitle      : svc.subtitle,
      slug          : svc.slug,
      brand         : svc.brand,
      category_id   : CAT,
      badge         : svc.badge,
      badge_class   : svc.badge_class,
      price_eur     : svc.price_eur,
      price_kmf     : svc.price_kmf,
      rating        : svc.rating,
      rating_count  : svc.rating_count,
      stock         : svc.stock,
      stock_label   : svc.stock_label,
      status        : 'active',
      description   : svc.description,
      features      : svc.features,
      specs         : svc.specs,
      main_image_url: uploaded[0],
      image         : uploaded[0],
      gallery_urls  : uploaded,
      gallery       : uploaded,
      created_at    : new Date().toISOString(),
      updated_at    : new Date().toISOString(),
    });

    if (error) console.log(`  ❌ DB: ${error.message}`);
    else console.log(`  💾 Créé avec ${uploaded.length} images`);
  }

  console.log('\n✅ Terminé');
}

run().catch(e => { console.error('❌', e.message); process.exit(1); });
