// --- Utilitaires ---
function esc(str) { const d=document.createElement('div'); d.textContent=str??''; return d.innerHTML; }

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // accents
    .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
}

// --- État ---
const productId = new URLSearchParams(window.location.search).get('id');
let selectedTagIds = new Set();
let allTags = [];
let galleryItems = []; // [{src, alt}]

// --- Specs ---
function addSpecRow(key='', value='') {
  if (key.startsWith('_')) return; // skip private keys (SEO etc.)
  const container = document.getElementById('specs-container');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;align-items:center';
  row.innerHTML = `
    <input type="text" placeholder="Clé (RAM)" value="${esc(key)}" class="form-control spec-key" style="flex:1">
    <input type="text" placeholder="Valeur (16 Go)" value="${esc(value)}" class="form-control spec-val" style="flex:2">
    <button type="button" class="btn btn--danger btn--sm" onclick="this.parentElement.remove()">×</button>`;
  container.appendChild(row);
}

function getSpecs() {
  const specs = {};
  document.querySelectorAll('#specs-container > div').forEach(row => {
    const k = row.querySelector('.spec-key').value.trim();
    const v = row.querySelector('.spec-val').value.trim();
    if (k) specs[k] = v;
  });
  // Ajoute les champs SEO dans specs
  const seoTitle = document.getElementById('seo-title').value.trim();
  const seoDesc = document.getElementById('seo-desc').value.trim();
  if (seoTitle) specs._seo_title = seoTitle;
  if (seoDesc) specs._seo_description = seoDesc;
  return specs;
}

// --- Galerie ---
function renderGallery() {
  const grid = document.getElementById('gallery-grid');
  grid.innerHTML = galleryItems.map((item, i) => `
    <div class="gallery-item">
      <img src="${esc(item.src)}" alt="${esc(item.alt)}" onerror="this.style.opacity=0.3">
      <button type="button" class="gallery-item__remove" onclick="removeGalleryItem(${i})" title="Supprimer">×</button>
      <button type="button" class="gallery-item__promote" onclick="promoteToMain(${i})" title="Définir comme image principale">⭐</button>
    </div>`).join('');
}

function promoteToMain(i) {
  const currentMain = document.querySelector('[name="image"]').value.trim();
  const newMain = galleryItems[i].src;
  // Swap : ancienne principale → galerie, galerie[i] → principale
  galleryItems[i] = { src: currentMain, alt: '' };
  if (!currentMain) galleryItems.splice(i, 1); // si pas de principale, juste retirer
  document.querySelector('[name="image"]').value = newMain;
  const prev = document.getElementById('img-preview');
  if (prev) { prev.src = newMain; prev.style.display = 'block'; }
  renderGallery();
}

function removeGalleryItem(i) {
  galleryItems.splice(i, 1);
  renderGallery();
}

function addGalleryItem() {
  const input = document.getElementById('gallery-url-input');
  const src = input.value.trim();
  if (!src) return;
  galleryItems.push({ src, alt: '' });
  input.value = '';
  renderGallery();
}

// --- Tags ---
function renderTagPill(tagId, tagName) {
  const pill = document.createElement('span');
  pill.className = 'tag-pill';
  pill.dataset.id = tagId;
  pill.innerHTML = `${esc(tagName)}<button type="button" class="tag-pill__remove" onclick="removeTag('${tagId}')">×</button>`;
  document.getElementById('tags-wrap').insertBefore(pill, document.getElementById('tag-input'));
}

function removeTag(tagId) {
  selectedTagIds.delete(tagId);
  document.querySelector(`.tag-pill[data-id="${tagId}"]`)?.remove();
}

