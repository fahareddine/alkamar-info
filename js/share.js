// js/share.js — Partage social (utilisateurs connectés uniquement)
const SocialShare = (function () {
  'use strict';

  function E(s) { return encodeURIComponent(s); }

  function addUTM(url, src) {
    return url + (url.includes('?') ? '&' : '?') +
      'utm_source=' + src + '&utm_medium=social&utm_campaign=share_product';
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    }
    try {
      const el = document.createElement('textarea');
      el.value = text;
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    } catch (_) {}
    return Promise.resolve();
  }

  function toast(msg, ms) {
    ms = ms || 3000;
    let t = document.getElementById('_alk_share_toast');
    if (!t) {
      t = document.createElement('div');
      t.id = '_alk_share_toast';
      t.setAttribute('role', 'status');
      t.setAttribute('aria-live', 'polite');
      t.style.cssText = [
        'position:fixed', 'bottom:88px', 'left:50%', 'transform:translateX(-50%)',
        'background:#0f172a', 'color:#fff', 'padding:10px 18px', 'border-radius:8px',
        'font-size:13px', 'font-weight:600', 'z-index:99999', 'max-width:90vw',
        'text-align:center', 'box-shadow:0 4px 20px rgba(0,0,0,.3)',
        'pointer-events:none', 'transition:opacity .2s', 'display:none'
      ].join(';');
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.style.opacity = '1';
    t.style.display = 'block';
    clearTimeout(t._t);
    t._t = setTimeout(function () {
      t.style.opacity = '0';
      setTimeout(function () { t.style.display = 'none'; }, 220);
    }, ms);
  }

  function buildText(product) {
    if (!product) return 'Découvrez ce produit sur Alkamar Info';
    const price = product.price_eur
      ? (Number(product.price_eur).toFixed(2).replace('.', ',') + ' €')
      : '';
    const hasPromo = product.badge && /promo|%|solde/i.test(product.badge);
    if (hasPromo && price) return '🔥 Promo Alkamar : ' + product.name + ' à ' + price;
    if (price) return 'Disponible sur Alkamar : ' + product.name + ' — ' + price;
    return 'Découvrez ' + product.name + ' sur Alkamar Info';
  }

  /* ── Réseaux ─────────────────────────────────────────────────────────────── */
  var NETS = [
    {
      id: 'whatsapp', label: 'WhatsApp', cls: 'share-btn--wa',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.131.558 4.13 1.535 5.862L.057 23.571l5.853-1.535A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.818 9.818 0 01-5.001-1.373l-.359-.213-3.476.911.927-3.381-.234-.372A9.818 9.818 0 1112 21.818z"/></svg>',
      fn: function (url, text) {
        window.open('https://wa.me/?text=' + E(text + '\n' + addUTM(url, 'whatsapp')),
          '_blank', 'noopener,noreferrer');
      }
    },
    {
      id: 'instagram', label: 'Instagram', cls: 'share-btn--ig',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>',
      fn: function (url, text, name) {
        var u = addUTM(url, 'instagram');
        copyText('🔥 ' + name + '\nVoir ici : ' + u).then(function () {
          toast('Lien copié ! Ouvrez Instagram et collez-le en story, bio ou message.', 4500);
        });
        if (/mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
          setTimeout(function () {
            window.location.href = 'instagram://app';
            setTimeout(function () {
              window.open('https://www.instagram.com/', '_blank', 'noopener');
            }, 1500);
          }, 400);
        }
      }
    },
    {
      id: 'tiktok', label: 'TikTok', cls: 'share-btn--tt',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.77 1.52V6.74a4.85 4.85 0 01-1-.05z"/></svg>',
      fn: function (url, text, name) {
        var u = addUTM(url, 'tiktok');
        copyText('🔥 ' + name + '\nVoir ici : ' + u).then(function () {
          toast('Lien copié ! Ouvrez TikTok et collez-le en description, story ou message.', 4500);
        });
        if (/mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
          setTimeout(function () {
            window.location.href = 'snssdk1233://';
            setTimeout(function () {
              window.open('https://www.tiktok.com/', '_blank', 'noopener');
            }, 1500);
          }, 400);
        }
      }
    },
    {
      id: 'facebook', label: 'Facebook', cls: 'share-btn--fb',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>',
      fn: function (url) {
        window.open('https://www.facebook.com/sharer/sharer.php?u=' + E(addUTM(url, 'facebook')),
          '_blank', 'noopener,noreferrer,width=600,height=500');
      }
    },
    {
      id: 'x', label: 'X / Twitter', cls: 'share-btn--x',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.261 5.635 5.903-5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
      fn: function (url, text) {
        window.open('https://twitter.com/intent/tweet?text=' + E(text) + '&url=' + E(addUTM(url, 'x')),
          '_blank', 'noopener,noreferrer,width=600,height=400');
      }
    },
    {
      id: 'linkedin', label: 'LinkedIn', cls: 'share-btn--li',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>',
      fn: function (url) {
        window.open('https://www.linkedin.com/sharing/share-offsite/?url=' + E(addUTM(url, 'linkedin')),
          '_blank', 'noopener,noreferrer,width=600,height=500');
      }
    },
    {
      id: 'telegram', label: 'Telegram', cls: 'share-btn--tg',
      icon: '<svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>',
      fn: function (url, text) {
        window.open('https://t.me/share/url?url=' + E(addUTM(url, 'telegram')) + '&text=' + E(text),
          '_blank', 'noopener,noreferrer,width=600,height=500');
      }
    },
    {
      id: 'email', label: 'Email', cls: 'share-btn--email',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
      fn: function (url, text, name) {
        window.location.href = 'mailto:?subject=' + E(name + ' — Alkamar Info') +
          '&body=' + E(text + '\n\n' + addUTM(url, 'email'));
      }
    },
    {
      id: 'copy', label: 'Copier', cls: 'share-btn--copy',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>',
      fn: function (url) {
        copyText(addUTM(url, 'copy'))
          .then(function () { toast('Lien copié !'); })
          .catch(function () { toast('Impossible de copier le lien.'); });
      }
    }
  ];

  /* ── Render ──────────────────────────────────────────────────────────────── */
  function render(containerId, opts) {
    opts = opts || {};
    var el = document.getElementById(containerId);
    if (!el) return;

    var url    = opts.url    || window.location.href;
    var ogUrl  = opts.ogUrl  || url;   // URL crawlée par les réseaux sociaux
    var name   = opts.name   || document.title;
    var text   = opts.text   || buildText(opts.product);

    /* Partage natif (mobile) */
    var nativeBtn = '';
    if (navigator.share) {
      _ctx = { name: name, text: text, url: ogUrl };
      nativeBtn =
        '<button class="share-btn share-btn--native" onclick="SocialShare._native()" ' +
        'aria-label="Partager ce produit">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">' +
        '<path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>' +
        '<polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>' +
        '<span>Partager</span></button>';
    }

    var btns = NETS.map(function (n) {
      return '<button class="share-btn ' + n.cls + '" data-net="' + n.id + '" ' +
        'aria-label="Partager sur ' + n.label + '" title="' + n.label + '">' +
        n.icon + '<span>' + n.label + '</span></button>';
    }).join('');

    el.innerHTML =
      '<div class="share-block" role="region" aria-label="Partager ce produit">' +
        '<div class="share-block__label">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13" aria-hidden="true">' +
          '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>' +
          '<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>' +
          '<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>' +
          ' Partager' +
        '</div>' +
        '<div class="share-block__btns">' + nativeBtn + btns + '</div>' +
      '</div>';

    /* Délégation d'événements — évite les onclick inline complexes */
    el.querySelector('.share-block__btns').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-net]');
      if (!btn) return;
      var net = NETS.find(function (n) { return n.id === btn.dataset.net; });
      if (net) net.fn(ogUrl, text, name);
    });
  }

  /* ── Partage natif ───────────────────────────────────────────────────────── */
  var _ctx = null;
  function _native() {
    var c = _ctx || {};
    if (navigator.share) {
      navigator.share({
        title: c.name || '',
        text:  c.text  || '',
        url:   c.url   || window.location.href
      }).catch(function () {});
    }
  }

  return { render: render, _native: _native };
})();

window.SocialShare = SocialShare;
