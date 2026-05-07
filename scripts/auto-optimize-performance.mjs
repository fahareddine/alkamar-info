/**
 * auto-optimize-performance.mjs — alkamar-info (boutique.info-experts.fr)
 * Boucle d'optimisation automatique contrôlée. MAX 3 passes.
 *
 * Corrections autorisées :
 *   - Recompression images > 200 KB avec sharp (q=65 avif, q=80 webp)
 *   - Création variantes WebP/AVIF pour images > 100 KB
 *   - decoding="sync" → decoding="async" dans les .html
 *   - transition:all → transition:background-color .15s,color .15s,border-color .15s dans style.css
 *
 * Corrections INTERDITES :
 *   - Modifier le design, les prix, les produits
 *   - Modifier le checkout ou Stripe
 *   - Modifier les couleurs ou textes visibles
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from 'fs';
import { join, extname, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORTS_DIR = join(ROOT, 'reports');

const MAX_PASSES = 3;
const LOG = [];

function log(msg) {
  LOG.push(msg);
  console.log(msg);
}

// ── Vérifier si sharp est disponible ────────────────────────────────────────

let sharp = null;
try {
  const require = createRequire(import.meta.url);
  sharp = require('sharp');
  log('[sharp] sharp disponible — optimisation images activée');
} catch {
  log('[sharp] sharp indisponible — optimisation images désactivée (installer avec: npm install sharp)');
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function readDirImages(dir) {
  if (!existsSync(dir)) return [];
  const IMAGE_EXT = ['.png', '.jpg', '.jpeg'];
  const results = [];

  function scan(d) {
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) {
        scan(full);
      } else if (IMAGE_EXT.includes(extname(entry.name).toLowerCase())) {
        results.push(full);
      }
    }
  }

  scan(dir);
  return results;
}

function readHtmlFiles(dir, maxDepth = 2) {
  const results = [];
  function scan(d, depth) {
    if (depth > maxDepth) return;
    if (!existsSync(d)) return;
    const entries = readdirSync(d, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = join(d, entry.name);
      if (entry.isDirectory()) scan(full, depth + 1);
      else if (extname(entry.name).toLowerCase() === '.html') results.push(full);
    }
  }
  scan(dir, 0);
  return results;
}

// ── Lire le dernier rapport d'audit ─────────────────────────────────────────

function loadAuditReport() {
  const auditPath = join(REPORTS_DIR, 'performance-audit.json');
  if (!existsSync(auditPath)) return null;
  try {
    return JSON.parse(readFileSync(auditPath, 'utf8'));
  } catch {
    return null;
  }
}

// ── Lancer l'audit ───────────────────────────────────────────────────────────

function runAudit() {
  log('\n  Lancement de performance-audit.mjs…');
  const result = spawnSync(
    process.execPath,
    [join(__dirname, 'performance-audit.mjs')],
    { stdio: 'inherit', cwd: ROOT }
  );
  if (result.status !== 0) {
    log('  [WARN] L\'audit a retourné un code non-zéro');
  }
}

// ── Corrections : decoding="sync" → "async" ─────────────────────────────────

function fixDecodingSync(pass) {
  let fixed = 0;
  const htmlFiles = readHtmlFiles(ROOT);

  for (const filePath of htmlFiles) {
    const rel = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    const original = readFileSync(filePath, 'utf8');

    // Remplacer decoding="sync" par decoding="async"
    const updated = original.replace(/decoding=["']sync["']/g, 'decoding="async"');

    if (updated !== original) {
      writeFileSync(filePath, updated, 'utf8');
      const count = (original.match(/decoding=["']sync["']/g) ?? []).length;
      log(`  [PASS ${pass}] Corrigé decoding="sync" → "async" (${count} occurrence(s)) dans ${rel}`);
      fixed += count;
    }
  }

  return fixed;
}

// ── Corrections : transition:all → propriétés spécifiques ───────────────────

function fixTransitionAll(pass) {
  let fixed = 0;
  const cssPath = join(ROOT, 'style.css');
  if (!existsSync(cssPath)) return 0;

  const original = readFileSync(cssPath, 'utf8');
  const REPLACEMENT = 'transition:background-color .15s,color .15s,border-color .15s';

  // Remplacer transition:all avec variations d'espaces
  const updated = original.replace(
    /transition\s*:\s*all\b[^;]*/g,
    REPLACEMENT
  );

  if (updated !== original) {
    writeFileSync(cssPath, updated, 'utf8');
    const count = (original.match(/transition\s*:\s*all\b/g) ?? []).length;
    log(`  [PASS ${pass}] Corrigé transition:all (${count} occurrence(s)) dans style.css`);
    fixed += count;
  }

  return fixed;
}

