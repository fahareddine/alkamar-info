# Hero Slider — Spec Design
_Date : 2026-05-15 · Statut : Validé_

## Contexte

Remplacement du bloc `.promo-banner` statique (gradient + titre + CTA) par un hero slider full-width inspiré de cybertek.fr, adapté à la boutique informatique Info Experts (Comores).

## Référence analysée : cybertek.fr

- Swiper.js v11, `loop:true`, autoplay 3 000 ms, `speed:400`
- 6 slides : chacune = image full-width 1920×350 wrappée dans `<a>`
- Thumbnail strip synchronisée en dessous (6 miniatures 150×100)
- Pas de texte HTML overlay — texte baked dans l'image
- CSS : `slide-link img { width:100%; object-fit:contain }`

## Approche retenue : B

Banners 1920×400px générées par Higgsfield + Vanilla JS slider (pas de CDN Swiper).

**Pourquoi vanilla JS à la place de Swiper CDN :**
- Swiper CDN = +35 KB JS bloquant = risque TBT + score PageSpeed
- Slider simple (5 slides, loop, autoplay) ne justifie pas une lib externe
- Vanilla JS < 2 KB inline

## Structure HTML cible

```
<!-- Remplace .promo-banner dans index.html -->
<div class="hero-slider" id="hero-slider">
  <div class="hero-slider__track" id="hero-track">
    <div class="hero-slide">
      <a href="/ordinateurs.html">
        <picture>
          <source srcset="/images/hero/slide-portables.avif" type="image/avif">
          <source srcset="/images/hero/slide-portables.webp" type="image/webp">
          <img src="/images/hero/slide-portables.jpg" alt="PC Portables Dell HP — dès 299€"
               width="1920" height="400" fetchpriority="high" decoding="auto">
        </picture>
      </a>
    </div>
    <!-- slides 2-5 : loading="lazy" decoding="async" -->
  </div>
  <button class="hero-slider__btn hero-slider__btn--prev" aria-label="Slide précédent">‹</button>
  <button class="hero-slider__btn hero-slider__btn--next" aria-label="Slide suivant">›</button>
  <div class="hero-slider__dots" id="hero-dots"><!-- 5 dots --></div>
  <div class="hero-slider__progress"><div class="hero-slider__progress-bar" id="hero-progress"></div></div>
</div>
<div class="hero-thumbs" id="hero-thumbs">
  <!-- 5 thumbnails 100×58px synchronisées -->
</div>
```

## 5 slides

Palette globale : **bleus + violets + noirs** uniquement. Accent CTA : `#f59e0b` (ambre du site) conservé pour les boutons.

| # | Thème | Headline | CTA | Fond slide | Lien |
|---|-------|----------|-----|-----------|------|
| 1 | PC Portables | Travaillez. Créez. Performez. | Voir les portables → | `#0f172a → #1a3a8f` (noir → bleu primary) | `/ordinateurs.html?tab=portables` |
| 2 | Reconditionnés Grade A | L'excellence à petit prix. | Découvrir les reconditionnés → | `#0f172a → #1e3a8a` (noir → bleu foncé) | `/ordinateurs.html?tab=reconditiones` |
| 3 | Composants & Upgrade | Plus rapide. Plus puissant. | Explorer les composants → | `#0f172a → #1e1b4b` (noir → indigo/violet) | `/composants.html` |
| 4 | Réseau & Connectivité | Restez connecté, partout. | Voir le réseau → | `#0f172a → #312e81` (noir → violet profond) | `/reseau.html` |
| 5 | Services & Assistance | Votre expert info aux Comores. | Nos services → | `#111827 → #1e40af` (dark → bleu vif) | `/services.html` |

## Images à générer (Higgsfield)

Format final : **1920×230px** (ratio ~8.3:1) — hauteur ajustée
Formats livrés : `.avif` (q65) + `.webp` (q80) + `.jpg` fallback (q85)
Emplacement : `/images/hero/`
Thumbnails : **200×68px** WebP (miniatures strip)
Palette : fonds sombres bleu/violet/noir avec zone gauche assombrie pour texte overlay

| Fichier | Prompt Higgsfield |
|---------|-------------------|
| `slide-portables` | Laptop Dell ouvert sur bureau sombre moderne, éclairage ambiant bleu nuit, fond dégradé bleu marine, angle 3/4, qualité photo studio, ultra sharp |
| `slide-reconditiones` | Rangée de PC de bureau reconditionnés alignés, badges verts "Grade A", fond atelier propre industriel, éclairage neutre, photo réaliste |
| `slide-composants` | SSD NVMe M.2 et barrette RAM DDR5 flottants sur fond noir tech, éclairage LED bleu et ambre, macro produit, fond sombre |
| `slide-reseau` | Router WiFi 6 moderne blanc sur bureau, lignes lumineuses de connexion digitales, ambiance bureau connecté, fond bleu nuit |
| `slide-services` | Technicien informatique professionnel en intervention réparation PC, outils, tenue pro, ambiance locale chaleureux |

Chaque image doit avoir une **zone gauche sombre** (gradient) pour recevoir le texte overlay HTML.

## Comportement JS (vanilla, inline)

```js
// config
const DELAY = 4000;      // autoplay ms
const SPEED = 500;       // transition ms

// features
- loop infini
- autoplay + barre de progression animée CSS
- pause au mouseenter/touchstart
- reprise au mouseleave/touchend
- navigation : flèches prev/next + dots + thumbnails
- swipe tactile (threshold 40px)
- dots et thumbnails synchronisés
```

## CSS

- `.promo-banner` et ses styles sont actuellement dans le bloc `<style>` **inline** du `<head>` de `index.html` (CSS critique) ET dans `style.css` (styles complets)
- Les deux occurrences sont remplacées par les styles `.hero-slider`
- Nouvelles classes : `.hero-slider`, `.hero-slider__track`, `.hero-slide`, `.hero-slider__btn`, `.hero-slider__dots`, `.hero-slider__progress`, `.hero-thumbs`, `.hero-thumb`
- Height : `230px` desktop → `160px` mobile (≤768px)
- Images mobile : version `768×160px` servie via `<picture>` + `media="(max-width:768px)"`
- CSS critique slider (hauteurs, overflow:hidden, aspect-ratio) → inline `<style>` dans `<head>`
- CSS complet slider (boutons, dots, thumbnails, animations) → `style.css`

## Performance — Règles strictes

| Règle | Détail |
|-------|--------|
| LCP | Slide 1 uniquement : `fetchpriority="high"` `decoding="auto"` `loading="eager"` |
| Slides 2-5 | `loading="lazy"` `decoding="async"` |
| Pas de CDN | Zéro script externe. JS inline < 2 KB |
| Images | AVIF + WebP + JPG fallback. Chaque image < 120 KB après compression |
| CSS async | Style slider dans `style.css` chargé async existant — pas de nouveau `<link>` |
| CLS | `width="1920" height="400"` sur chaque `<img>` → ratio réservé → pas de saut |
| CSS critique | `.hero-slider{overflow:hidden}` + hauteurs mobile/desktop dans inline `<style>` |

## Ce qui ne change pas

- Header, nav-bar, topbar : inchangés
- Quick-cats, sections produits : inchangés
- Stripe, panier, auth : inchangés
- SEO (meta, canonical) : inchangés

## Fichiers modifiés

- `index.html` — remplace `.promo-banner` par `.hero-slider` + thumbnails + JS inline
- `style.css` — remplace styles `.promo-banner` par `.hero-slider` + `.hero-thumbs`
- `images/hero/` — nouveau dossier, 5 × 3 formats + 5 thumbnails (20 fichiers)
