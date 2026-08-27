# Hero Slider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer le bloc `.promo-banner` statique de `index.html` par un hero slider 5 slides (230px, CSS gradient + image produit Higgsfield droite, texte HTML gauche, vanilla JS, AVIF+WebP).

**Architecture:** Layout deux colonnes par slide : texte+CTA à gauche sur fond CSS gradient bleu/violet/noir, image produit Higgsfield à droite (~200px). Vanilla JS inline < 2 KB, aucun CDN. Strip de 5 thumbnails synchronisée en dessous. Slide 1 = nouveau LCP (fetchpriority high).

**Tech Stack:** HTML vanilla · CSS vanilla · JS vanilla inline · Higgsfield MCP (product shots) · Node.js sharp (WebP/AVIF) · Vercel

---

## Fichiers modifiés

| Fichier | Action | Rôle |
|---------|--------|------|
| `index.html` | Modifier lignes 22–23 (inline CSS) + lignes 233–269 (promo-banner) | HTML slider + JS inline + critical CSS |
| `style.css` | Modifier — remplacer `.promo-banner*` par `.hero-slider*` | Styles complets slider |
| `images/hero/` | Créer dossier | 5 JPG raw + 5 WebP + 5 AVIF + 5 thumbs WebP |
| `scripts/optimize-hero.mjs` | Créer | Script sharp : resize + WebP + AVIF |

---

## Task 1 : Dossier images + script d'optimisation

**Files:**
- Create: `images/hero/.gitkeep`
- Create: `scripts/optimize-hero.mjs`

- [ ] **Step 1 : Créer le dossier images/hero**

```powershell
New-Item -ItemType Directory -Force "images\hero"
New-Item -ItemType File -Force "images\hero\.gitkeep"
```

- [ ] **Step 2 : Vérifier que sharp est disponible**

```powershell
node -e "require('sharp'); console.log('sharp OK')"
```

Si erreur → installer :
```powershell
npm install --save-dev sharp
```

- [ ] **Step 3 : Créer scripts/optimize-hero.mjs**

```js
import sharp from 'sharp';
import { readdirSync, existsSync } from 'fs';
import { join, basename, extname } from 'path';

const SRC = 'images/hero/raw';
const OUT = 'images/hero';
const THUMB_W = 200;
const THUMB_H = 68;
const MAIN_W = 600;
const MAIN_H = 230;

if (!existsSync(SRC)) {
  console.error('Dossier images/hero/raw absent — place les images Higgsfield dedans');
  process.exit(1);
}

const files = readdirSync(SRC).filter(f => /\.(jpg|jpeg|png|webp)$/i.test(f));
console.log(`Traitement de ${files.length} image(s)...`);

for (const file of files) {
  const src = join(SRC, file);
  const name = basename(file, extname(file));
  const img = sharp(src);

  // Main WebP 600×230
  await img.clone().resize(MAIN_W, MAIN_H, { fit: 'cover', position: 'center' })
    .webp({ quality: 82 })
    .toFile(join(OUT, `${name}.webp`));

  // Main AVIF 600×230
  await img.clone().resize(MAIN_W, MAIN_H, { fit: 'cover', position: 'center' })
    .avif({ quality: 65 })
    .toFile(join(OUT, `${name}.avif`));

  // JPG fallback 600×230
  await img.clone().resize(MAIN_W, MAIN_H, { fit: 'cover', position: 'center' })
    .jpeg({ quality: 85, mozjpeg: true })
    .toFile(join(OUT, `${name}.jpg`));

  // Thumbnail WebP 200×68
  await img.clone().resize(THUMB_W, THUMB_H, { fit: 'cover', position: 'center' })
    .webp({ quality: 75 })
    .toFile(join(OUT, `${name}-thumb.webp`));

  console.log(`✓ ${name} → WebP + AVIF + JPG + thumb`);
}

console.log('Optimisation terminée.');
```

- [ ] **Step 4 : Vérifier syntaxe**