// ── Corrections : recompression images avec sharp ────────────────────────────

async function optimizeImages(pass) {
  if (!sharp) {
    log(`  [PASS ${pass}] sharp absent — optimisation images ignorée`);
    return 0;
  }

  let fixed = 0;
  const imageDir = join(ROOT, 'images');
  const images = readDirImages(imageDir);

  for (const imgPath of images) {
    const stat = statSync(imgPath);
    const sizeKB = stat.size / 1024;
    const ext = extname(imgPath).toLowerCase();
    const nameWithoutExt = basename(imgPath, ext);
    const dir = dirname(imgPath);

    // Créer WebP si image > 100 KB et pas de WebP existant
    const webpPath = join(dir, `${nameWithoutExt}.webp`);
    if (sizeKB > 100 && !existsSync(webpPath)) {
      try {
        await sharp(imgPath)
          .webp({ quality: 80 })
          .toFile(webpPath);
        const webpStat = statSync(webpPath);
        log(`  [PASS ${pass}] Créé WebP : ${webpPath.replace(ROOT + '\\', '')} (${Math.round(webpStat.size / 1024)} KB)`);
        fixed++;
      } catch (err) {
        log(`  [PASS ${pass}] Erreur WebP pour ${imgPath}: ${err.message}`);
      }
    }

    // Créer AVIF si image > 100 KB et pas d'AVIF existant
    const avifPath = join(dir, `${nameWithoutExt}.avif`);
    if (sizeKB > 100 && !existsSync(avifPath)) {
      try {
        await sharp(imgPath)
          .avif({ quality: 65 })
          .toFile(avifPath);
        const avifStat = statSync(avifPath);
        log(`  [PASS ${pass}] Créé AVIF : ${avifPath.replace(ROOT + '\\', '')} (${Math.round(avifStat.size / 1024)} KB)`);
        fixed++;
      } catch (err) {
        log(`  [PASS ${pass}] Erreur AVIF pour ${imgPath}: ${err.message}`);
      }
    }

    // Recompresser si > 200 KB (écrase l'original avec version compressée)
    if (sizeKB > 200) {
      try {
        const tmpPath = imgPath + '.tmp';
        if (ext === '.png') {
          await sharp(imgPath).png({ compressionLevel: 9, quality: 80 }).toFile(tmpPath);
        } else if (ext === '.jpg' || ext === '.jpeg') {
          await sharp(imgPath).jpeg({ quality: 80, mozjpeg: true }).toFile(tmpPath);
        } else {
          continue;
        }

        const tmpStat = statSync(tmpPath);
        const tmpKB = tmpStat.size / 1024;

        if (tmpKB < sizeKB) {
          // Remplacer seulement si gain réel
          const { renameSync } = await import('fs');
          renameSync(tmpPath, imgPath);
          log(`  [PASS ${pass}] Recompressé : ${imgPath.replace(ROOT + '\\', '')} ${Math.round(sizeKB)} KB → ${Math.round(tmpKB)} KB`);
          fixed++;
        } else {
          const { unlinkSync } = await import('fs');
          unlinkSync(tmpPath);
          log(`  [PASS ${pass}] Pas de gain pour ${basename(imgPath)} — ignoré`);
        }
      } catch (err) {
        log(`  [PASS ${pass}] Erreur recompression ${imgPath}: ${err.message}`);
      }
    }
  }

  return fixed;
}

// ── Rapport final ────────────────────────────────────────────────────────────

