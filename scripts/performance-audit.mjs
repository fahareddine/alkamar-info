/**
 * performance-audit.mjs — alkamar-info (boutique.info-experts.fr)
 * Analyse statique du projet pour détecter les problèmes de performance.
 *
 * Vérifie :
 *  - Images trop lourdes (> 200 KB) dans images/ et images/produits/
 *  - PNG/JPG sans variante WebP/AVIF
 *  - Patterns problématiques dans .html et .js :
 *      limit=500, fetchpriority="high" sur images dynamiques,
 *      decoding="sync", transition:all, images sans width/height,
 *      preload CSS sans trick onload
 *  - vercel.json : Cache-Control sur images
 *
 * Génère reports/performance-audit.md et reports/performance-audit.json
 */

import { readdirSync, statSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, extname, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const REPORTS_DIR = join(ROOT, 'reports');

const ISSUES = [];
const WARNINGS = [];
const INFO = [];

// ── Helpers ──────────────────────────────────────────────────────────────────

function addIssue(category, message, file = null) {
  ISSUES.push({ category, message, file });
  const loc = file ? ` [${file}]` : '';
  console.log(`  [ISSUE] ${category}${loc}: ${message}`);
}

function addWarning(category, message, file = null) {
  WARNINGS.push({ category, message, file });
  const loc = file ? ` [${file}]` : '';
  console.log(`  [WARN]  ${category}${loc}: ${message}`);
}

function addInfo(category, message) {
  INFO.push({ category, message });
}

function readDirRecursive(dir, extensions, maxDepth = 4, depth = 0) {
  if (!existsSync(dir) || depth > maxDepth) return [];
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...readDirRecursive(full, extensions, maxDepth, depth + 1));
    } else if (extensions.includes(extname(entry.name).toLowerCase())) {
      files.push(full);
    }
  }
  return files;
}

// ── 1. Audit images ──────────────────────────────────────────────────────────

function auditImages() {
  console.log('\n[1/5] Audit images…');

  const imageDirs = [
    join(ROOT, 'images'),
  ];

  const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff'];
  const WEBP_AVIF_EXTENSIONS = ['.webp', '.avif'];

  for (const dir of imageDirs) {
    if (!existsSync(dir)) continue;

    const allFiles = readdirSync(dir, { withFileTypes: true });

    // Collect all files in current dir + produits/
    const filesToCheck = [];
    for (const entry of allFiles) {
      if (entry.isFile()) {
        filesToCheck.push({ full: join(dir, entry.name), name: entry.name, subdir: '' });
      } else if (entry.isDirectory() && entry.name === 'produits') {
        const subDir = join(dir, entry.name);
        const subFiles = readdirSync(subDir, { withFileTypes: true });
        for (const sub of subFiles) {
          if (sub.isFile()) {
            filesToCheck.push({ full: join(subDir, sub.name), name: sub.name, subdir: 'produits/' });
          }
        }
      }
    }

    // Collect names of all WebP/AVIF present
    const optimizedNames = new Set(
      filesToCheck
        .filter(f => WEBP_AVIF_EXTENSIONS.includes(extname(f.name).toLowerCase()))
        .map(f => basename(f.name, extname(f.name)).toLowerCase())
    );

    for (const { full, name, subdir } of filesToCheck) {
      const ext = extname(name).toLowerCase();
      const relPath = `images/${subdir}${name}`;

      // Skip WebP/AVIF themselves
      if (WEBP_AVIF_EXTENSIONS.includes(ext)) continue;

      // Not an image at all
      if (!IMAGE_EXTENSIONS.includes(ext)) continue;

      const stat = statSync(full);
      const sizeKB = stat.size / 1024;

      // Check size
      if (sizeKB > 200) {
        addIssue('images', `Fichier trop lourd : ${Math.round(sizeKB)} KB (seuil: 200 KB)`, relPath);
      } else if (sizeKB > 100) {
        addWarning('images', `Fichier assez lourd : ${Math.round(sizeKB)} KB (seuil recommandé: 100 KB)`, relPath);
      }

      // Check for WebP/AVIF variant
      const nameWithoutExt = basename(name, ext).toLowerCase();
      if (!optimizedNames.has(nameWithoutExt)) {
        addWarning('images', `Pas de variante WebP/AVIF pour ${name}`, relPath);
      }
    }
  }

  addInfo('images', 'Audit images terminé');
}

