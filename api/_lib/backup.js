// api/_lib/backup.js
// Système de sauvegarde type Updraft — délégué depuis api/products.js (_route=backup)
// - Dump JSON de toutes les tables métier → bucket Supabase Storage "backups"
// - Crons Vercel : 06h00 + 00h00 (rétention 14 sauvegardes = 7 jours)
// - Restauration par upsert (non destructive) avec pré-sauvegarde automatique
const { supabase } = require('./supabase');
const { requireRole } = require('./auth');

const BUCKET = 'backups';
const RETENTION = 14; // 2/jour × 7 jours

// Tables sauvegardées (ordre de restauration : parents avant enfants)
const TABLES = [
  'user_profiles', 'categories', 'products', 'customers', 'orders', 'order_items',
  'invoices', 'coupon_codes', 'promotions', 'product_reviews', 'stock_alerts',
  'product_pricing', 'category_pricing_rules', 'pricing_settings',
  'product_price_history', 'stock_movements', 'digital_licenses', 'admin_logs',
];

const PAGE = 1000;

async function dumpTable(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE - 1);
    if (error) return { table, error: error.message, rows: [] };
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return { table, rows };
}

async function ensureBucket() {
  const { data } = await supabase.storage.getBucket(BUCKET);
  if (!data) {
    await supabase.storage.createBucket(BUCKET, { public: false });
  }
}

async function createBackup(trigger) {
  await ensureBucket();
  const startedAt = new Date();
  const tables = {};
  const warnings = [];

  for (const t of TABLES) {
    const r = await dumpTable(t);
    if (r.error) warnings.push(`${t}: ${r.error}`);
    else tables[t] = r.rows;
  }

  const payload = {
    version: 1,
    created_at: startedAt.toISOString(),
    trigger,
    counts: Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length])),
    warnings,
    tables,
  };

  // Nom unique à la seconde + trigger — évite toute collision (une pré-sauvegarde
  // dans la même minute écraserait sinon la sauvegarde en cours de restauration)
  const stamp = startedAt.toISOString().slice(0, 19).replace('T', '-').replace(':', 'h').replace(':', 'm');
  const file = `backup-${stamp}-${trigger.replace(/[^a-z-]/gi, '')}.json`;
  const body = Buffer.from(JSON.stringify(payload));

  const { error: upErr } = await supabase.storage.from(BUCKET)
    .upload(file, body, { contentType: 'application/json', upsert: false });
  if (upErr) throw new Error(`Upload échoué : ${upErr.message}`);

  // Rétention : supprime les plus anciennes au-delà de RETENTION
  const { data: list } = await supabase.storage.from(BUCKET).list('', { limit: 200 });
  const backups = (list || []).filter(f => f.name.startsWith('backup-')).sort((a, b) => b.name.localeCompare(a.name));
  const toDelete = backups.slice(RETENTION).map(f => f.name);
  if (toDelete.length) await supabase.storage.from(BUCKET).remove(toDelete);

  return {
    file,
    size_kb: Math.round(body.length / 1024),
    counts: payload.counts,
    warnings,
    duration_ms: Date.now() - startedAt.getTime(),
    deleted_old: toDelete.length,
  };
}