function setupTagInput() {
  const input = document.getElementById('tag-input');
  const suggestions = document.getElementById('tags-suggestions');

  input.addEventListener('input', () => {
    const q = input.value.toLowerCase().trim();
    if (!q) { suggestions.style.display='none'; return; }
    const matches = allTags.filter(t => t.name.toLowerCase().includes(q) && !selectedTagIds.has(t.id));
    if (!matches.length) { suggestions.style.display='none'; return; }
    suggestions.innerHTML = matches.slice(0,8).map(t => `<li data-id="${esc(t.id)}" data-name="${esc(t.name)}">${esc(t.name)}</li>`).join('');
    suggestions.style.display = 'block';
  });

  suggestions.addEventListener('click', e => {
    const li = e.target.closest('li');
    if (!li) return;
    const id = li.dataset.id, name = li.dataset.name;
    selectedTagIds.add(id);
    renderTagPill(id, name);
    input.value = '';
    suggestions.style.display = 'none';
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.tags-container')) suggestions.style.display='none';
  });

  // Enter pour créer un nouveau tag si aucune suggestion
  input.addEventListener('keydown', async e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const name = input.value.trim();
    if (!name) return;
    const existing = allTags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) {
      if (!selectedTagIds.has(existing.id)) { selectedTagIds.add(existing.id); renderTagPill(existing.id, existing.name); }
    } else {
      try {
        const slug = slugify(name);
        const newTag = await api.post('/api/tags', { name, slug });
        if (newTag?.id) { allTags.push(newTag); selectedTagIds.add(newTag.id); renderTagPill(newTag.id, newTag.name); }
      } catch(err) { console.error('Erreur création tag:', err); }
    }
    input.value = '';
    suggestions.style.display = 'none';
  });
}

// --- Slug ---
function setupSlug() {
  const nameInput = document.querySelector('[name=name]');
  const slugInput = document.querySelector('[name=slug]');
  let autoSlug = !productId; // auto seulement pour nouveau produit

  nameInput.addEventListener('input', () => {
    if (autoSlug) slugInput.value = slugify(nameInput.value);
  });
  slugInput.addEventListener('input', () => { autoSlug = false; });
  document.getElementById('btn-regen-slug').addEventListener('click', () => {
    slugInput.value = slugify(nameInput.value);
    autoSlug = true;
  });
}

// --- Prix auto KMF ---
function setupPriceSync() {
  document.querySelector('[name=price_eur]').addEventListener('input', function() {
    const kmf = document.querySelector('[name=price_kmf]');
    if (this.value) kmf.value = Math.round(Number(this.value) * 491);
  });
}

// --- Image preview ---
function setupImagePreview() {
  document.querySelector('[name=image]').addEventListener('input', function() {
    const preview = document.getElementById('img-preview');
    if (this.value) { preview.src = this.value; preview.style.display='block'; }
    else preview.style.display = 'none';
  });
}

// --- SEO counter ---
function setupSeoCounter() {
  const desc = document.getElementById('seo-desc');
  const counter = document.getElementById('seo-desc-count');
  desc.addEventListener('input', () => { counter.textContent = `${desc.value.length}/160`; });
}

// --- Aperçu ---
function setupPreview() {
  document.getElementById('btn-preview').addEventListener('click', () => {
    const modal = document.getElementById('preview-modal');
    document.getElementById('preview-img').src = document.querySelector('[name=image]').value || '';
    document.getElementById('preview-name').textContent = document.querySelector('[name=name]').value || 'Sans nom';
    document.getElementById('preview-subtitle').textContent = document.querySelector('[name=subtitle]').value || '';
    const price = document.querySelector('[name=price_eur]').value;
    document.getElementById('preview-price').textContent = price ? `${Number(price).toFixed(2)} €` : '';
    const old = document.querySelector('[name=price_old]').value;
    document.getElementById('preview-price-old').textContent = old ? `${Number(old).toFixed(2)} €` : '';
    const stock = document.querySelector('[name=stock]').value;
    document.getElementById('preview-stock').textContent = stock > 0 ? `${stock} en stock` : '⚠️ Rupture de stock';
    const badge = document.querySelector('[name=badge]').value;
    document.getElementById('preview-badge-wrap').innerHTML = badge ? `<span class="badge badge--active" style="margin-bottom:8px;display:inline-block">${esc(badge)}</span>` : '';
    modal.style.display = 'flex';
  });
}

