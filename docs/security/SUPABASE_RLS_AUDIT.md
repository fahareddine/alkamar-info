# Audit RLS Supabase — Boutique Info Experts

**Date :** 2026-05-16  
**Source :** Inspection migrations SQL locales (002_rls_policies.sql, 006_logs_rls.sql)  
**Note :** La vérification dashboard Supabase est manuelle — voir section "Vérifications manuelles"

---

## État RLS par table (basé sur migrations)

| Table | RLS activé | SELECT public | INSERT | UPDATE | DELETE | Statut |
|-------|-----------|---------------|--------|--------|--------|--------|
| categories | ✅ | ✅ public_read | service_role | service_role | service_role | ✅ |
| products | ✅ | ✅ (status=active) | service_role | service_role | service_role | ✅ |
| customers | ✅ | ❓ | service_role | service_role | service_role | ⚠️ |
| orders | ✅ | ❓ | service_role | service_role | service_role | ⚠️ |
| order_items | ✅ | ❓ | service_role | service_role | service_role | ⚠️ |
| user_profiles | ✅ | self only | service_role | service_role | service_role | ✅ |
| product_images | ✅ | ✅ public | service_role | service_role | service_role | ✅ |
| promotions | ✅ | ✅ (is_active=true) | service_role | service_role | service_role | ✅ |
| coupon_codes | ✅ | ❌ service_role only | service_role | service_role | service_role | ✅ |
| stock_movements | ✅ | ❌ service_role only | service_role | service_role | service_role | ✅ |
| invoices | ✅ | ❌ service_role only | service_role | service_role | service_role | ✅ |
| admin_logs | ✅ | ❌ service_role only | service_role | — | — | ✅ |

**❓** = Policy SELECT non définie dans les migrations locales — à vérifier dans dashboard

---

## Risques identifiés

### Risque 1 — customers : pas de policy SELECT définie (MEDIUM)
La migration 002 active RLS sur `customers` mais ne définit pas de policy SELECT.
En Supabase, sans policy, accès = REFUSÉ par défaut (bonne pratique).
Mais si une policy "permissive" a été ajoutée manuellement dans le dashboard, le risque existe.

**Vérification requise :**
```sql
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename = 'customers'
ORDER BY cmd;
```

### Risque 2 — orders/order_items : même situation (MEDIUM)
Même analyse que customers. À vérifier.

```sql
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE tablename IN ('orders', 'order_items')
ORDER BY tablename, cmd;
```

---

## Requêtes SQL de vérification complète

**Exécuter dans Supabase Dashboard > SQL Editor :**

```sql
-- 1. Lister toutes les policies RLS par table
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual AS condition_select,
  with_check AS condition_write
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, cmd;

-- 2. Vérifier quelles tables ont RLS activé
SELECT
  relname AS table_name,
  relrowsecurity AS rls_enabled,
  relforcerowsecurity AS rls_forced
FROM pg_class
WHERE relkind = 'r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
ORDER BY relname;

-- 3. Détecter les policies trop permissives (true = accès public)
SELECT tablename, policyname, cmd, qual
FROM pg_policies
WHERE qual = 'true' AND cmd IN ('INSERT', 'UPDATE', 'DELETE')
ORDER BY tablename;

-- 4. Vérifier les buckets Storage
SELECT * FROM storage.buckets;

-- 5. Policies Storage
SELECT * FROM storage.policies;

-- 6. Logs d'accès suspects (dernières 24h)
SELECT *
FROM admin_logs
WHERE created_at > now() - interval '24 hours'
ORDER BY created_at DESC
LIMIT 50;
```

---

## Vérifications manuelles requises

| Vérification | Accès | Commande |
|-------------|-------|---------|
| RLS customers SELECT | Dashboard Supabase > SQL Editor | Requête ci-dessus |
| RLS orders SELECT | Dashboard Supabase > SQL Editor | Requête ci-dessus |
| Buckets Storage | Dashboard > Storage > Buckets | Vérifier "Public" désactivé |
| 2FA admin Supabase | Settings > Authentication | Activer si absent |
| Logs accès | Supabase > Logs | Vérifier accès suspects |

---

## Actions recommandées

```sql
-- Si customers n'a pas de policy SELECT restrictive, ajouter :
CREATE POLICY "customers_own_data" ON customers
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (auth.role() = 'authenticated' AND user_id = auth.uid())
  );

-- Si orders n'a pas de policy SELECT restrictive :
CREATE POLICY "orders_own_data" ON orders
  FOR SELECT USING (
    auth.role() = 'service_role'
    OR (
      auth.role() = 'authenticated'
      AND customer_id IN (
        SELECT id FROM customers WHERE user_id = auth.uid()
      )
    )
  );
```

---

## Note sur l'architecture backend

Toutes les opérations backend (API Vercel) utilisent `SUPABASE_SERVICE_ROLE_KEY`
qui bypass RLS par design. Les policies RLS protègent uniquement l'accès direct
via la clé anon (client-side). Cette architecture est correcte si :
- La clé service_role n'est jamais exposée côté client ✅
- Les APIs backend valident toujours les permissions avant d'agir ✅
