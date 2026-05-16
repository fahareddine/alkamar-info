# Runbook d'Incident — Boutique Info Experts

**Site :** https://boutique.info-experts.fr  
**Mise à jour :** 2026-05-16  
**Responsable :** Info Experts (defistylez@gmail.com)

---

## Objectifs RTO / RPO

| Métrique | Définition | Cible |
|---------|-----------|-------|
| **RTO** (Recovery Time Objective) | Temps max pour restaurer le service | **< 2 heures** |
| **RPO** (Recovery Point Objective) | Perte de données max acceptable | **< 24 heures** (backup quotidien) |

---

## Contacts d'urgence

| Rôle | Action |
|------|--------|
| Compte GitHub | github.com/fahareddine |
| Compte Vercel | vercel.com (email admin) |
| Compte Supabase | supabase.com (email admin) |
| Compte Stripe | dashboard.stripe.com |
| Compte B2 | backblaze.com |

---

## Scénario 1 — Site Vercel cassé

**Symptômes :** 500, 404, page blanche, JS cassé  
**RTE estimé :** 15 minutes

```bash
# 1. Vérifier les logs Vercel
#    → vercel.com > Project > Deployments > Logs

# 2. Rollback immédiat via Vercel Dashboard
#    → Deployments > trouver le dernier déploiement fonctionnel
#    → "..." > "Promote to Production"

# 3. Ou rollback Git
git log --oneline -10
git revert HEAD --no-edit
git push origin main
```

**Checklist post-rollback :**
- [ ] Page d'accueil charge
- [ ] Produits visibles
- [ ] Panier fonctionnel
- [ ] Checkout Stripe fonctionne
- [ ] Admin panel accessible

---

## Scénario 2 — Suppression accidentelle du repo Git

**RTE estimé :** 30 minutes  
**Prérequis :** backup GitHub Releases OU clone local

```bash
# 1. Recréer le repo sur GitHub
#    → github.com > New repository > fahareddine/alkamar-info

# 2. Depuis le clone local
git remote set-url origin https://github.com/fahareddine/alkamar-info.git
git push origin main --force

# 3. Reconnecter Vercel au nouveau repo
#    → Vercel Dashboard > Settings > Git > Disconnect + Reconnect
```

---

## Scénario 3 — Suppression données Supabase

**RTE estimé :** 2-4 heures  
**Source :** pg_dump GPG dans GitHub Releases / B2 / Google Drive

```bash
# 1. Lister les backups disponibles
./backup-system/scripts/restore.sh --list --from b2

# 2. Restaurer dans un environnement de staging (JAMAIS directement en prod)
./backup-system/scripts/restore.sh --from b2 --snapshot <TIMESTAMP>

# 3. Vérifier l'intégrité des données restaurées
# 4. Avec validation : migrer vers production

# Commande restauration manuelle DB
export PGPASSWORD="$(echo $GPG_PASSPHRASE | gpg --batch --passphrase-fd 0 -d backup.sql.gpg)"
psql $SUPABASE_DB_URL < backup.sql
```

---

## Scénario 4 — Erreur de migration SQL

**RTE estimé :** 1-2 heures

```bash
# 1. Identifier la migration fautive
ls supabase/migrations/

# 2. Annuler via snapshot pre-deploy (créé automatiquement avant chaque déploiement)
#    → Chercher le snapshot timestampé AVANT le déploiement cassé

# 3. Rollback SQL manuel
#    Écrire une migration de rollback et l'appliquer :
# supabase/migrations/XXX_rollback_<desc>.sql

# 4. Ou restaurer la DB depuis backup pre-deploy
./backup-system/scripts/restore.sh --list
```

---

## Scénario 5 — Clé API compromise

**RTE estimé :** 30 minutes  
**PRIORITÉ : Agir dans les 5 minutes**

### Supabase anon key compromise
```
1. Supabase Dashboard > Settings > API > Rotate anon key
2. Mettre à jour admin/js/config.js avec la nouvelle clé
3. Mettre à jour Vercel env vars : SUPABASE_ANON_KEY
4. Redéployer
```

### Supabase service_role key compromise
```
1. URGENCE — Accès DB admin complet compromis
2. Supabase Dashboard > Settings > API > Rotate service_role key
3. Mettre à jour Vercel : SUPABASE_SERVICE_ROLE_KEY
4. GitHub Secrets : SUPABASE_SERVICE_ROLE_KEY
5. Auditer les logs d'accès Supabase
6. Redéployer immédiatement
```

### Stripe secret key compromise
```
1. URGENCE — Stripe Dashboard > Developers > API keys > Roll key
2. Vercel : STRIPE_SECRET_KEY → nouvelle valeur
3. Vérifier les logs Stripe pour transactions non autorisées
4. Alerter Stripe si fraude détectée : support.stripe.com
```