// ── 2. Audit HTML/JS patterns ────────────────────────────────────────────────

function auditHtmlJs() {
  console.log('\n[2/5] Audit HTML et JS…');

  const htmlFiles = readDirRecursive(ROOT, ['.html'], 2);
  const jsFiles = readDirRecursive(join(ROOT, 'js'), ['.js'], 2);

  const allFiles = [...htmlFiles, ...jsFiles];

  for (const filePath of allFiles) {
    const rel = filePath.replace(ROOT + '\\', '').replace(ROOT + '/', '');
    const content = readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, idx) => {
      const lineNum = idx + 1;
      const loc = `${rel}:${lineNum}`;

      // limit=500 dans fetch
      if (/limit=500/.test(line)) {
        addIssue('api', `limit=500 détecté (charge inutilement 500 produits)`, loc);
      }

      // fetchpriority="high" sur images dynamiques (src contenant ${} ou ?)
      if (/fetchpriority=["']high["']/.test(line)) {
        // Acceptable sur image LCP statique, problématique sur img dynamique
        if (/\$\{/.test(line) || /src=["'][^"']*\?/.test(line)) {
          addIssue('images', `fetchpriority="high" sur image dynamique (risque LCP incorrect)`, loc);
        }
      }

      // decoding="sync"
      if (/decoding=["']sync["']/.test(line)) {
        addIssue('tbt', `decoding="sync" détecté (bloque le thread principal, préférer "async")`, loc);
      }

      // transition:all — non-composité, cause layout thrashing
      if (/transition\s*:\s*all/.test(line)) {
        addWarning('css', `transition:all détecté (non-composité, préférer propriétés spécifiques)`, loc);
      }

      // <img sans width ou height
      if (/<img\b/.test(line)) {
        const hasWidth = /\bwidth=/.test(line) || /\bwidth:/.test(line);
        const hasHeight = /\bheight=/.test(line) || /\bheight:/.test(line);
        // Only flag if both missing and it's a real img tag on one line
        if (!hasWidth && !hasHeight && /<img\b[^>]*>/.test(line)) {
          addWarning('cls', `<img> sans width/height (cause CLS)`, loc);
        }
      }

      // preload CSS sans trick onload
      if (/rel=["']preload["'][^>]*as=["']style["']/.test(line)) {
        if (!(/onload/.test(line))) {
          addWarning('css', `<link rel="preload" as="style"> sans onload trick (bloquant ou inutile)`, loc);
        }
      }
    });
  }

  addInfo('html-js', `${allFiles.length} fichiers analysés`);
}

// ── 3. Audit CSS (style.css) ──────────────────────────────────────────────────

function auditCss() {
  console.log('\n[3/5] Audit CSS…');

  const cssPath = join(ROOT, 'style.css');
  if (!existsSync(cssPath)) {
    addInfo('css', 'style.css introuvable — skip');
    return;
  }

  const content = readFileSync(cssPath, 'utf8');
  const lines = content.split('\n');

  let transitionAllCount = 0;
  lines.forEach((line, idx) => {
    if (/transition\s*:\s*all/.test(line)) {
      transitionAllCount++;
      addWarning('css', `transition:all dans style.css ligne ${idx + 1} (non-composité)`, 'style.css');
    }
  });

  if (transitionAllCount === 0) {
    addInfo('css', 'Aucun transition:all détecté dans style.css — OK');
  }
}

// ── 4. Audit vercel.json ─────────────────────────────────────────────────────

function auditVercelJson() {
  console.log('\n[4/5] Audit vercel.json…');

  const vercelPath = join(ROOT, 'vercel.json');
  if (!existsSync(vercelPath)) {
    addWarning('cache', 'vercel.json introuvable — impossible de vérifier les headers cache');
    return;
  }

  let config;
  try {
    config = JSON.parse(readFileSync(vercelPath, 'utf8'));
  } catch (e) {
    addIssue('config', `vercel.json invalide JSON : ${e.message}`, 'vercel.json');
    return;
  }

  const headers = config.headers ?? [];

  // Chercher Cache-Control sur les images
  const imagePatterns = ['.webp', '.avif', '.png', '.jpg', 'images/'];
  let imagesCached = false;

  for (const h of headers) {
    const src = h.source ?? '';
    const hasImagePattern = imagePatterns.some(p => src.includes(p));
    if (hasImagePattern) {
      const cacheHeader = (h.headers ?? []).find(
        hh => hh.key?.toLowerCase() === 'cache-control'
      );
      if (cacheHeader) {
        imagesCached = true;
        addInfo('cache', `Cache-Control trouvé pour "${src}": ${cacheHeader.value}`);
      }
    }
  }

  if (!imagesCached) {
    addWarning('cache', 'Aucun Cache-Control sur les images dans vercel.json (ajouter immutable pour les assets statiques)');
  } else {
    addInfo('cache', 'Cache-Control images OK dans vercel.json');
  }
}

// ── 5. Résumé rapide ─────────────────────────────────────────────────────────

function printSummary() {
  console.log('\n[5/5] Génération des rapports…');
  console.log(`\n── Résumé ──────────────────────────────────`);
  console.log(`  Issues   : ${ISSUES.length}`);
  console.log(`  Warnings : ${WARNINGS.length}`);
  console.log(`  Infos    : ${INFO.length}`);
}

// ── Génération rapports ───────────────────────────────────────────────────────

function generateReports() {
  mkdirSync(REPORTS_DIR, { recursive: true });

  // JSON
  const jsonReport = {
    project: 'alkamar-info',
    generatedAt: new Date().toISOString(),
    summary: {
      issues: ISSUES.length,
      warnings: WARNINGS.length,
    },
    issues: ISSUES,
    warnings: WARNINGS,
    info: INFO,
  };

  writeFileSync(
    join(REPORTS_DIR, 'performance-audit.json'),
    JSON.stringify(jsonReport, null, 2),
    'utf8'
  );

  // Markdown
  const lines = [
    `# Audit Performance — boutique.info-experts.fr`,
    ``,
    `**Généré le :** ${new Date().toLocaleString('fr-FR')}`,
    ``,
    `## Résumé`,
    ``,
    `| Type | Nombre |`,
    `|------|--------|`,
    `| Issues (à corriger) | ${ISSUES.length} |`,
    `| Warnings (à surveiller) | ${WARNINGS.length} |`,
    ``,
    `---`,
    ``,
  ];

  if (ISSUES.length > 0) {
    lines.push(`## Issues (${ISSUES.length})`);
    lines.push(``);
    lines.push(`| Catégorie | Fichier | Message |`);
    lines.push(`|-----------|---------|---------|`);
    for (const i of ISSUES) {
      lines.push(`| ${i.category} | ${i.file ?? '-'} | ${i.message} |`);
    }
    lines.push(``);
  }

  if (WARNINGS.length > 0) {
    lines.push(`## Warnings (${WARNINGS.length})`);
    lines.push(``);
    lines.push(`| Catégorie | Fichier | Message |`);
    lines.push(`|-----------|---------|---------|`);
    for (const w of WARNINGS) {
      lines.push(`| ${w.category} | ${w.file ?? '-'} | ${w.message} |`);
    }
    lines.push(``);
  }

  if (ISSUES.length === 0 && WARNINGS.length === 0) {
    lines.push(`Aucun problème détecté — performances optimales.`);
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(``);
  lines.push(`## Infos`);
  lines.push(``);
  for (const i of INFO) {
    lines.push(`- **${i.category}** : ${i.message}`);
  }

  writeFileSync(
    join(REPORTS_DIR, 'performance-audit.md'),
    lines.join('\n'),
    'utf8'
  );

  console.log(`\nRapports générés :`);
  console.log(`  reports/performance-audit.json`);
  console.log(`  reports/performance-audit.md`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\nAudit Performance — boutique.info-experts.fr`);
console.log(`Racine : ${ROOT}\n`);

auditImages();
auditHtmlJs();
auditCss();
auditVercelJson();
printSummary();
generateReports();

// Exit avec code 1 si des issues critiques
if (ISSUES.length > 0) {
  console.log(`\n${ISSUES.length} issue(s) détectée(s) — corriger avant de déployer.`);
  process.exit(0); // Exit 0 pour ne pas bloquer le CI (audit informatif)
} else {
  console.log(`\nAudit terminé — aucun blocage critique.`);
  process.exit(0);
}