// --- Load produit ---
async function loadCategories() {
  const cats = await api.get('/api/categories');
  const sel = document.getElementById('cat-select');
  (cats||[]).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = (c.parent_id ? '  ' : '') + (c.icon ? c.icon + ' ' : '') + c.name;
    sel.appendChild(opt);
  });
}

async function loadTags() {
  allTags = await api.get('/api/tags') || [];
}

async function loadProduct(id) {
  const p = await api.get(`/api/products/${id}`);
  if (!p) return;
  document.getElementById('page-title').textContent = `Éditer : ${p.name}`;
  const form = document.getElementById('product-form');

  // Champs simples
  const fields = ['name','slug','brand','subtitle','description','price_eur','price_kmf','price_old','stock','stock_label','status','badge','badge_class','image','sku'];
  fields.forEach(f => { if (form[f] && p[f] != null) form[f].value = p[f]; });

  // Catégorie
  if (form.category_id && p.category_id) form.category_id.value = p.category_id;

  // Specs (excluant clés privées)
  Object.entries(p.specs || {}).forEach(([k,v]) => {
    if (k === '_seo_title') document.getElementById('seo-title').value = v;
    else if (k === '_seo_description') document.getElementById('seo-desc').value = v;
    else addSpecRow(k, v);
  });
  document.getElementById('seo-desc-count').textContent = `${(document.getElementById('seo-desc').value||'').length}/160`;

  // Image preview
  if (p.image) {
    const prev = document.getElementById('img-preview');
    prev.src = p.image; prev.style.display = 'block';
  }

  // Galerie
  galleryItems = (p.gallery || []).map(g => typeof g === 'string' ? {src:g, alt:''} : g);
  renderGallery();

  // Features
  if (p.features && p.features.length > 0) {
    const hf = document.getElementById('hidden-features');
    if (hf) hf.value = JSON.stringify(p.features);
  }

  // Tags (depuis specs._tag_ids si dispo)
  const savedTagIds = p.specs?._tag_ids || [];
  savedTagIds.forEach(tagId => {
    const tag = allTags.find(t => t.id === tagId);
    if (tag) { selectedTagIds.add(tag.id); renderTagPill(tag.id, tag.name); }
  });
}

// --- Save ---
async function saveProduct(statusOverride = null) {
  const form = document.getElementById('product-form');
  const alertEl = document.getElementById('alert');
  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Enregistrement...';
  alertEl.style.display = 'none';

  const fd = new FormData(form);
  const body = Object.fromEntries(fd.entries());

  // Types numériques
  body.price_eur = Number(body.price_eur) || 0;
  body.price_kmf = Number(body.price_kmf) || 0;
  body.price_old = body.price_old ? Number(body.price_old) : null;
  body.stock = Number(body.stock) || 0;

  // Slug auto si vide
  if (!body.slug) body.slug = slugify(body.name);

  // Status override (brouillon)
  if (statusOverride) body.status = statusOverride;

  // Specs (avec SEO et tags)
  const specs = getSpecs();
  if (selectedTagIds.size) specs._tag_ids = [...selectedTagIds];
  body.specs = specs;

  // Galerie
  body.gallery = galleryItems;

  // Features
  try { body.features = JSON.parse(body.features || '[]'); } catch { body.features = []; }

  // Nettoyage — exclure champs vides et champs internes ia-*
  Object.keys(body).forEach(k => { if (body[k] === '' || k.startsWith('ia-')) delete body[k]; });

  try {
    if (productId) {
      await api.put(`/api/products/${productId}`, body);
    } else {
      await api.post('/api/products', body);
    }
    alertEl.className = 'alert alert--success';
    alertEl.textContent = 'Produit enregistré avec succès !';
    alertEl.style.display = 'block';
    setTimeout(() => window.location.href = '/admin/products/', 1000);
  } catch (err) {
    alertEl.className = 'alert alert--error';
    alertEl.textContent = err.message;
    alertEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Enregistrer';
  }
}