### GitHub token compromise
```
1. GitHub > Settings > Developer settings > Personal access tokens > Revoke
2. Générer un nouveau token
3. GitHub Secrets > BACKUP_GH_TOKEN → nouvelle valeur
```

### Backblaze B2 key compromise
```
1. Backblaze Dashboard > App Keys > Delete compromised key
2. Créer une nouvelle App Key avec les mêmes permissions
3. GitHub Secrets : RCLONE_B2_ACCOUNT + RCLONE_B2_KEY → nouvelles valeurs
4. Auditer les logs B2 pour accès non autorisés
```

---

## Scénario 6 — Compte admin compromis

**RTE estimé :** 1 heure

```
1. Supabase Dashboard > Authentication > Users > Trouver l'utilisateur
2. Bannir / désactiver le compte compromis
3. Réinitialiser le mot de passe depuis un appareil sécurisé
4. Vérifier les logs admin (table admin_logs en DB)
5. Auditer les modifications récentes
6. Activer 2FA si pas encore fait :
   → Supabase Dashboard > Settings > Security > 2FA
```

---

## Scénario 7 — Backup corrompu

**RTE estimé :** 4-8 heures (utiliser backup précédent)

```bash
# 1. Tester intégrité du backup
./backup-system/scripts/restore-dryrun.sh

# 2. Si corrompu, utiliser le backup précédent
./backup-system/scripts/restore.sh --list --from b2
# Choisir le timestamp d'avant la corruption

# 3. Vérification hebdomadaire automatique via :
#    .github/workflows/backup-verify-weekly.yml
```

---

## Rotation des secrets — Procédure complète

**À faire lors de toute suspicion de compromission ou tous les 6 mois :**

```
[ ] Supabase anon key
[ ] Supabase service_role key
[ ] Supabase DB URL (si mot de passe changé)
[ ] Stripe secret key (publishable key aussi si besoin)
[ ] GitHub personal access token (BACKUP_GH_TOKEN)
[ ] Backblaze B2 app key (RCLONE_B2_ACCOUNT + RCLONE_B2_KEY)
[ ] Google Drive OAuth token (RCLONE_GDRIVE_TOKEN)
[ ] GPG passphrase backups (GPG_PASSPHRASE)
[ ] LHCI_GITHUB_APP_TOKEN
[ ] PAGESPEED_API_KEY
```

**Après rotation :**
1. Mettre à jour tous les secrets dans Vercel Dashboard
2. Mettre à jour tous les secrets dans GitHub Actions Secrets
3. Lancer un backup manual pour tester les nouvelles credentials
4. Vérifier que le site fonctionne (Playwright)

---

## Commandes de vérification post-incident

```bash
# 1. Site accessible
curl -I https://boutique.info-experts.fr

# 2. API fonctionnelle
curl https://boutique.info-experts.fr/api/products?status=active&limit=1

# 3. Tests Playwright
npx playwright test tests/playwright/security-smoke.spec.js

# 4. Headers sécurité présents
curl -I https://boutique.info-experts.fr | grep -E "Content-Security|X-Content|Strict-Transport"

# 5. Admin protégé
curl -I https://boutique.info-experts.fr/admin/dashboard.html
# Doit retourner 302 → /admin/login.html

# 6. .env non accessible
curl https://boutique.info-experts.fr/.env.local
# Doit retourner 404
```

---

## Ce qu'il ne faut JAMAIS faire

- ❌ Restaurer directement en production sans test staging
- ❌ Supprimer des backups avant d'avoir le suivant
- ❌ Committer `.env.local` ou tout fichier de secrets
- ❌ Partager les secrets via Slack/email/chat
- ❌ Utiliser `--force` sur git push main sans sauvegarde
- ❌ Modifier les migrations Supabase sans snapshot pre-deploy
- ❌ Désactiver RLS Supabase "temporairement"
- ❌ Utiliser la clé service_role côté client

---

## Actions manuelles requises (ne peuvent pas être automatisées)

| Action | Fréquence | Accès requis |
|--------|-----------|-------------|
| Activer 2FA compte Supabase | Une fois | Dashboard Supabase |
| Activer 2FA compte GitHub | Une fois | GitHub Settings |
| Activer 2FA compte Vercel | Une fois | Vercel Settings |
| Tester restauration B2 complète | Mensuel | rclone + credentials |
| Rotation secrets | 6 mois | Tous les dashboards |
| Audit RLS dashboard Supabase | Trimestriel | Supabase Dashboard |
| Vérifier les logs accès Supabase | Mensuel | Supabase Dashboard |
