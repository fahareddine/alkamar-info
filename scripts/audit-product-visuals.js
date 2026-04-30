#!/usr/bin/env node
// scripts/audit-product-visuals.js
// Audit visuel des produits : watermarks, images manquantes, badges invalides, doublons

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));

// Charge .env.local
try {
  const env = readFileSync(resolve(__dir, '../.env.local'), 'utf-8');
  env.split('\n').forEach(line => {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  });
} catch {}

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ SUPABASE_URL ou SUPABASE_KEY manquant dans .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Config ──────────────────────────────────────────────────────────────────
// NB: m.media-amazon.com est un CDN légitime — NE PAS bloquer
const BANNED_DOMAINS = [
  'ldlc.com', '/ldlc', 'ldlc-media',
  'cdiscount.com', 'fnac.com', 'darty.com',
  'boulanger.com', 'materiel.net', 'rue-du-commerce'
];

const VALID_BADGE_CLASSES = [
  'badge--promo', 'badge--new', 'badge--best', 'badge--popular',
  'badge--exclusive', 'badge--reco', 'badge--deal', 'badge--stock'
];

// ── Helpers ─────────────────────────────────────────────────────────────────
function isBanned(url) {
  if (!url) return false;
  const u = url.toLowerCase();
  return BANNED_DOMAINS.some(d => u.includes(d));
}

function checkUrl(url, label, issues) {
  if (!url) {
    issues.push({ type: 'IMAGE_MANQUANTE', detail: `${label} vide ou null` });
    return;
  }
  if (isBanned(url)) {
    issues.push({ type: 'WATERMARK_URL', detail: `${label} contient un domaine marchand : ${url}` });
  }
}

// ── Audit ────────────────────────────────────────────────────────────────────
async function run() {
  console.log('\n🔍 Audit visuel produits — Alkamar Info\n' + '─'.repeat(60));

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, category, subcategory, brand, badge, badge_class, main_image_url, gallery_urls, gallery, status')
    .order('name');

  if (error) { console.error('❌ Erreur Supabase:', error.message); process.exit(1); }

  console.log(`📦 ${products.length} produits analysés\n`);

  const report = [];
  let totalIssues = 0;

  for (const p of products) {
    const issues = [];

    // 1. Image principale
    checkUrl(p.main_image_url, 'main_image_url', issues);

    // 2. Galerie
    const gallery = p.gallery_urls || p.gallery || [];
    if (Array.isArray(gallery)) {
      const seen = new Set();
      gallery.forEach((item, i) => {
        const url = typeof item === 'string' ? item : item?.src;
        checkUrl(url, `gallery[${i}]`, issues);
        if (url) {
          if (seen.has(url)) issues.push({ type: 'DOUBLON', detail: `gallery[${i}] URL dupliquée : ${url}` });
          seen.add(url);
        }
      });
      if (gallery.length < 2) {
        issues.push({ type: 'PEU_IMAGES', detail: `Seulement ${gallery.length} image(s) dans la galerie` });
      }
    }

    // 3. Badge
    if (p.badge) {
      if (!p.badge_class) {
        issues.push({ type: 'BADGE_SANS_CLASSE', detail: `Badge "${p.badge}" sans badge_class → fond invisible` });
      } else if (!VALID_BADGE_CLASSES.includes(p.badge_class)) {
        issues.push({ type: 'BADGE_CLASSE_INVALIDE', detail: `badge_class "${p.badge_class}" non défini en CSS` });
      }
    }

    if (issues.length > 0) {
      totalIssues += issues.length;
      report.push({ id: p.id, name: p.name, category: p.subcategory || p.category, brand: p.brand, issues });
    }
  }

  // ── Affichage rapport ──────────────────────────────────────────────────────
  if (report.length === 0) {
    console.log('✅ Aucun problème visuel détecté.');
    return;
  }

  // Grouper par type
  const byType = {};
  report.forEach(p => p.issues.forEach(i => {
    byType[i.type] = (byType[i.type] || 0) + 1;
  }));

  console.log('📊 RÉSUMÉ DES PROBLÈMES');
  console.log('─'.repeat(60));
  Object.entries(byType).sort((a,b) => b[1]-a[1]).forEach(([t,c]) => {
    console.log(`  ${c.toString().padStart(4)}  ${t}`);
  });
  console.log(`  ${'─'.repeat(20)}`);
  console.log(`  ${totalIssues.toString().padStart(4)}  TOTAL\n`);

  console.log('📋 DÉTAIL PAR PRODUIT');
  console.log('─'.repeat(60));

  report.forEach(p => {
    console.log(`\n🔸 [${p.category || '?'}] ${p.name} (${p.brand || '-'})`);
    console.log(`   ID: ${p.id}`);
    p.issues.forEach(i => {
      const icon = i.type === 'WATERMARK_URL' ? '🚨' :
                   i.type === 'IMAGE_MANQUANTE' ? '❌' :
                   i.type === 'BADGE_SANS_CLASSE' || i.type === 'BADGE_CLASSE_INVALIDE' ? '⚠️' :
                   i.type === 'DOUBLON' ? '🔁' : '⚠️';
      console.log(`   ${icon} ${i.type}: ${i.detail}`);
    });
  });

  console.log('\n' + '─'.repeat(60));
  console.log(`\n📌 ACTION REQUISE sur ${report.length} produit(s)\n`);
  console.log('Actions recommandées:');
  console.log('  🚨 WATERMARK_URL   → Remplacer les images par des photos sans logo marchand');
  console.log('  ❌ IMAGE_MANQUANTE  → Ajouter une image principale via l\'admin');
  console.log('  ⚠️  BADGE_*         → Corriger badge_class en base (valeurs: ' + VALID_BADGE_CLASSES.join(', ') + ')');
  console.log('  🔁 DOUBLON         → Supprimer les URLs dupliquées dans gallery_urls\n');
}

run().catch(e => { console.error('❌ Erreur:', e.message); process.exit(1); });
