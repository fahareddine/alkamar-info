// scripts/set-datauri-images.mjs
// Encode les SVG de marque en data URI et les stocke directement en DB.
// data: est déjà dans CSP img-src → fonctionne partout, aucune dépendance réseau.

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

// ── Génération SVG → data URI ─────────────────────────────────────────────────
function svgDataUri(initial, bg, fg = '#fff', sub = '') {
  const hasTwo = !!sub;
  const y1 = hasTwo ? '105' : '125';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" rx="20" fill="${bg}"/><text x="100" y="${y1}" font-family="Arial,sans-serif" font-size="${hasTwo ? '70' : '90'}" font-weight="900" fill="${fg}" text-anchor="middle">${initial}</text>${hasTwo ? `<text x="100" y="145" font-family="Arial,sans-serif" font-size="22" font-weight="700" fill="${fg}" text-anchor="middle" opacity="0.9">${sub}</text>` : ''}</svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

const L = {
  microsoft:    svgDataUri('M',  '#00A4EF', '#fff', 'Microsoft'),
  norton:       svgDataUri('N',  '#FFC220', '#222', 'Norton'),
  kaspersky:    svgDataUri('K',  '#007B5B', '#fff', 'Kaspersky'),
  bitdefender:  svgDataUri('B',  '#EE3425', '#fff', 'Bitdefender'),
  eset:         svgDataUri('E',  '#2D7BB2', '#fff', 'ESET'),
  canva:        svgDataUri('C',  '#7D2AE8', '#fff', 'Canva'),
  grammarly:    svgDataUri('G',  '#15C39A', '#fff', 'Grammarly'),
  nordvpn:      svgDataUri('N',  '#4687FF', '#fff', 'NordVPN'),
  dropbox:      svgDataUri('D',  '#0061FF', '#fff', 'Dropbox'),
  lastpass:     svgDataUri('LP', '#D42026', '#fff', 'LastPass'),
  adobe:        svgDataUri('A',  '#FF0000', '#fff', 'Adobe'),
  zoom:         svgDataUri('Z',  '#2D8CFF', '#fff', 'Zoom'),
  acronis:      svgDataUri('A',  '#FF6600', '#fff', 'Acronis'),
  malwarebytes: svgDataUri('M',  '#1F70E0', '#fff', 'Malwarebytes'),
  bitwarden:    svgDataUri('B',  '#175DDC', '#fff', 'Bitwarden'),
  nero:         svgDataUri('N',  '#E31315', '#fff', 'Nero'),
  iobit:        svgDataUri('i',  '#00B0F0', '#fff', 'IObit'),
  easeus:       svgDataUri('E',  '#0C8FE4', '#fff', 'EaseUS'),
  avast:        svgDataUri('A',  '#E23E24', '#fff', 'Avast'),
  notion:       svgDataUri('N',  '#181818', '#fff', 'Notion'),
  proton:       svgDataUri('P',  '#6D4AFF', '#fff', 'Proton'),
  auslogics:    svgDataUri('A',  '#F47B20', '#fff', 'Auslogics'),
  winrar:       svgDataUri('R',  '#1B73E8', '#fff', 'WinRAR'),
  ccleaner:     svgDataUri('C',  '#00C853', '#fff', 'CCleaner'),
  infoexperts:  svgDataUri('IE', '#1a3a8f', '#f59e0b', 'Info Experts'),
};

const UPDATES = [
  { slug: 'windows-11-home-licence',                img: L.microsoft,    gal: L.microsoft },
  { slug: 'windows-11-pro-licence',                 img: L.microsoft,    gal: L.microsoft },
  { slug: 'windows-10-pro-licence',                 img: L.microsoft,    gal: L.microsoft },
  { slug: 'windows-11-pro-3pc',                     img: L.microsoft,    gal: L.microsoft },
  { slug: 'office-2024-professionnel-plus',         img: L.microsoft,    gal: L.adobe     },
  { slug: 'microsoft-365-personnel-1an',            img: L.microsoft,    gal: L.microsoft },
  { slug: 'microsoft-365-famille-1an',              img: L.microsoft,    gal: L.microsoft },
  { slug: 'microsoft-365-business-basic-1an',       img: L.microsoft,    gal: L.microsoft },
  { slug: 'office-2024-famille-etudiant',           img: L.microsoft,    gal: L.microsoft },
  { slug: 'norton-360-standard-1an',                img: L.norton,       gal: L.norton    },
  { slug: 'kaspersky-standard-3-appareils-1an',     img: L.kaspersky,    gal: L.kaspersky },
  { slug: 'bitdefender-total-security-5-appareils', img: L.bitdefender,  gal: L.bitdefender},
  { slug: 'eset-nod32-antivirus-1an',               img: L.eset,         gal: L.eset      },
  { slug: 'avast-one-individual-1an',               img: L.avast,        gal: L.avast     },
  { slug: 'canva-pro-mensuel',                      img: L.canva,        gal: L.canva     },
  { slug: 'canva-pro-annuel',                       img: L.canva,        gal: L.canva     },
  { slug: 'grammarly-premium-mensuel',              img: L.grammarly,    gal: L.grammarly },
  { slug: 'adobe-express-premium-mensuel',          img: L.adobe,        gal: L.adobe     },
  { slug: 'notion-ai-pro-mensuel',                  img: L.notion,       gal: L.notion    },
  { slug: 'nordvpn-standard-1an',                   img: L.nordvpn,      gal: L.nordvpn   },
  { slug: 'dropbox-plus-2to-1an',                   img: L.dropbox,      gal: L.dropbox   },
  { slug: 'lastpass-premium-1an',                   img: L.lastpass,     gal: L.lastpass  },
  { slug: 'bitwarden-premium-1an',                  img: L.bitwarden,    gal: L.bitwarden },
  { slug: 'proton-pass-plus-1an',                   img: L.proton,       gal: L.proton    },
  { slug: 'adobe-creative-cloud-all-apps-mensuel',  img: L.adobe,        gal: L.adobe     },
  { slug: 'zoom-pro-annuel',                        img: L.zoom,         gal: L.zoom      },
  { slug: 'malwarebytes-premium-3-appareils-1an',   img: L.malwarebytes, gal: L.malwarebytes},
  { slug: 'avast-cleanup-premium-1an',              img: L.avast,        gal: L.avast     },
  { slug: 'winrar-7-licence',                       img: L.winrar,       gal: L.winrar    },
  { slug: 'ccleaner-professional-1an',              img: L.ccleaner,     gal: L.ccleaner  },
  { slug: 'easeus-todo-backup-pro-1an',             img: L.easeus,       gal: L.easeus    },
  { slug: 'acronis-cyber-protect-home-1an',         img: L.acronis,      gal: L.acronis   },
  { slug: 'iobit-driver-booster-pro-1an',           img: L.iobit,        gal: L.iobit     },
  { slug: 'nero-platinum-suite-1an',                img: L.nero,         gal: L.nero      },
  { slug: 'auslogics-boostspeed-pro-1an',           img: L.auslogics,    gal: L.auslogics },
  { slug: 'pack-essentiel-pc',                      img: L.microsoft,    gal: L.norton    },
  { slug: 'pack-securite-total',                    img: L.bitdefender,  gal: L.nordvpn   },
  { slug: 'pack-creatif-pro',                       img: L.canva,        gal: L.grammarly },
  { slug: 'pack-teletravail-pro',                   img: L.microsoft,    gal: L.zoom      },
  { slug: 'pack-gaming-creation',                   img: L.microsoft,    gal: L.canva     },
];

async function run() {
  console.log('🔄 Mise à jour images → data URIs...\n');
  let ok = 0;
  for (const { slug, img, gal } of UPDATES) {
    const { error } = await sb.from('products').update({ image: img, gallery: [gal] }).eq('slug', slug);
    if (error) console.error(`  ❌ ${slug}: ${error.message}`);
    else { process.stdout.write('.'); ok++; }
  }
  console.log(`\n\n✅ ${ok}/${UPDATES.length} produits mis à jour avec data URIs`);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
