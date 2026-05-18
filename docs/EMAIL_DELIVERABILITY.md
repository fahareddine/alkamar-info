# Délivrabilité Email — Boutique Info Experts

## Objectif

Assurer que les emails transactionnels arrivent en boîte de réception et non en spam.

---

## Résumé des actions requises

| Action | Priorité | Statut |
|--------|----------|--------|
| Créer un compte Resend | 🔴 Critique | À faire |
| Vérifier domaine `boutique.info-experts.fr` dans Resend | 🔴 Critique | À faire |
| Ajouter RESEND_API_KEY dans Vercel | 🔴 Critique | À faire |
| Configurer SPF dans IONOS | 🔴 Critique | À faire |
| Configurer DKIM dans IONOS | 🔴 Critique | À faire |
| Configurer DMARC dans IONOS | 🟡 Important | À faire |
| Passer `EMAIL_TEST_MODE=false` en production | 🔴 Critique | À faire |

---

## 1. Créer un compte Resend

1. Aller sur https://resend.com
2. Créer un compte avec `contact@info-experts.fr`
3. Aller dans **API Keys** → créer une clé avec permission `Sending access`
4. Copier la clé (`re_xxxxxxxxxxxxxxxxxxxx`)
5. L'ajouter comme variable d'environnement Vercel : `RESEND_API_KEY`

**Plan gratuit Resend :** 3 000 emails/mois, 1 domaine — suffisant pour démarrer.

---

## 2. Vérifier le domaine dans Resend

Resend exige que le domaine d'envoi soit **vérifié** via des enregistrements DNS.

### Domaine recommandé : `boutique.info-experts.fr`

Dans Resend Dashboard → **Domains** → **Add Domain** → entrer `boutique.info-experts.fr`

Resend fournira des enregistrements DNS à ajouter. Exemple type :

---

## 3. Configuration DNS dans IONOS

Connectez-vous à votre espace IONOS (hébergeur de `info-experts.fr`).  
Panel : https://my.ionos.fr → Domains & SSL → DNS

### A. SPF (Sender Policy Framework)

Empêche l'usurpation de votre domaine.

**Type :** TXT  
**Nom / Hôte :** `boutique` (pour `boutique.info-experts.fr`)  
**Valeur :**
```
v=spf1 include:amazonses.com ~all
```

> Resend utilise Amazon SES en backend. Vérifiez les instructions exactes dans votre dashboard Resend car la valeur peut changer.

**Si un SPF existe déjà sur `info-experts.fr` :**  
Ajouter `include:amazonses.com` au SPF existant — il ne peut y avoir qu'un seul enregistrement SPF par domaine/sous-domaine.

---

### B. DKIM (DomainKeys Identified Mail)

Signe cryptographiquement chaque email pour prouver qu'il vient bien de votre domaine.

Resend fournira automatiquement les enregistrements DKIM à ajouter.  
Exemple type (Resend génère les valeurs réelles) :

**Type :** CNAME  
**Nom :** `resend._domainkey.boutique`  
**Valeur :** `resend._domainkey.boutique.info-experts.fr.dkim.resend.dev.`

> ⚠️ Copiez les valeurs **exactes** depuis le dashboard Resend → Domains → votre domaine.

---

### C. DMARC (Domain-based Message Authentication)

Indique aux serveurs email quoi faire si SPF/DKIM échouent.

**Type :** TXT  
**Nom / Hôte :** `_dmarc.boutique`  
**Valeur :**
```
v=DMARC1; p=none; rua=mailto:contact@info-experts.fr
```

**Progression recommandée :**
1. Commencer avec `p=none` (surveillance uniquement, aucun email bloqué)
2. Après 2–4 semaines sans problème → passer à `p=quarantine`
3. Puis `p=reject` (protection maximale)

---

### D. MX (optionnel pour sous-domaine)

Non requis si vous envoyez uniquement via Resend et ne recevez pas sur `boutique.info-experts.fr`.

---

## 4. Vérifier la configuration dans Resend

Dans Resend Dashboard → **Domains** → votre domaine → tous les enregistrements doivent être **verts**.

Temps de propagation DNS : **5 minutes à 48 heures** (généralement 1–2h avec IONOS).

---

