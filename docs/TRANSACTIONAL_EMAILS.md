# Emails Transactionnels — Boutique Info Experts

## Vue d'ensemble

Système basé sur **Resend** (https://resend.com).  
Fichier central : `api/_lib/email.js`

---

## Événements couverts

| Événement | Destinataire | Template | Endpoint déclencheur |
|-----------|-------------|----------|----------------------|
| Formulaire de contact | Client + Admin | Contact confirmation | `POST /api/contact` |
| Commande créée (Mobile Money / Cash) | Client + Admin | Order confirmation | `POST /api/orders?action=guest_checkout` |
| Commande créée (Stripe) | Client + Admin | Order confirmation | `POST /api/orders?action=guest_checkout` |

---

## Variables d'environnement requises

```env
# Clé API Resend — https://resend.com → API Keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx

# Adresse expéditeur (domaine doit être vérifié dans Resend)
EMAIL_FROM=Info Experts <noreply@boutique.info-experts.fr>

# Adresse de réponse
EMAIL_REPLY_TO=contact@info-experts.fr

# Destinataire des notifications admin
EMAIL_ADMIN_TO=contact@info-experts.fr

# Mode test — redirige TOUS les emails vers EMAIL_TEST_RECIPIENT
EMAIL_TEST_MODE=true           # passer à false en production
EMAIL_TEST_RECIPIENT=defistylez@gmail.com
```

### Ajouter dans Vercel

```bash
vercel env add RESEND_API_KEY
vercel env add EMAIL_FROM
vercel env add EMAIL_REPLY_TO
vercel env add EMAIL_ADMIN_TO
vercel env add EMAIL_TEST_MODE
vercel env add EMAIL_TEST_RECIPIENT
```

---

## Architecture

```
api/
├── contact.js          ← endpoint formulaire de contact
├── orders.js           ← guest_checkout déclenche les emails
└── _lib/
    └── email.js        ← service central (toutes les fonctions)

supabase/migrations/
└── 014_email_system.sql  ← tables contacts + email_logs
```

### Fonctions exportées par `api/_lib/email.js`

| Fonction | Description |
|----------|-------------|
| `sendEmail({ to, subject, html, text })` | Envoi de base via Resend |
| `sendContactConfirmation({ name, email, message, subject?, phone? })` | Confirmation client après contact |
| `sendContactAdminNotification({ name, email, message, ... })` | Notification admin après contact |
| `sendOrderConfirmation({ order, items })` | Confirmation client après commande |
| `sendOrderAdminNotification({ order, items })` | Notification admin après commande |
| `logEmail({ eventType, recipientEmail, ... })` | Log Supabase (non bloquant) |
| `isValidEmail(email)` | Validation email |

---

## Formulaire de contact (hero slide)

**Avant** : soumission vers `https://formspree.io/f/xbdazagj` (externe, pas de confirmation client)  
**Après** : soumission vers `POST /api/contact` (JSON, confirmation client + admin)

Champs acceptés :
- `nom` / `name` — requis, 2–200 chars
- `email` — requis, format valide
- `message` — requis, 10–4000 chars
- `phone` / `telephone` — optionnel
- `subject` / `sujet` — optionnel
- `source` — automatique (ex: `hero-contact-slide`)
- `_honey` / `website` — honeypot anti-spam

Rate limiting : **3 messages par heure par IP** (middleware.js)

---

## Commandes (guest_checkout)

Les emails sont envoyés en **fire-and-forget** (Promise.all non bloquant) après la création de la commande, pour ne pas bloquer la réponse API.

```javascript
// Dans api/orders.js (après insertion order_items)
Promise.all([
  sendOrderConfirmation({ order, items: validItems }),
  sendOrderAdminNotification({ order, items: validItems }),
]);
```

L'email de confirmation commande est envoyé **uniquement si `customer_email` est valide**.  
Si l'email échoue, la commande est quand même créée.

---

## Table Supabase `contacts`

Stocke les soumissions du formulaire de contact.

```sql
contacts(id, name, email, phone, subject, message, source, status, created_at)
```

Statuts : `new` | `read` | `replied` | `archived`

---

## Table Supabase `email_logs`

Log de chaque email envoyé.

```sql
email_logs(id, event_type, recipient_email, subject, status, provider_message_id,
           related_order_id, related_contact_id, error_message, created_at)
```

Statuts : `sent` | `failed` | `skipped` | `bounced`

**Appliquer la migration :**
```bash
# Via dashboard Supabase : SQL Editor → copier/coller 014_email_system.sql
# Ou via CLI :
supabase db push
```

---

## Mode test

Quand `EMAIL_TEST_MODE=true` :
- Tous les emails sont redirigés vers `EMAIL_TEST_RECIPIENT`
- Le sujet est préfixé `[TEST]`
- Aucun vrai client n'est contacté

Quand `RESEND_API_KEY` est absent ou `re_VOTRE_CLE_RESEND_ICI` :
- Les emails sont loggués en console uniquement (`[email] RESEND_API_KEY non configurée — email ignoré`)
- Aucune erreur levée

---

## Tester les emails

### 1. Tester le formulaire contact (local)

```bash
# Démarrer le serveur local (ou Vercel dev)
npx vercel dev

# Soumettre via curl
curl -X POST http://localhost:3000/api/contact \
  -H "Content-Type: application/json" \
  -d '{"nom":"Test","email":"ton@email.com","message":"Test message de contact Playwright."}'
```

### 2. Tester avec Playwright

```bash
npx playwright test tests/playwright/email-confirmations.spec.js

# Tests sur le site live (avec API réelle) :
API_BASE_URL=https://boutique.info-experts.fr npx playwright test tests/playwright/email-confirmations.spec.js
```

### 3. Vérifier les logs Supabase

Dans le dashboard Supabase :
```sql
SELECT * FROM email_logs ORDER BY created_at DESC LIMIT 20;
SELECT * FROM contacts ORDER BY created_at DESC LIMIT 20;
```

---

## Preview des templates email

Ouvrir dans un navigateur :
- `email-contact-preview.html` — template confirmation contact
- `email-order-preview.html` — template confirmation commande

---

## Troubleshooting

| Problème | Solution |
|----------|----------|
| Email non envoyé | Vérifier `RESEND_API_KEY` dans les env vars |
| Email bloqué en spam | Configurer SPF/DKIM/DMARC → voir `EMAIL_DELIVERABILITY.md` |
| Domaine non vérifié | Vérifier le domaine dans Resend Dashboard |
| `email_logs` table manquante | Appliquer migration `014_email_system.sql` |
| `contacts` table manquante | Appliquer migration `014_email_system.sql` |
| Email envoyé au lieu d'être loggué | Vérifier `EMAIL_TEST_MODE=true` en dev |

---

## Limites et améliorations futures

- [ ] Webhook Stripe → envoyer confirmation après paiement réel confirmé
- [ ] Admin : interface pour renvoyer un email de confirmation
- [ ] Admin : vue de `email_logs` dans le panel
- [ ] Webhook Resend pour détecter les bounces
- [ ] Email de changement de statut commande
- [ ] Email de relance panier abandonné