// --- Init ---
async function init() {
  await adminAuth.requireAuth();
  await Promise.all([loadCategories(), loadTags()]);
  if (productId) await loadProduct(productId);

  setupSlug();
  setupPriceSync();
  setupImagePreview();
  setupSeoCounter();
  setupTagInput();
  setupPreview();

  document.getElementById('add-spec').addEventListener('click', () => addSpecRow());
  document.getElementById('gallery-add-btn').addEventListener('click', addGalleryItem);
  document.getElementById('gallery-url-input').addEventListener('keydown', e => { if(e.key==='Enter'){e.preventDefault();addGalleryItem();} });
  document.getElementById('btn-save').addEventListener('click', () => saveProduct());
  document.getElementById('btn-draft').addEventListener('click', () => saveProduct('draft'));
  setupIAPhotos();
  setupReiimport();
}
init();

// ── Reimport depuis URL ─────────────────────────────────────
function setupReiimport() {
  document.getElementById('btn-reimport')?.addEventListener('click', async () => {
    let url = document.getElementById('reimport-url').value.trim();
    if (!url.startsWith('http')) url = 'https://' + url;
    if (!url.startsWith('http')) { alert('Entrez une URL valide'); return; }
    const btn = document.getElementById('btn-reimport');
    btn.disabled = true; btn.textContent = '⏳ Scraping...';
    try {
      const p = await api.post('/api/products?action=scrape', { url });
      const form = document.getElementById('product-form');

      if (p.name  && form.name)        form.name.value        = p.name;
      if (p.brand && form.brand)       form.brand.value       = p.brand;
      if (p.description && form.description) form.description.value = p.description;

      // Image principale
      if (p.image) {
        if (form.image) form.image.value = p.image;
        const prev = document.getElementById('img-preview');
        if (prev) { prev.src = p.image; prev.style.display = 'block'; }
      }

      // Galerie
      if (p.gallery && p.gallery.length > 0) {
        galleryItems = p.gallery.map(src => typeof src === 'string' ? { src, alt: '' } : src);
        renderGallery();
      }

      // Prix si non défini
      if (p.price_eur && form.price_eur && !form.price_eur.value) form.price_eur.value = p.price_eur;

      // Points forts (features) — stocker dans champ hidden
      if (p.features && p.features.length > 0) {
        const hf = document.getElementById('hidden-features');
        if (hf) hf.value = JSON.stringify(p.features);
      }

      const alertEl = document.getElementById('alert');
      alertEl.className = 'alert alert--success';
      alertEl.textContent = 'Fiche pré-remplie — vérifiez et enregistrez.';
      alertEl.style.display = 'block';
      setTimeout(() => alertEl.style.display = 'none', 4000);
    } catch (err) {
      alert('Erreur scraping : ' + (err.message || err));
    } finally {
      btn.disabled = false; btn.textContent = '🔄 Pré-remplir';
    }
  });
  document.getElementById('reimport-url')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); document.getElementById('btn-reimport').click(); }
  });
}