## 5. Variables Vercel à configurer

```bash
vercel env add RESEND_API_KEY production
vercel env add EMAIL_FROM production
vercel env add EMAIL_REPLY_TO production
vercel env add EMAIL_ADMIN_TO production
vercel env add EMAIL_TEST_MODE production
# Pour production, EMAIL_TEST_MODE=false et EMAIL_TEST_RECIPIENT non requis
```

Valeurs recommandées pour production :
```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=Info Experts <noreply@boutique.info-experts.fr>
EMAIL_REPLY_TO=contact@info-experts.fr
EMAIL_ADMIN_TO=contact@info-experts.fr
EMAIL_TEST_MODE=false
```

---

## 6. Bonnes pratiques délivrabilité déjà en place

| Pratique | Statut |
|----------|--------|
| Domaine expéditeur cohérent (`boutique.info-experts.fr`) | ✅ Configuré |
| Reply-To correct (`contact@info-experts.fr`) | ✅ Configuré |
| Honeypot anti-spam dans formulaire | ✅ En place |
| Rate limiting (`/api/contact` : 3/heure) | ✅ En place |
| Version texte brut en plus du HTML | ✅ En place |
| Coordonnées complètes dans le footer | ✅ En place |
| Lien désabonnement (non requis pour transactionnels) | — |
| Pas d'images seules (texte toujours présent) | ✅ En place |
| Alt text sur images | ✅ N/A (pas d'images, design CSS) |
| Tables HTML compatibles Outlook | ✅ En place |
| Préheader optimisé | ✅ En place |
| Pas de mots spammy dans le sujet | ✅ Vérifié |

---

## 7. Checklist avant production

```
[ ] Compte Resend créé avec email admin
[ ] Clé API Resend créée et copiée
[ ] Domaine boutique.info-experts.fr ajouté dans Resend
[ ] Enregistrements DNS SPF/DKIM ajoutés dans IONOS
[ ] DNS propagé et domaine vérifié (vert dans Resend)
[ ] RESEND_API_KEY ajouté dans Vercel (env production)
[ ] EMAIL_TEST_MODE=false dans Vercel (env production)
[ ] Test d'envoi manuel réussi (curl ou formulaire)
[ ] Email reçu dans Gmail sans spam
[ ] Email reçu dans Outlook sans spam
[ ] DMARC configuré (p=none en premier)
```

---

## 8. Tester la délivrabilité

### Test rapide via formulaire

1. Soumettre le formulaire contact sur https://boutique.info-experts.fr
2. Vérifier la boîte de réception (et spam)
3. Vérifier les logs dans Resend Dashboard → **Emails**

### Test de réputation email

- https://mail-tester.com — envoyer un email de test, score sur 10
- https://mxtoolbox.com/deliverability — vérifier SPF/DKIM/DMARC
- https://dmarcian.com — vérifier DMARC

### Objectif

- Score mail-tester.com : **9+/10**
- Pas de spam Gmail/Outlook
- SPF/DKIM/DMARC tous valides

---

## 9. FAQ Délivrabilité

**Q: Puis-je utiliser `contact@info-experts.fr` comme FROM ?**  
R: Oui, mais vous devrez vérifier `info-experts.fr` dans Resend (en plus de `boutique.info-experts.fr`). Plus simple : utiliser `noreply@boutique.info-experts.fr` et `Reply-To: contact@info-experts.fr`.

**Q: Resend free plan est-il suffisant ?**  
R: Oui pour démarrer. 3 000 emails/mois, 1 domaine. Upgrade si vous dépassez.

**Q: Que faire si les emails arrivent en spam ?**  
R: 1) Vérifier SPF/DKIM dans Resend Dashboard. 2) Demander aux destinataires de marquer comme "non spam". 3) Vérifier le score mail-tester.com. 4) S'assurer que le domaine d'envoi correspond au Reply-To.

**Q: Faut-il un webhook Stripe pour les emails de paiement ?**  
R: Oui, pour envoyer une confirmation après paiement Stripe réellement confirmé. Actuellement, l'email est envoyé dès la création de la session Stripe (avant paiement). Un webhook `payment_intent.succeeded` permettrait d'envoyer un email de "paiement confirmé" plus précis.
