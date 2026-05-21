// scripts/apply-higgsfield-images.mjs
// Applique les photos générées par Higgsfield aux produits digitaux

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

const BASE = 'https://d8j0ntlcm91z4.cloudfront.net/user_3DMUOJYVD0AUSpzqtmYOyxjZ9KX/';

// Photos générées par Higgsfield product-photoshoot
const IMG = {
  windows:  BASE + 'hf_20260521_231515_0da7e41c-1093-426d-b649-f8fac43bc4c0.png',
  office:   BASE + 'hf_20260521_231759_93c9b6b9-4f52-4357-beb3-a7ee3c804a98.png',
  norton:   BASE + 'hf_20260521_232023_82c424b2-05a7-448a-a738-f0b8633e1092.png',
  kaspersky:BASE + 'hf_20260521_232243_806029f9-3ea4-4fcf-ad81-cab6dc028322.png',
  bitdefend:BASE + 'hf_20260521_232502_e518054f-7312-4c15-a72a-253a06ce5086.png',
  eset:     BASE + 'hf_20260521_232716_6a639053-22b8-46fa-b092-4979e39be8cc.png',
  avast:    BASE + 'hf_20260521_232939_701a2756-cbf1-431d-92ae-8edb8e0ed90a.png',
  canva:    BASE + 'hf_20260521_233151_27012ca1-8832-4855-95f9-579601c1b042.png',
  nordvpn:  BASE + 'hf_20260521_233415_62dd0da8-cd2e-419b-8547-5862716d2727.png',
  adobe:    BASE + 'hf_20260521_233624_8b8419a8-8159-4cce-9aa1-6f8be78b3238.png',
  grammarly:BASE + 'hf_20260521_233848_84bc798d-400a-48cb-b6e2-9a6d4229ed1b.png',
  zoom:     BASE + 'hf_20260521_234107_18734381-e432-49d2-a595-6535ee2283ae.png',
  passwords:BASE + 'hf_20260521_234325_7b206da6-7d03-4794-885b-eca37343e754.png',
  utilities:BASE + 'hf_20260521_234554_5e198477-3261-4b91-a40b-35fc7423d791.png',
  premium:  BASE + 'hf_20260521_234813_df32b3c0-7fcc-4064-b756-7a2c064f1814.png',
};

const UPDATES = [
  // Licences Windows
  { slug: 'windows-11-home-licence',                image: IMG.windows    },
  { slug: 'windows-11-pro-licence',                 image: IMG.windows    },
  { slug: 'windows-10-pro-licence',                 image: IMG.windows    },
  { slug: 'windows-11-pro-3pc',                     image: IMG.windows    },
  // Microsoft 365 / Office
  { slug: 'office-2024-professionnel-plus',         image: IMG.office     },
  { slug: 'microsoft-365-personnel-1an',            image: IMG.office     },
  { slug: 'microsoft-365-famille-1an',              image: IMG.office     },
  { slug: 'microsoft-365-business-basic-1an',       image: IMG.office     },
  { slug: 'office-2024-famille-etudiant',           image: IMG.office     },
  // Antivirus
  { slug: 'norton-360-standard-1an',                image: IMG.norton     },
  { slug: 'kaspersky-standard-3-appareils-1an',     image: IMG.kaspersky  },
  { slug: 'bitdefender-total-security-5-appareils', image: IMG.bitdefend  },
  { slug: 'eset-nod32-antivirus-1an',               image: IMG.eset       },
  { slug: 'avast-one-individual-1an',               image: IMG.avast      },
  // Outils IA
  { slug: 'canva-pro-mensuel',                      image: IMG.canva      },
  { slug: 'canva-pro-annuel',                       image: IMG.canva      },
  { slug: 'grammarly-premium-mensuel',              image: IMG.grammarly  },
  { slug: 'adobe-express-premium-mensuel',          image: IMG.adobe      },
  { slug: 'notion-ai-pro-mensuel',                  image: IMG.canva      },
  // SaaS
  { slug: 'nordvpn-standard-1an',                   image: IMG.nordvpn    },
  { slug: 'dropbox-plus-2to-1an',                   image: IMG.passwords  },
  { slug: 'lastpass-premium-1an',                   image: IMG.passwords  },
  { slug: 'bitwarden-premium-1an',                  image: IMG.passwords  },
  { slug: 'proton-pass-plus-1an',                   image: IMG.passwords  },
  // Abonnements
  { slug: 'adobe-creative-cloud-all-apps-mensuel',  image: IMG.adobe      },
  { slug: 'zoom-pro-annuel',                        image: IMG.zoom       },
  // Logiciels
  { slug: 'malwarebytes-premium-3-appareils-1an',   image: IMG.avast      },
  { slug: 'avast-cleanup-premium-1an',              image: IMG.avast      },
  { slug: 'winrar-7-licence',                       image: IMG.utilities  },
  { slug: 'ccleaner-professional-1an',              image: IMG.utilities  },
  // Téléchargements
  { slug: 'easeus-todo-backup-pro-1an',             image: IMG.utilities  },
  { slug: 'acronis-cyber-protect-home-1an',         image: IMG.utilities  },
  { slug: 'iobit-driver-booster-pro-1an',           image: IMG.utilities  },
  { slug: 'nero-platinum-suite-1an',                image: IMG.utilities  },
  { slug: 'auslogics-boostspeed-pro-1an',           image: IMG.utilities  },
  // Premium
  { slug: 'pack-essentiel-pc',                      image: IMG.premium    },
  { slug: 'pack-securite-total',                    image: IMG.premium    },
  { slug: 'pack-creatif-pro',                       image: IMG.premium    },
  { slug: 'pack-teletravail-pro',                   image: IMG.premium    },
  { slug: 'pack-gaming-creation',                   image: IMG.premium    },
];

async function run() {
  console.log('🖼️  Application photos Higgsfield → Supabase...\n');
  let ok = 0;
  for (const { slug, image } of UPDATES) {
    const { error } = await sb.from('products').update({ image, gallery: [] }).eq('slug', slug);
    if (error) console.error(`  ❌ ${slug}: ${error.message}`);
    else { process.stdout.write('.'); ok++; }
  }
  console.log(`\n\n✅ ${ok}/${UPDATES.length} produits mis à jour`);
}

run().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