async function restoreBackup(file, selectedTables, mode = 'upsert') {
  const { data: blob, error: dlErr } = await supabase.storage.from(BUCKET).download(file);
  if (dlErr || !blob) throw new Error(`Téléchargement impossible : ${dlErr?.message || 'fichier introuvable'}`);
  const payload = JSON.parse(await blob.text());
  if (!payload.tables) throw new Error('Fichier de sauvegarde invalide');

  // Pré-sauvegarde automatique de l'état actuel avant restauration
  const pre = await createBackup('pre-restore');

  const restored = {};
  const deleted = {};
  const errors = [];
  const wanted = Array.isArray(selectedTables) && selectedTables.length
    ? TABLES.filter(t => selectedTables.includes(t))
    : TABLES;

  for (const t of wanted) {
    const rows = payload.tables[t];
    if (!rows) { restored[t] = 0; continue; }

    // 1. Upsert des lignes de la sauvegarde
    let ok = 0;
    let failed = false;
    for (let i = 0; i < rows.length; i += 500) {
      const chunk = rows.slice(i, i + 500);
      const { error } = await supabase.from(t).upsert(chunk, { onConflict: 'id' });
      if (error) { errors.push(`${t}: ${error.message}`); failed = true; break; }
      ok += chunk.length;
    }
    restored[t] = ok;
    if (failed) continue;

    // 2. Mode remplacement exact : supprime les lignes absentes de la sauvegarde
    //    (lignes parasites créées après — ex. import raté). En cas de contrainte
    //    FK bloquante, l'erreur est remontée sans interrompre les autres tables.
    if (mode === 'replace') {
      const backupIds = new Set(rows.map(r => r.id).filter(Boolean));
      const current = await dumpTable(t);
      if (current.error) { errors.push(`${t} (purge): ${current.error}`); continue; }
      const extra = current.rows.map(r => r.id).filter(id => id && !backupIds.has(id));
      let del = 0;
      for (let i = 0; i < extra.length; i += 200) {
        const chunk = extra.slice(i, i + 200);
        const { error } = await supabase.from(t).delete().in('id', chunk);
        if (error) { errors.push(`${t} (purge): ${error.message}`); break; }
        del += chunk.length;
      }
      deleted[t] = del;
    }
  }

  return { mode, restored, deleted, errors, pre_restore_backup: pre.file };
}

function isVercelCron(req) {
  if (process.env.CRON_SECRET) {
    return req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  }
  return String(req.headers['user-agent'] || '').startsWith('vercel-cron');
}

module.exports = backupHandler;
// Exports internes pour scripts de test/maintenance (scripts/test-restore.mjs)
module.exports.createBackup = createBackup;
module.exports.restoreBackup = restoreBackup;
module.exports.TABLES = TABLES;

async function backupHandler(req, res) {
  const action = req.query.action || 'list';

  // ── Cron (sans auth admin — vérifié par header Vercel) ──
  if (action === 'cron') {
    if (!isVercelCron(req)) return res.status(401).json({ error: 'Non autorisé' });
    try {
      const result = await createBackup('cron');
      console.log('[backup] cron OK:', result.file, result.size_kb + 'KB');
      return res.status(200).json({ ok: true, ...result });
    } catch (e) {
      console.error('[backup] cron échec:', e.message);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── Toutes les autres actions : admin uniquement ──
  const auth = await requireRole(req, 'admin');
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    if (action === 'list' && req.method === 'GET') {
      await ensureBucket();
      const { data, error } = await supabase.storage.from(BUCKET).list('', {
        limit: 100, sortBy: { column: 'name', order: 'desc' },
      });
      if (error) return res.status(500).json({ error: error.message });
      const files = (data || []).filter(f => f.name.startsWith('backup-')).map(f => ({
        name: f.name,
        size_kb: Math.round((f.metadata?.size || 0) / 1024),
        created_at: f.created_at,
      }));
      return res.status(200).json({ files, retention: RETENTION, tables: TABLES });
    }

    if (action === 'run' && req.method === 'POST') {
      const result = await createBackup('manuel');
      return res.status(200).json({ ok: true, ...result });
    }

    if (action === 'restore' && req.method === 'POST') {
      const { file, tables, mode } = req.body || {};
      if (!file || !/^backup-[\w.-]+\.json$/.test(file)) {
        return res.status(400).json({ error: 'Nom de fichier invalide' });
      }
      if (mode && !['upsert', 'replace'].includes(mode)) {
        return res.status(400).json({ error: 'Mode invalide (upsert | replace)' });
      }
      const result = await restoreBackup(file, tables, mode || 'upsert');
      return res.status(200).json({ ok: true, ...result });
    }

    if (action === 'download' && req.method === 'GET') {
      const file = req.query.file;
      if (!file || !/^backup-[\w.-]+\.json$/.test(file)) {
        return res.status(400).json({ error: 'Nom de fichier invalide' });
      }
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(file, 300);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ url: data.signedUrl });
    }

    if (action === 'delete' && req.method === 'DELETE') {
      const file = req.query.file;
      if (!file || !/^backup-[\w.-]+\.json$/.test(file)) {
        return res.status(400).json({ error: 'Nom de fichier invalide' });
      }
      const { error } = await supabase.storage.from(BUCKET).remove([file]);
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ ok: true });
    }

    return res.status(404).json({ error: 'Action inconnue' });
  } catch (e) {
    console.error('[backup]', action, 'échec:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