```powershell
node --check scripts/optimize-hero.mjs
```
Attendu : aucune sortie (pas d'erreur)

- [ ] **Step 5 : Commit**

```bash
git add images/hero/.gitkeep scripts/optimize-hero.mjs package.json package-lock.json
git commit -m "chore(hero): dossier images/hero + script optimisation sharp"
```

---

## Task 2 : Générer les 5 images Higgsfield

**Files:**
- Create: `images/hero/raw/slide-portables.jpg` (et 4 autres)

Utiliser le skill `higgsfield-product-photoshoot` ou `higgsfield-generate` (GPT Image 2) via MCP. Chaque image sera sauvegardée dans `images/hero/raw/`.

- [ ] **Step 1 : Générer slide-portables (PC Portables)**

Invoquer skill `higgsfield-generate` avec ce prompt :
> Professional laptop computer Dell or HP, open on a dark modern desk, blue ambient lighting, dark navy background, 3/4 angle, studio quality photo, ultra sharp, right side of frame focused on product, left side darker for text overlay, photorealistic, tech product photography

Sauvegarder dans `images/hero/raw/slide-portables.jpg`

- [ ] **Step 2 : Générer slide-reconditiones (Reconditionnés Grade A)**

Prompt :
> Row of refurbished desktop computers Dell Optiplex aligned on shelf, clean industrial background, dark tones, soft neutral lighting, professional product shot, right side focus, left darker area, photorealistic tech photography, "Grade A" quality feel

Sauvegarder dans `images/hero/raw/slide-reconditiones.jpg`

- [ ] **Step 3 : Générer slide-composants (Composants)**

Prompt :
> NVMe M.2 SSD and DDR5 RAM stick floating on dark tech background, blue and amber LED lighting, macro product shot, dark background with purple/indigo tones, ultra sharp detail, studio lighting, right side composition

Sauvegarder dans `images/hero/raw/slide-composants.jpg`

- [ ] **Step 4 : Générer slide-reseau (Réseau)**

Prompt :
> Modern WiFi 6 router white on dark desk, digital connection lines glowing blue, dark navy background, professional product photography, right side composition with dark left area, tech aesthetic

Sauvegarder dans `images/hero/raw/slide-reseau.jpg`

- [ ] **Step 5 : Générer slide-services (Services)**

Prompt :
> Professional IT technician repairing laptop computer, tools on desk, dark professional background, blue-purple lighting, focused competent hands, tech service atmosphere, right side composition

Sauvegarder dans `images/hero/raw/slide-services.jpg`

- [ ] **Step 6 : Commit raw images**

```bash
git add images/hero/raw/
git commit -m "feat(hero): images Higgsfield raw 5 slides"
```

---

## Task 3 : Optimiser les images

**Files:**
- Modify: `images/hero/` (20 fichiers générés)

- [ ] **Step 1 : Lancer le script d'optimisation**

```powershell
node scripts/optimize-hero.mjs
```
Attendu :
```
Traitement de 5 image(s)...
✓ slide-portables → WebP + AVIF + JPG + thumb
✓ slide-reconditiones → WebP + AVIF + JPG + thumb
✓ slide-composants → WebP + AVIF + JPG + thumb
✓ slide-reseau → WebP + AVIF + JPG + thumb
✓ slide-services → WebP + AVIF + JPG + thumb
Optimisation terminée.
```

- [ ] **Step 2 : Vérifier les poids**

```powershell
Get-ChildItem images\hero -File | Where-Object { $_.Name -notlike '*thumb*' -and $_.Name -ne '.gitkeep' } | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}} | Sort-Object KB -Descending
```
Attendu : chaque fichier < 80 KB

- [ ] **Step 3 : Commit images optimisées**

```bash
git add images/hero/*.webp images/hero/*.avif images/hero/*.jpg
git commit -m "feat(hero): images optimisées WebP + AVIF + thumbnails"
```

---

## Task 4 : Mettre à jour style.css

**Files:**
- Modify: `style.css`

- [ ] **Step 1 : Supprimer les styles .promo-banner dans style.css**

Rechercher et supprimer le bloc `.promo-banner` (et `.promo-banner__inner`, `.promo-banner__tag`, `.promo-banner__title`, `.promo-banner__sub`, `.promo-banner__cta`) ainsi que leurs variantes `@media`.

- [ ] **Step 2 : Ajouter les styles .hero-slider**

Ajouter après la section `.quick-cats` dans `style.css` :

```css
/* ── HERO SLIDER ─────────────────────────────────────── */
.hero-slider{position:relative;overflow:hidden;background:#0f172a}
.hero-slider__track{display:flex;transition:transform .5s cubic-bezier(.25,.46,.45,.94);will-change:transform}
.hero-slide{min-width:100%;flex-shrink:0}
.hero-slide__inner{max-width:1320px;margin:0 auto;padding:0 28px;height:230px;display:flex;align-items:center;justify-content:space-between;gap:24px;position:relative;z-index:1}
.hero-slide__content{flex:1;min-width:0}
.hero-slide__tag{display:inline-block;background:#f59e0b;color:#fff;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:2px;padding:3px 10px;border-radius:3px;margin-bottom:8px}
.hero-slide__title{font-size:clamp(1.3rem,2.5vw,1.9rem);font-weight:900;line-height:1.08;letter-spacing:-.03em;color:#fff;margin-bottom:7px}
.hero-slide__title em{color:#f59e0b;font-style:normal}
.hero-slide__sub{font-size:12px;color:#93c5fd;margin-bottom:14px;line-height:1.4}
.hero-slide__cta{display:inline-flex;align-items:center;gap:7px;background:#f59e0b;color:#fff;padding:9px 20px;border-radius:5px;font-weight:700;font-size:12px;text-decoration:none;transition:background-color .15s}
.hero-slide__cta:hover{background-color:#d97706}
.hero-slide__img{flex-shrink:0;width:280px;height:190px;border-radius:8px;overflow:hidden;position:relative}
.hero-slide__img img{width:100%;height:100%;object-fit:cover;object-position:center;display:block}

/* Gradient overlay gauche pour lisibilité texte */
.hero-slide--1{background:linear-gradient(105deg,#0f172a 0%,#1a3a8f 55%,#1e40af 100%)}
.hero-slide--2{background:linear-gradient(105deg,#0f172a 0%,#1e3a8a 55%,#1e3a8a 100%)}
.hero-slide--3{background:linear-gradient(105deg,#0f172a 0%,#1e1b4b 55%,#312e81 100%)}
.hero-slide--4{background:linear-gradient(105deg,#0f172a 0%,#312e81 55%,#4c1d95 100%)}
.hero-slide--5{background:linear-gradient(105deg,#111827 0%,#1e40af 55%,#1a3a8f 100%)}

/* Arrows */
.hero-slider__btn{position:absolute;top:50%;transform:translateY(-50%);width:32px;height:64px;background:rgba(255,255,255,.1);backdrop-filter:blur(6px);border:1px solid rgba(255,255,255,.15);border-radius:5px;color:#fff;font-size:18px;cursor:pointer;z-index:10;display:flex;align-items:center;justify-content:center;transition:background-color .15s;padding:0;line-height:1}
.hero-slider__btn:hover{background-color:rgba(255,255,255,.2)}
.hero-slider__btn--prev{left:6px}
.hero-slider__btn--next{right:6px}

/* Dots */
.hero-slider__dots{position:absolute;bottom:10px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:10}
.hero-dot{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.3);cursor:pointer;border:none;padding:0;transition:width .3s,background-color .3s}
.hero-dot--active{width:18px;background:#f59e0b}

/* Progress bar */
.hero-slider__progress{position:absolute;bottom:0;left:0;width:100%;height:3px;background:rgba(255,255,255,.08)}
.hero-slider__progress-bar{height:100%;background:#f59e0b;transition:width .1s linear}

/* Thumbnail strip */
.hero-thumbs{background:#111827;display:flex;gap:5px;padding:6px 16px;border-top:1px solid rgba(255,255,255,.06);overflow-x:auto;scrollbar-width:none}
.hero-thumbs::-webkit-scrollbar{display:none}
.hero-thumb{flex-shrink:0;width:72px;height:40px;border-radius:4px;overflow:hidden;border:2px solid transparent;cursor:pointer;transition:border-color .2s;background:#1f2937}
.hero-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.hero-thumb--active{border-color:#f59e0b}

/* Trust badges strip (sous thumbnails) */
.hero-trust{background:#0f172a;border-bottom:1px solid rgba(255,255,255,.06);padding:7px 20px;display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:center}
.hero-trust__badge{background:rgba(255,255,255,.08);border-radius:5px;padding:4px 10px;font-size:11px;font-weight:700;color:#d1d5db;white-space:nowrap}

@media(max-width:768px){
  .hero-slide__inner{height:170px;padding:0 14px;gap:12px}
  .hero-slide__title{font-size:clamp(1rem,4.5vw,1.25rem)}
  .hero-slide__sub{font-size:11px;margin-bottom:10px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .hero-slide__img{width:130px;height:130px}
  .hero-slide__cta{padding:7px 14px;font-size:11px}
  .hero-slider__btn{width:24px;height:48px;font-size:14px}
  .hero-trust{padding:5px 12px;gap:6px}
  .hero-trust__badge{font-size:10px;padding:3px 7px}
}
@media(max-width:480px){
  .hero-slide__img{display:none}
  .hero-slide__inner{height:170px}
}
```

- [ ] **Step 3 : Vérifier syntaxe CSS — ouvrir dans browser et inspecter**

```powershell
node --check style.css
```
(Note : node --check ne valide pas CSS, vérification visuelle requise)

- [ ] **Step 4 : Commit**

```bash
git add style.css
git commit -m "style(hero): remplace promo-banner par hero-slider dans style.css"
```

---

## Task 5 : Mettre à jour index.html

**Files:**
- Modify: `index.html` (inline `<style>` lignes 22–23 + `.promo-banner` lignes 233–269)

- [ ] **Step 1 : Mettre à jour le CSS critique inline dans `<head>`**

Dans le bloc `<style>` inline (ligne 23 de index.html), remplacer toutes les règles `.promo-banner*` par :

```css
.hero-slider{overflow:hidden;background:#0f172a;position:relative}.hero-slider__track{display:flex;transition:transform .5s cubic-bezier(.25,.46,.45,.94);will-change:transform}.hero-slide{min-width:100%;flex-shrink:0}.hero-slide__inner{max-width:1320px;margin:0 auto;padding:0 28px;height:230px;display:flex;align-items:center;justify-content:space-between;gap:24px;position:relative;z-index:1}.hero-slide__content{flex:1;min-width:0}.hero-slide__title{font-size:clamp(1.3rem,2.5vw,1.9rem);font-weight:900;line-height:1.08;color:#fff;margin-bottom:7px}.hero-slide__cta{display:inline-flex;align-items:center;gap:7px;background:#f59e0b;color:#fff;padding:9px 20px;border-radius:5px;font-weight:700;font-size:12px;text-decoration:none}.hero-slide__img{flex-shrink:0;width:280px;height:190px;border-radius:8px;overflow:hidden}.hero-slide__img img{width:100%;height:100%;object-fit:cover;display:block}.hero-slide--1{background:linear-gradient(105deg,#0f172a 0%,#1a3a8f 55%,#1e40af 100%)}.hero-thumbs{background:#111827;display:flex;gap:5px;padding:6px 16px;overflow-x:auto;scrollbar-width:none}@media(max-width:768px){.hero-slide__inner{height:170px;padding:0 14px}.hero-slide__img{width:130px;height:130px}}@media(max-width:480px){.hero-slide__img{display:none}}
```

- [ ] **Step 2 : Remplacer le bloc .promo-banner (lignes 233–269) par le hero slider**

Remplacer tout le bloc `<!-- ── BANNIÈRE PROMO ── -->` jusqu'à la balise `</div>` fermante de `.promo-banner` (ligne 269) par :

```html
  <!-- ── HERO SLIDER ───────────────────────────────────── -->
  <div class="hero-slider" id="hero-slider">
    <div class="hero-slider__track" id="hero-track">

      <!-- SLIDE 1 — PC Portables · LCP -->
      <div class="hero-slide hero-slide--1">
        <div class="hero-slide__inner">
          <div class="hero-slide__content">
            <div class="hero-slide__tag">NOUVEAUTÉS 2025</div>
            <h1 class="hero-slide__title">Travaillez.<br>Créez. <em>Performez.</em></h1>
            <p class="hero-slide__sub">PC portables Dell, HP, Lenovo — i5 &amp; i7 · dès 299€ · Livraison 24h</p>
            <a href="/ordinateurs.html?tab=portables" class="hero-slide__cta">Voir les portables →</a>
          </div>
          <div class="hero-slide__img">
            <picture>
              <source srcset="/images/hero/slide-portables.avif" type="image/avif">
              <source srcset="/images/hero/slide-portables.webp" type="image/webp">
              <img src="/images/hero/slide-portables.jpg"
                   alt="PC Portables Dell HP dès 299€"
                   width="600" height="230"
                   fetchpriority="high" loading="eager" decoding="auto">
            </picture>
          </div>
        </div>
      </div>

      <!-- SLIDE 2 — Reconditionnés Grade A -->
      <div class="hero-slide hero-slide--2">
        <div class="hero-slide__inner">
          <div class="hero-slide__content">
            <div class="hero-slide__tag" style="background:#1d4ed8">GRADE A CERTIFIÉ</div>
            <h2 class="hero-slide__title">L'excellence<br>à <em style="color:#93c5fd">petit prix.</em></h2>
            <p class="hero-slide__sub">Dell Optiplex · HP ProDesk · Lenovo ThinkCentre — garantis 6 mois · dès 149€</p>
            <a href="/ordinateurs.html?tab=reconditiones" class="hero-slide__cta">Découvrir les reconditionnés →</a>
          </div>
          <div class="hero-slide__img">
            <picture>
              <source srcset="/images/hero/slide-reconditiones.avif" type="image/avif">
              <source srcset="/images/hero/slide-reconditiones.webp" type="image/webp">
              <img src="/images/hero/slide-reconditiones.jpg"
                   alt="PC bureau reconditionnés Grade A dès 149€"
                   width="600" height="230"
                   loading="lazy" decoding="async">
            </picture>
          </div>
        </div>
      </div>

      <!-- SLIDE 3 — Composants & Upgrade -->
      <div class="hero-slide hero-slide--3">
        <div class="hero-slide__inner">
          <div class="hero-slide__content">
            <div class="hero-slide__tag" style="background:#4f46e5">UPGRADE</div>
            <h2 class="hero-slide__title">Plus rapide.<br><em style="color:#a5b4fc">Plus puissant.</em></h2>
            <p class="hero-slide__sub">RAM DDR4/DDR5 · SSD NVMe · CPU Intel &amp; AMD — upgrade guidé · dès 19€</p>
            <a href="/composants.html" class="hero-slide__cta">Explorer les composants →</a>
          </div>
          <div class="hero-slide__img">
            <picture>
              <source srcset="/images/hero/slide-composants.avif" type="image/avif">
              <source srcset="/images/hero/slide-composants.webp" type="image/webp">
              <img src="/images/hero/slide-composants.jpg"
                   alt="Composants PC SSD RAM dès 19€"
                   width="600" height="230"
                   loading="lazy" decoding="async">
            </picture>
          </div>
        </div>
      </div>

      <!-- SLIDE 4 — Réseau & Connectivité -->
      <div class="hero-slide hero-slide--4">
        <div class="hero-slide__inner">
          <div class="hero-slide__content">
            <div class="hero-slide__tag" style="background:#3730a3">WIFI 6 · 4G · 5G</div>
            <h2 class="hero-slide__title">Restez connecté,<br><em style="color:#c4b5fd">partout.</em></h2>
            <p class="hero-slide__sub">Routeurs WiFi 6 · Switches · Points d'accès · Câbles réseau</p>
            <a href="/reseau.html" class="hero-slide__cta">Voir le réseau →</a>
          </div>
          <div class="hero-slide__img">
            <picture>
              <source srcset="/images/hero/slide-reseau.avif" type="image/avif">
              <source srcset="/images/hero/slide-reseau.webp" type="image/webp">
              <img src="/images/hero/slide-reseau.jpg"
                   alt="Routeurs WiFi 6 réseau"
                   width="600" height="230"
                   loading="lazy" decoding="async">
            </picture>
          </div>
        </div>
      </div>

      <!-- SLIDE 5 — Services & Assistance -->
      <div class="hero-slide hero-slide--5">
        <div class="hero-slide__inner">
          <div class="hero-slide__content">
            <div class="hero-slide__tag" style="background:#1d4ed8">EXPERT LOCAL</div>
            <h2 class="hero-slide__title">Votre expert info<br><em style="color:#bfdbfe">aux Comores.</em></h2>
            <p class="hero-slide__sub">Réparation · Installation · Formation · Livraison 24h · +269 477 78 65</p>
            <a href="/services.html" class="hero-slide__cta">Nos services →</a>
          </div>
          <div class="hero-slide__img">
            <picture>
              <source srcset="/images/hero/slide-services.avif" type="image/avif">
              <source srcset="/images/hero/slide-services.webp" type="image/webp">
              <img src="/images/hero/slide-services.jpg"
                   alt="Services informatiques aux Comores"
                   width="600" height="230"
                   loading="lazy" decoding="async">
            </picture>
          </div>
        </div>
      </div>

    </div><!-- /hero-track -->

    <button class="hero-slider__btn hero-slider__btn--prev" id="hero-prev" aria-label="Slide précédent">&#8249;</button>
    <button class="hero-slider__btn hero-slider__btn--next" id="hero-next" aria-label="Slide suivant">&#8250;</button>

    <div class="hero-slider__dots" id="hero-dots" aria-hidden="true">
      <button class="hero-dot hero-dot--active" onclick="heroSlider.goTo(0)" aria-label="Slide 1"></button>
      <button class="hero-dot" onclick="heroSlider.goTo(1)" aria-label="Slide 2"></button>
      <button class="hero-dot" onclick="heroSlider.goTo(2)" aria-label="Slide 3"></button>
      <button class="hero-dot" onclick="heroSlider.goTo(3)" aria-label="Slide 4"></button>
      <button class="hero-dot" onclick="heroSlider.goTo(4)" aria-label="Slide 5"></button>
    </div>

    <div class="hero-slider__progress" aria-hidden="true">
      <div class="hero-slider__progress-bar" id="hero-progress"></div>
    </div>
  </div><!-- /hero-slider -->

  <!-- ── THUMBNAIL STRIP ──────────────────────────────── -->
  <div class="hero-thumbs" id="hero-thumbs" aria-hidden="true">
    <div class="hero-thumb hero-thumb--active" onclick="heroSlider.goTo(0)">
      <img src="/images/hero/slide-portables-thumb.webp" alt="PC Portables" width="72" height="40" loading="lazy" decoding="async">
    </div>
    <div class="hero-thumb" onclick="heroSlider.goTo(1)">
      <img src="/images/hero/slide-reconditiones-thumb.webp" alt="Reconditionnés" width="72" height="40" loading="lazy" decoding="async">
    </div>
    <div class="hero-thumb" onclick="heroSlider.goTo(2)">
      <img src="/images/hero/slide-composants-thumb.webp" alt="Composants" width="72" height="40" loading="lazy" decoding="async">
    </div>
    <div class="hero-thumb" onclick="heroSlider.goTo(3)">
      <img src="/images/hero/slide-reseau-thumb.webp" alt="Réseau" width="72" height="40" loading="lazy" decoding="async">
    </div>
    <div class="hero-thumb" onclick="heroSlider.goTo(4)">
      <img src="/images/hero/slide-services-thumb.webp" alt="Services" width="72" height="40" loading="lazy" decoding="async">
    </div>
  </div>

  <!-- ── TRUST BADGES ──────────────────────────────────── -->
  <div class="hero-trust">
    <span class="hero-trust__badge">💳 Mobile Money</span>
    <span class="hero-trust__badge">🛡️ Garantie 12–24 mois</span>
    <span class="hero-trust__badge">📞 +269 477 78 65</span>
    <span class="hero-trust__badge">🔒 Paiement sécurisé</span>
    <span class="hero-trust__badge">📦 Livraison rapide</span>
    <!-- cro.js détecte #cro-countdown existant → ne réinjecte pas (zéro CLS) -->
    <div id="cro-countdown" style="display:flex;align-items:center;gap:5px;font-size:11px;font-weight:700;color:#fde68a">⏰ <span id="cd-val" style="font-size:12px;color:#fff;font-weight:900;letter-spacing:1px"></span></div>
  </div>
```

- [ ] **Step 3 : Ajouter le JS vanilla inline avant `</body>`**

Ajouter juste avant la balise `</body>` fermante de index.html :

```html
  <script>
  var heroSlider = (function(){
    var track = document.getElementById('hero-track');
    var dots = document.querySelectorAll('.hero-dot');
    var thumbs = document.querySelectorAll('.hero-thumb');
    var progress = document.getElementById('hero-progress');
    var prev = document.getElementById('hero-prev');
    var next = document.getElementById('hero-next');
    var wrapper = document.getElementById('hero-slider');
    var TOTAL = 5, DELAY = 4000, current = 0;
    var timer = null, ptimer = null, pstart = 0;

    function goTo(n) {
      current = ((n % TOTAL) + TOTAL) % TOTAL;
      if (track) track.style.transform = 'translateX(-' + (current * 100) + '%)';
      dots.forEach(function(d,i){ d.classList.toggle('hero-dot--active', i === current); });
      thumbs.forEach(function(t,i){ t.classList.toggle('hero-thumb--active', i === current); });
      resetProgress();
    }

    function resetProgress() {
      clearInterval(ptimer); clearTimeout(timer);
      if (progress) progress.style.width = '0%';
      pstart = Date.now();
      ptimer = setInterval(function(){
        var p = Math.min(100, ((Date.now() - pstart) / DELAY) * 100);
        if (progress) progress.style.width = p + '%';
      }, 50);
      timer = setTimeout(function(){ goTo(current + 1); }, DELAY);
    }

    if (prev) prev.addEventListener('click', function(){ goTo(current - 1); });
    if (next) next.addEventListener('click', function(){ goTo(current + 1); });

    var tx = 0;
    if (track) {
      track.addEventListener('touchstart', function(e){ tx = e.touches[0].clientX; }, {passive:true});
      track.addEventListener('touchend', function(e){
        var dx = tx - e.changedTouches[0].clientX;
        if (Math.abs(dx) > 40) goTo(current + (dx > 0 ? 1 : -1));
      }, {passive:true});
    }
    if (wrapper) {
      wrapper.addEventListener('mouseenter', function(){ clearInterval(ptimer); clearTimeout(timer); });
      wrapper.addEventListener('mouseleave', resetProgress);
    }

    resetProgress();
    return { goTo: goTo };
  })();
  </script>
```

- [ ] **Step 4 : Vérifier syntaxe JS**

```powershell
node -e "
const fs = require('fs');
const html = fs.readFileSync('index.html','utf8');
const m = html.match(/<script>\s*var heroSlider[\s\S]*?<\/script>/);
if (!m) { console.error('Script heroSlider non trouvé'); process.exit(1); }
require('vm').Script(m[0].replace(/<\/?script>/g,''));
console.log('JS OK');
"
```
Attendu : `JS OK`

- [ ] **Step 5 : Commit**

```bash
git add index.html
git commit -m "feat(hero): hero slider 5 slides remplace promo-banner"
```

---

## Task 6 : Vérification finale

**Files:** Aucun

- [ ] **Step 1 : Vérifier syntaxe index.html**

```powershell
node -e "
const html = require('fs').readFileSync('index.html','utf8');
const checks = [
  ['hero-slider', html.includes('id=\"hero-slider\"')],
  ['hero-track', html.includes('id=\"hero-track\"')],
  ['5 slides', (html.match(/hero-slide hero-slide--/g)||[]).length === 5],
  ['LCP fetchpriority', html.includes('fetchpriority=\"high\"')],
  ['lazy slides', (html.match(/loading=\"lazy\"/g)||[]).length >= 8],
  ['thumbs', (html.match(/hero-thumb/g)||[]).length >= 5],
  ['trust badges', html.includes('hero-trust')],
  ['JS heroSlider', html.includes('var heroSlider')],
];
checks.forEach(([k,v]) => console.log((v?'✓':'✗') + ' ' + k));
const fail = checks.filter(([,v]) => !v);
if (fail.length) process.exit(1);
"
```
Attendu : tous `✓`

- [ ] **Step 2 : Vérifier poids images**

```powershell
Get-ChildItem images\hero -Recurse -File | Where-Object { $_.Extension -ne '' } | Select-Object Name, @{N='KB';E={[math]::Round($_.Length/1KB,1)}} | Sort-Object KB -Descending | Format-Table
```
Attendu : aucun fichier > 100 KB

- [ ] **Step 3 : Vérifier que .promo-banner a disparu**

```powershell
node -e "
const html = require('fs').readFileSync('index.html','utf8');
const css = require('fs').readFileSync('style.css','utf8');
const hOK = !html.includes('promo-banner');
const cOK = !css.includes('promo-banner');
console.log((hOK?'✓':'✗') + ' index.html sans promo-banner');
console.log((cOK?'✓':'✗') + ' style.css sans promo-banner');
if (!hOK || !cOK) process.exit(1);
"
```

- [ ] **Step 4 : Vérifier JS ne casse pas la page**

```powershell
node --check index.html
```
(Note : vérification JS manuelle dans le browser — ouvrir DevTools > Console, aucune erreur attendue)

- [ ] **Step 5 : Commit final**

```bash
git add -A
git commit -m "feat(hero): hero slider complet — vérifications OK"
```
