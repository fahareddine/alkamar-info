// scripts/test-restore.mjs
// Exercice de restauration bout-en-bout (sans risque) sur la table product_reviews :
// 1. Sauvegarde fraîche
// 2. Corruption simulée : modification d'un avis existant + insertion de 2 avis parasites
// 3. Restauration FUSION (upsert)        → la modification est annulée, parasites encore là
// 4. Restauration REMPLACEMENT (replace) → parasites supprimés, état exact de la sauvegarde
import { createRequire } from 'node:module';
import { config } from 'dotenv';

config({ path: '.env.local' });
const require = createRequire(import.meta.url);
const { createBackup, restoreBackup } = require('../api/_lib/backup.js');
const { supabase } = require('../api/_lib/supabase.js');

const T = 'product_reviews';
const ok = (label, cond) => console.log((cond ? '  ✔' : '  ✖ ÉCHEC'), label);
let failures = 0;
const check = (label, cond) => { ok(label, cond); if (!cond) failures++; };

async function snapshot() {
  const { data } = await supabase.from(T).select('id, author_name, comment').order('id');
  return data;
}

console.log('── 1. État initial + sauvegarde fraîche');
const initial = await snapshot();
console.log(`  ${initial.length} avis en base`);
const bk = await createBackup('test-restore');
console.log(`  Sauvegarde : ${bk.file} (${bk.size_kb} Ko, ${Object.keys(bk.counts).length} tables)`);

console.log('── 2. Corruption simulée');
let modifiedId = null;
if (initial.length) {
  modifiedId = initial[0].id;
  await supabase.from(T).update({ comment: 'CORROMPU PAR LE TEST' }).eq('id', modifiedId);
  console.log('  Avis existant modifié (comment → CORROMPU)');
}
const { data: prod } = await supabase.from('products').select('id').eq('status', 'active').limit(1).single();
const parasites = [];
for (let i = 1; i <= 2; i++) {
  const { data } = await supabase.from(T).insert({
    product_id: prod.id, author_name: `Parasite Test ${i}`, rating: 1,
    comment: 'Ligne parasite à purger', status: 'rejected',
  }).select('id').single();
  parasites.push(data.id);
}
console.log(`  2 avis parasites insérés (${parasites.length} ids)`);

console.log('── 3. Restauration FUSION (upsert)');
const r1 = await restoreBackup(bk.file, [T], 'upsert');
check('aucune erreur', r1.errors.length === 0);
check('pré-sauvegarde créée', !!r1.pre_restore_backup);
const after1 = await snapshot();
if (modifiedId) {
  const row = after1.find(r => r.id === modifiedId);
  check('modification annulée (comment restauré)', row && row.comment !== 'CORROMPU PAR LE TEST');
}
check('parasites encore présents (fusion ne supprime pas)', parasites.every(id => after1.some(r => r.id === id)));

console.log('── 4. Restauration REMPLACEMENT EXACT (replace)');
const r2 = await restoreBackup(bk.file, [T], 'replace');
check('aucune erreur', r2.errors.length === 0);
check(`parasites purgés (${r2.deleted[T] || 0} supprimés)`, (r2.deleted[T] || 0) >= 2);
const after2 = await snapshot();
check('parasites absents de la base', parasites.every(id => !after2.some(r => r.id === id)));
check(`compte final identique à l'initial (${after2.length} = ${initial.length})`, after2.length === initial.length);

console.log('── 5. Vérification intégrité du fichier de sauvegarde');
const { data: blob } = await supabase.storage.from('backups').download(bk.file);
const payload = JSON.parse(await blob.text());
check('JSON valide + 18 tables listées', Object.keys(payload.tables).length >= 18);
check('aucun avertissement (toutes les tables dumpées)', (payload.warnings || []).length === 0);
check('produits présents dans la sauvegarde', (payload.tables.products || []).length > 300);

console.log(failures === 0 ? '\n✅ EXERCICE DE RESTAURATION : TOUT FONCTIONNE' : `\n❌ ${failures} vérification(s) en échec`);
process.exit(failures === 0 ? 0 : 1);
