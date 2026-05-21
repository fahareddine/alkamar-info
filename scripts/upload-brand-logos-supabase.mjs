// scripts/upload-brand-logos-supabase.mjs
// Génère des SVG de marque propres → Supabase Storage (public)
// → URLs https://ovjsinugxkuwsjnfxfgb.supabase.co/storage/v1/object/public/product-images/...
// Ces URLs sont dans le CSP (*.supabase.co) et accessibles depuis n'importe quel réseau.
// Usage : node scripts/upload-brand-logos-supabase.mjs

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

const BUCKET = 'product-images';

// ── Logos SVG de marque — fond coloré + initiales ─────────────────────────────
function makeLogo(initial, bg, fg = '#fff', secondLine = '') {
  const y1 = secondLine ? '105' : '125';
  const y2 = '145';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <rect width="200" height="200" rx="20" fill="${bg}"/>
  <text x="100" y="${y1}" font-family="Arial,Helvetica,sans-serif" font-size="${secondLine ? '72' : '90'}" font-weight="900" fill="${fg}" text-anchor="middle" dominant-baseline="auto">${initial}</text>
  ${secondLine ? `<text x="100" y="${y2}" font-family="Arial,Helvetica,sans-serif" font-size="22" font-weight="700" fill="${fg}" text-anchor="middle" opacity="0.85">${secondLine}</text>` : ''}
</svg>`;
}

const LOGOS = [
  // slug                     → filename, initial, bg, fg, subtitle
  { file: 'microsoft.svg',     svg: makeLogo('M',  '#00A4EF', '#fff', 'Microsoft')    },
  { file: 'norton.svg',        svg: makeLogo('N',  '#FFC220', '#222', 'Norton')       },
  { file: 'kaspersky.svg',     svg: makeLogo('K',  '#007B5B', '#fff', 'Kaspersky')    },
  { file: 'bitdefender.svg',   svg: makeLogo('B',  '#EE3425', '#fff', 'Bitdefender')  },
  { file: 'eset.svg',          svg: makeLogo('E',  '#2D7BB2', '#fff', 'ESET')         },
  { file: 'canva.svg',         svg: makeLogo('C',  '#7D2AE8', '#fff', 'Canva')        },
  { file: 'grammarly.svg',     svg: makeLogo('G',  '#15C39A', '#fff', 'Grammarly')    },
  { file: 'nordvpn.svg',       svg: makeLogo('N',  '#4687FF', '#fff', 'NordVPN')      },
  { file: 'dropbox.svg',       svg: makeLogo('D',  '#0061FF', '#fff', 'Dropbox')      },
  { file: 'lastpass.svg',      svg: makeLogo('LP', '#D42026', '#fff', 'LastPass')     },
  { file: 'adobe.svg',         svg: makeLogo('A',  '#FF0000', '#fff', 'Adobe')        },
  { file: 'zoom.svg',          svg: makeLogo('Z',  '#2D8CFF', '#fff', 'Zoom')         },
  { file: 'acronis.svg',       svg: makeLogo('A',  '#FF6600', '#fff', 'Acronis')      },
  { file: 'malwarebytes.svg',  svg: makeLogo('M',  '#1F70E0', '#fff', 'Malwarebytes') },
  { file: 'bitwarden.svg',     svg: makeLogo('B',  '#175DDC', '#fff', 'Bitwarden')    },
  { file: 'nero.svg',          svg: makeLogo('N',  '#E31315', '#fff', 'Nero')         },
  { file: 'iobit.svg',         svg: makeLogo('i',  '#00B0F0', '#fff', 'IObit')        },
  { file: 'easeus.svg',        svg: makeLogo('E',  '#0C8FE4', '#fff', 'EaseUS')       },
  { file: 'avast.svg',         svg: makeLogo('A',  '#E23E24', '#fff', 'Avast')        },
  { file: 'notion.svg',        svg: makeLogo('N',  '#181818', '#fff', 'Notion')       },
  { file: 'proton.svg',        svg: makeLogo('P',  '#6D4AFF', '#fff', 'Proton')       },
  { file: 'auslogics.svg',     svg: makeLogo('A',  '#F47B20', '#fff', 'Auslogics')    },
  { file: 'winrar.svg',        svg: makeLogo('R',  '#1B73E8', '#fff', 'WinRAR')       },
  { file: 'ccleaner.svg',      svg: makeLogo('C',  '#00C853', '#fff', 'CCleaner')     },
  { file: 'infoexperts.svg',   svg: makeLogo('IE', '#1a3a8f', '#f59e0b', 'Info Experts') },
];

// Mapping : nom de fichier Supabase → URL publique
function publicUrl(file) {
  return `${env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${file}`;
}

// Mapping produits → fichier logo
const PRODUCT_LOGOS = [
  { slug: 'windows-11-home-licence',                img: 'microsoft.svg',    gal: 'microsoft.svg' },
  { slug: 'windows-11-pro-licence',                 img: 'microsoft.svg',    gal: 'microsoft.svg' },
  { slug: 'windows-10-pro-licence',                 img: 'microsoft.svg',    gal: 'microsoft.svg' },
  { slug: 'windows-11-pro-3pc',                     img: 'microsoft.svg',    gal: 'microsoft.svg' },
  { slug: 'office-2024-professionnel-plus',         img: 'microsoft.svg',    gal: 'adobe.svg'     },
  { slug: 'microsoft-365-personnel-1an',            img: 'microsoft.svg',    gal: 'microsoft.svg' },
  { slug: 'microsoft-365-famille-1an',              img: 'microsoft.svg',    gal: 'microsoft.svg' },
  { slug: 'microsoft-365-business-basic-1an',       img: 'microsoft.svg',    gal: 'microsoft.svg' },
  { slug: 'office-2024-famille-etudiant',           img: 'microsoft.svg',    gal: 'microsoft.svg' },
  { slug: 'norton-360-standard-1an',                img: 'norton.svg',       gal: 'norton.svg'    },
  { slug: 'kaspersky-standard-3-appareils-1an',     img: 'kaspersky.svg',    gal: 'kaspersky.svg' },
  { slug: 'bitdefender-total-security-5-appareils', img: 'bitdefender.svg',  gal: 'bitdefender.svg'},
  { slug: 'eset-nod32-antivirus-1an',               img: 'eset.svg',         gal: 'eset.svg'      },
  { slug: 'avast-one-individual-1an',               img: 'avast.svg',        gal: 'avast.svg'     },
  { slug: 'canva-pro-mensuel',                      img: 'canva.svg',        gal: 'canva.svg'     },
  { slug: 'canva-pro-annuel',                       img: 'canva.svg',        gal: 'canva.svg'     },
  { slug: 'grammarly-premium-mensuel',              img: 'grammarly.svg',    gal: 'grammarly.svg' },
  { slug: 'adobe-express-premium-mensuel',          img: 'adobe.svg',        gal: 'adobe.svg'     },
  { slug: 'notion-ai-pro-mensuel',                  img: 'notion.svg',       gal: 'notion.svg'    },
  { slug: 'nordvpn-standard-1an',                   img: 'nordvpn.svg',      gal: 'nordvpn.svg'   },
  { slug: 'dropbox-plus-2to-1an',                   img: 'dropbox.svg',      gal: 'dropbox.svg'   },
  { slug: 'lastpass-premium-1an',                   img: 'lastpass.svg',     gal: 'lastpass.svg'  },
  { slug: 'bitwarden-premium-1an',                  img: 'bitwarden.svg',    gal: 'bitwarden.svg' },
  { slug: 'proton-pass-plus-1an',                   img: 'proton.svg',       gal: 'proton.svg'    },
  { slug: 'adobe-creative-cloud-all-apps-mensuel',  img: 'adobe.svg',        gal: 'adobe.svg'     },
  { slug: 'zoom-pro-annuel',                        img: 'zoom.svg',         gal: 'zoom.svg'      },
  { slug: 'malwarebytes-premium-3-appareils-1an',   img: 'malwarebytes.svg', gal: 'malwarebytes.svg'},
  { slug: 'avast-cleanup-premium-1an',              img: 'avast.svg',        gal: 'avast.svg'     },
  { slug: 'winrar-7-licence',                       img: 'winrar.svg',       gal: 'winrar.svg'    },
  { slug: 'ccleaner-professional-1an',              img: 'ccleaner.svg',     gal: 'ccleaner.svg'  },
  { slug: 'easeus-todo-backup-pro-1an',             img: 'easeus.svg',       gal: 'easeus.svg'    },
  { slug: 'acronis-cyber-protect-home-1an',         img: 'acronis.svg',      gal: 'acronis.svg'   },
  { slug: 'iobit-driver-booster-pro-1an',           img: 'iobit.svg',        gal: 'iobit.svg'     },
  { slug: 'nero-platinum-suite-1an',                img: 'nero.svg',         gal: 'nero.svg'      },
  { slug: 'auslogics-boostspeed-pro-1an',           img: 'auslogics.svg',    gal: 'auslogics.svg' },
  { slug: 'pack-essentiel-pc',                      img: 'microsoft.svg',    gal: 'norton.svg'    },
  { slug: 'pack-securite-total',                    img: 'bitdefender.svg',  gal: 'nordvpn.svg'   },
  { slug: 'pack-creatif-pro',                       img: 'canva.svg',        gal: 'grammarly.svg' },
  { slug: 'pack-teletravail-pro',                   img: 'microsoft.svg',    gal: 'zoom.svg'      },
  { slug: 'pack-gaming-creation',                   img: 'microsoft.svg',    gal: 'canva.svg'     },
];

async function run() {
  // 1. Créer le bucket si nécessaire
  const { data: buckets } = await sb.storage.listBuckets();
  const exists = (buckets || []).some(b => b.name === BUCKET);
  if (!exists) {
    const { error } = await sb.storage.createBucket(BUCKET, { public: true, fileSizeLimit: 1048576 });
    if (error) { console.error('Bucket create error:', error.message); }
    else { console.log('✅ Bucket créé:', BUCKET); }
  } else {
    console.log('✅ Bucket existant:', BUCKET);
  }

  // 2. Upload tous les SVGs
  console.log('\n📤 Upload logos SVG → Supabase Storage...');
  let uploadOk = 0;
  for (const { file, svg } of LOGOS) {
    const buf = Buffer.from(svg, 'utf8');
    const { error } = await sb.storage.from(BUCKET).upload(file, buf, {
      contentType: 'image/svg+xml',
      upsert: true,
      cacheControl: '31536000',
    });
    if (error) { console.error(`  ❌ ${file}: ${error.message}`); }
    else { console.log(`  ✅ ${file}`); uploadOk++; }
  }
  console.log(`\n✅ ${uploadOk}/${LOGOS.length} logos uploadés\n`);

  // 3. Mettre à jour les URLs produits
  console.log('🔄 Mise à jour URLs produits...');
  let updateOk = 0;
  for (const { slug, img, gal } of PRODUCT_LOGOS) {
    const image   = publicUrl(img);
    const gallery = [publicUrl(gal)];
    const { error } = await sb.from('products').update({ image, gallery }).eq('slug', slug);
    if (error) { console.error(`  ❌ ${slug}: ${error.message}`); }
    else { console.log(`  ✅ ${slug}`); updateOk++; }
  }
  console.log(`\n✅ ${updateOk}/${PRODUCT_LOGOS.length} produits mis à jour`);
  console.log('\nURL type: ' + publicUrl('microsoft.svg'));
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