function generateReport(passResults) {
  mkdirSync(REPORTS_DIR, { recursive: true });

  const totalFixed = passResults.reduce((sum, p) => sum + p.totalFixed, 0);
  const lines = [
    `# Rapport Auto-Optimisation — boutique.info-experts.fr`,
    ``,
    `**Généré le :** ${new Date().toLocaleString('fr-FR')}`,
    `**Passes exécutées :** ${passResults.length}/${MAX_PASSES}`,
    `**Total corrections appliquées :** ${totalFixed}`,
    ``,
    `---`,
    ``,
  ];

  for (const p of passResults) {
    lines.push(`## Passe ${p.pass}`);
    lines.push(``);
    lines.push(`| Type de correction | Nombre |`);
    lines.push(`|--------------------|--------|`);
    lines.push(`| decoding="sync" corrigés | ${p.decodingFixed} |`);
    lines.push(`| transition:all corrigés | ${p.transitionFixed} |`);
    lines.push(`| Images optimisées/créées | ${p.imagesFixed} |`);
    lines.push(`| Total cette passe | ${p.totalFixed} |`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);

  if (totalFixed === 0) {
    lines.push(`Aucune correction nécessaire — le projet est déjà optimisé.`);
  } else {
    lines.push(`${totalFixed} correction(s) appliquée(s) automatiquement.`);
    lines.push(``);
    lines.push(`**Vérifications recommandées après optimisation :**`);
    lines.push(``);
    lines.push(`- [ ] Tester le panier (localStorage + ajout produit)`);
    lines.push(`- [ ] Tester Stripe (checkout mobile + desktop)`);
    lines.push(`- [ ] Vérifier le rendu visuel (design inchangé)`);
    lines.push(`- [ ] Lancer Lighthouse pour confirmer le score`);
  }

  lines.push(``);
  lines.push(`## Log détaillé`);
  lines.push(``);
  lines.push('```');
  lines.push(LOG.join('\n'));
  lines.push('```');

  writeFileSync(
    join(REPORTS_DIR, 'auto-optimize-report.md'),
    lines.join('\n'),
    'utf8'
  );

  const jsonReport = {
    project: 'alkamar-info',
    generatedAt: new Date().toISOString(),
    passesRun: passResults.length,
    maxPasses: MAX_PASSES,
    totalFixed,
    passes: passResults,
  };

  writeFileSync(
    join(REPORTS_DIR, 'auto-optimize-report.json'),
    JSON.stringify(jsonReport, null, 2),
    'utf8'
  );

  console.log(`\nRapports générés :`);
  console.log(`  reports/auto-optimize-report.md`);
  console.log(`  reports/auto-optimize-report.json`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  log(`\nAuto-Optimisation Performance — boutique.info-experts.fr`);
  log(`Racine : ${ROOT}`);
  log(`Max passes : ${MAX_PASSES}`);

  const passResults = [];

  for (let pass = 1; pass <= MAX_PASSES; pass++) {
    log(`\n════════════════════════════════════════`);
    log(`  PASSE ${pass}/${MAX_PASSES}`);
    log(`════════════════════════════════════════`);

    // Lancer l'audit pour avoir les données fraîches
    runAudit();

    // Appliquer les corrections
    const decodingFixed = fixDecodingSync(pass);
    const transitionFixed = fixTransitionAll(pass);
    const imagesFixed = await optimizeImages(pass);

    const totalFixed = decodingFixed + transitionFixed + imagesFixed;

    passResults.push({ pass, decodingFixed, transitionFixed, imagesFixed, totalFixed });

    log(`\n  Passe ${pass} terminée : ${totalFixed} correction(s) appliquée(s)`);

    if (totalFixed === 0) {
      log(`  Aucune correction — arrêt des passes (tout est déjà optimisé)`);
      break;
    }
  }

  generateReport(passResults);

  const totalFixed = passResults.reduce((sum, p) => sum + p.totalFixed, 0);

  if (totalFixed > 0) {
    log(`\nAuto-optimisation terminée : ${totalFixed} correction(s) totale(s) sur ${passResults.length} passe(s)`);
    log(`Vérifier le design et Stripe avant de committer.`);
  } else {
    log(`\nAucune optimisation nécessaire — projet déjà en bon état.`);
  }
}

main().catch((err) => {
  console.error('Erreur fatale :', err);
  process.exit(1);
});