// ── Sélecteur d'images ─────────────────────────────────────
function setupIAPhotos() {
  let pickerImages = []; // [{url, role: null|'main'|'gallery'}]

  // Toggle inputs source
  document.querySelectorAll('input[name="ia-source"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isPage = radio.value === 'page';
      document.getElementById('ia-urls-inputs').style.display = isPage ? 'none' : '';
      document.getElementById('ia-page-input').style.display  = isPage ? '' : 'none';
    });
  });

  function renderPicker() {
    const grid = document.getElementById('picker-grid');
    if (!grid) return;
    grid.innerHTML = pickerImages.map((img, i) => {
      const isMain    = img.role === 'main';
      const isGallery = img.role === 'gallery';
      const border    = isMain ? '#f59e0b' : isGallery ? '#3b82f6' : 'var(--admin-border,#e2e8f0)';
      const roleBadge = isMain    ? '<span class="picker-role picker-role--main">⭐ Principale</span>'
                      : isGallery ? '<span class="picker-role picker-role--gallery">📁 Galerie</span>'
                      : '';
      return `<div class="picker-card${isMain?' picker-card--main':isGallery?' picker-card--gallery':''}" style="border-color:${border}">
        <img src="${esc(img.url)}" onerror="this.style.opacity=.25" loading="lazy">
        ${roleBadge}
        <div class="picker-actions">
          <button type="button" onclick="pickerSetRole(${i},'main')"
            class="btn btn--sm ${isMain?'btn--warning':'btn--ghost'}" style="flex:1">⭐</button>
          <button type="button" onclick="pickerSetRole(${i},'gallery')"
            class="btn btn--sm ${isGallery?'btn--primary':'btn--ghost'}" style="flex:1">📁</button>
          <button type="button" onclick="pickerSetRole(${i},null)"
            class="btn btn--sm btn--ghost" style="flex:0;padding:0 6px">×</button>
        </div>
      </div>`;
    }).join('');
    const applyBtn = document.getElementById('btn-apply-picker');
    if (applyBtn) applyBtn.style.display = pickerImages.length ? '' : 'none';
  }

  window.pickerSetRole = function(idx, role) {
    if (role === 'main') pickerImages.forEach((img, i) => { if (i !== idx && img.role === 'main') img.role = null; });
    pickerImages[idx].role = role;
    renderPicker();
  };

  document.getElementById('btn-fetch-images')?.addEventListener('click', async () => {
    const mode = document.querySelector('input[name="ia-source"]:checked').value;
    const btn  = document.getElementById('btn-fetch-images');
    let urls   = [];

    if (mode === 'urls') {
      urls = [
        document.getElementById('ia-url-1').value.trim(),
        document.getElementById('ia-url-2').value.trim(),
        document.getElementById('ia-url-3').value.trim(),
      ].filter(Boolean);
      if (!urls.length) { alert('Entrez au moins une URL'); return; }
    } else {
      const pageUrl = document.getElementById('ia-page-url').value.trim();
      if (!pageUrl) { alert('Entrez une URL de page'); return; }
      btn.disabled = true; btn.textContent = '⏳ Scraping...';
      try {
        const data = await api.post('/api/products?action=scrape', { url: pageUrl });
        if (data.image) urls.push(data.image);
        if (data.gallery) urls.push(...data.gallery.map(g => typeof g === 'string' ? g : g.src).filter(Boolean));
        if (!urls.length) { alert('Aucune image trouvée sur cette page'); return; }
      } catch(e) {
        alert('Erreur scraping : ' + (e.message || e)); return;
      } finally {
        btn.disabled = false; btn.textContent = '↓ Récupérer les images';
      }
    }

    // Auto-assign : 1ère = principale, reste = galerie
    pickerImages = urls.map((url, i) => ({ url, role: i === 0 ? 'main' : 'gallery' }));
    document.getElementById('picker-section').style.display = '';
    renderPicker();
  });

  document.getElementById('btn-apply-picker')?.addEventListener('click', () => {
    const main    = pickerImages.find(img => img.role === 'main');
    const gallery = pickerImages.filter(img => img.role === 'gallery');

    if (main) {
      document.querySelector('[name="image"]').value = main.url;
      const prev = document.getElementById('img-preview');
      if (prev) { prev.src = main.url; prev.style.display = 'block'; }
    }

    galleryItems = gallery.map(img => ({ src: img.url, alt: '' }));
    renderGallery();

    document.getElementById('picker-section').style.display = 'none';
    pickerImages = [];

    const alertEl = document.getElementById('alert');
    alertEl.className = 'alert alert--success';
    alertEl.textContent = `✓ ${main ? '1 image principale' : 'Aucune principale'} + ${gallery.length} en galerie.`;
    alertEl.style.display = 'block';
    setTimeout(() => alertEl.style.display = 'none', 3000);
  });
}
