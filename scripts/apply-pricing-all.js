// scripts/apply-pricing-all.js
// Prend price_eur actuel comme prix d'achat, calcule le prix de vente Comores, applique
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const { calculateComorosPrice } = require('../api/_lib/pricing');

const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function run() {
  console.log('Chargement des données…');

  // Settings globaux
  const { data: settings } = await sb.from('pricing_settings').select('*').limit(1).single();
  if (!settings) { console.error('pricing_settings manquants'); process.exit(1); }
  console.log('Taux EUR/KMF:', settings.eur_to_kmf_rate, '| Marge défaut:', (settings.default_margin_rate * 100) + '%');

  // Règles par catégorie
  const { data: catRules } = await sb.from('category_pricing_rules').select('*');
  const catMap = {};
  (catRules || []).forEach(r => { catMap[r.category_id] = r; });
  console.log('Règles catégories:', Object.keys(catMap).length);

  // Tous les produits actifs avec prix
  const { data: products } = await sb.from('products')
    .select('id, name, brand, price_eur, price_kmf, category_id')
    .eq('status', 'active')
    .gt('price_eur', 0)
    .order('name');
  console.log('Produits actifs avec prix:', products?.length || 0, '\n');

  let updated = 0, skipped = 0, errors = 0;

  for (const p of products) {
    const catRule = p.category_id ? catMap[p.category_id] : null;
    const mergedSettings = {
      ...settings,
      default_margin_rate:    catRule?.default_margin_rate ?? settings.default_margin_rate,
      default_customs_rate:   catRule?.customs_rate        ?? settings.default_customs_rate,
      default_local_tax_rate: catRule?.local_tax_rate      ?? settings.default_local_tax_rate,
    };

    const result = calculateComorosPrice({
      purchasePrice:    p.price_eur,
      purchaseCurrency: 'EUR',
      supplierShipping: 0,
      weightKg:         0, // pas de poids → warning mais calcul quand même
    }, mergedSettings);

    // Sauvegarder historique
    await sb.from('product_price_history').insert({
      product_id:    p.id,
      old_price_eur: p.price_eur,
      old_price_kmf: p.price_kmf,
      new_price_eur: result.recommendedEur,
      new_price_kmf: result.recommendedKmf,
      recommended_eur: result.recommendedEur,
      source:        'bulk_auto_apply',
      pricing_notes: 'Prix achat = ancien price_eur (' + p.price_eur + '€), marge ' + (result.effMarginRate * 100).toFixed(0) + '%',
    });

    // Upsert product_pricing
    await sb.from('product_pricing').upsert({
      product_id:              p.id,
      purchase_price:          p.price_eur,
      purchase_currency:       'EUR',
      supplier_shipping_price: 0,
      total_landed_cost_eur:   result.totalLandedCost,
      recommended_price_eur:   result.recommendedEur,
      recommended_price_kmf:   result.recommendedKmf,
      final_price_eur:         result.recommendedEur,
      final_price_kmf:         result.recommendedKmf,
      margin_amount_eur:       result.marginAmount,
      margin_rate:             result.marginRate,
      price_status:            'validated',
      competitiveness_status:  result.competitivenessStatus,
      calculation_details:     result,
      calculated_at:           new Date().toISOString(),
      validated_at:            new Date().toISOString(),
      updated_at:              new Date().toISOString(),
    }, { onConflict: 'product_id' });

    // Appliquer le nouveau prix
    const { error } = await sb.from('products').update({
      price_eur:  result.recommendedEur,
      price_kmf:  result.recommendedKmf,
      updated_at: new Date().toISOString(),
    }).eq('id', p.id);

    if (error) {
      console.error('  ERREUR', p.name, error.message);
      errors++;
    } else {
      console.log('  ✓', p.price_eur.toFixed(0) + '€ →', result.recommendedKmf.toLocaleString('fr-FR') + ' KMF', '(marge ' + result.marginPercent + '%)', p.name);
      updated++;
    }
  }

  console.log('\n══════════════════════════════════');
  console.log('✅ Terminé :', updated, 'produits mis à jour,', errors, 'erreurs,', skipped, 'ignorés');
  console.log('Tous les anciens prix sont dans product_price_history (rollback possible)');
}

run().catch(e => { console.error('Erreur fatale:', e.message); process.exit(1); });
