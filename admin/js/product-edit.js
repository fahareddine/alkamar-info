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
      <button type="button" class="gallery-item__remove" onclick="removeGalleryItem(${i})">×</button>
    </div>`).join('');
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
}
init();

// ── Photos IA ───────────────────────────────────────────────
function setupIAPhotos() {
  const BADGES = {
    idle: 'idle', downloading: 'downloading',
    ready_for_processing: 'ready_for_processing',
    processing: 'processing', processed: 'processed',
    failed: 'failed', partial: 'partial',
  };

  function setIAStatus(status, label) {
    const badge = document.getElementById('ia-status-badge');
    if (!badge) return;
    badge.textContent = '● ' + (label || status);
    badge.className = 'ia-badge ia-badge--' + (BADGES[status] || 'idle');
  }

  document.querySelectorAll('input[name="ia-source"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isPage = radio.value === 'page';
      document.getElementById('ia-urls-inputs').style.display = isPage ? 'none' : '';
      document.getElementById('ia-page-input').style.display  = isPage ? '' : 'none';
    });
  });

  document.getElementById('btn-fetch-images')?.addEventListener('click', async () => {
    const mode = document.querySelector('input[name="ia-source"]:checked').value;
    const slug = document.querySelector('[name="slug"]')?.value;
    if (!productId || !slug) { alert('Enregistrez le produit avant de lancer le pipeline'); return; }

    let payload;
    if (mode === 'urls') {
      payload = [
        document.getElementById('ia-url-1').value,
        document.getElementById('ia-url-2').value,
        document.getElementById('ia-url-3').value,
      ].filter(u => u.trim());
    } else {
      payload = [document.getElementById('ia-page-url').value.trim()];
    }
    if (payload.length === 0) { alert('Entrez au moins une URL'); return; }

    setIAStatus('downloading', 'téléchargement...');
    document.getElementById('btn-fetch-images').disabled = true;

    try {
      const data = await api.post(`/api/products/${productId}/images?action=fetch`, { slug, mode, payload });
      setIAStatus(data.status === 'partial' ? 'partial' : 'ready_for_processing', data.status);

      if (data.sourceUrls?.length) {
        const thumbs = document.getElementById('ia-sources-thumbs');
        thumbs.innerHTML = data.sourceUrls.map(url =>
          `<img src="${url}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0">`
        ).join('');
        document.getElementById('ia-sources-preview').style.display = '';
        const partialMsg = document.getElementById('ia-partial-msg');
        if (data.status === 'partial') {
          partialMsg.textContent = data.message;
          partialMsg.style.display = '';
        } else {
          partialMsg.style.display = 'none';
        }
        document.getElementById('btn-process-images').style.display = '';
      }
    } catch (err) {
      setIAStatus('failed', 'erreur');
      alert('Erreur : ' + (err.message || err));
    } finally {
      document.getElementById('btn-fetch-images').disabled = false;
    }
  });

  document.getElementById('btn-process-images')?.addEventListener('click', async () => {
    const slug = document.querySelector('[name="slug"]')?.value;
    if (!productId || !slug) return;

    setIAStatus('processing', 'traitement IA...');
    document.getElementById('btn-process-images').disabled = true;

    try {
      const data = await api.post(`/api/products/${productId}/images?action=process`, { slug });

      if (data.status === 'processing') {
        setIAStatus('processing', 'en cours...');
        alert('Le traitement est en cours. Revenez dans quelques secondes et rechargez la page.');
        return;
      }

      setIAStatus('processed', 'traité ✓');

      const grid = document.getElementById('ia-results-grid');
      const allUrls = [data.cardCover, ...(data.gallery || [])];
      const labels = ['card-cover', 'detail-main', 'side-1', 'side-2'];
      grid.innerHTML = allUrls.map((url, i) =>
        `<div style="text-align:center">
          <img src="${url}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0">
          <small style="color:var(--admin-muted)">${labels[i] || ''}</small>
        </div>`
      ).join('');
      document.getElementById('ia-results').style.display = '';

      const imgPreview = document.getElementById('img-preview');
      const imgInput   = document.querySelector('[name="image"]');
      if (imgPreview && data.cardCover) { imgPreview.src = data.cardCover; imgPreview.style.display = 'block'; }
      if (imgInput   && data.cardCover) { imgInput.value = data.cardCover; }

    } catch (err) {
      setIAStatus('failed', 'erreur');
      alert('Erreur traitement : ' + (err.message || err));
    } finally {
      document.getElementById('btn-process-images').disabled = false;
    }
  });

  if (productId) {
    fetch(`/api/products/${productId}/images`)
      .then(r => r.json())
      .then(data => {
        if (!data.pipelineStatus || data.pipelineStatus === 'idle') return;
        setIAStatus(data.pipelineStatus);
        if (data.pipelineStatus === 'processed' && data.main) {
          const grid = document.getElementById('ia-results-grid');
          const allUrls = [data.main, ...(data.gallery || [])];
          const labels = ['card-cover', 'detail-main', 'side-1', 'side-2'];
          grid.innerHTML = allUrls.map((url, i) =>
            `<div style="text-align:center">
              <img src="${url}" style="width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:4px;border:1px solid #e2e8f0">
              <small style="color:var(--admin-muted)">${labels[i] || ''}</small>
            </div>`
          ).join('');
          document.getElementById('ia-results').style.display = '';
        }
      })
      .catch(() => {});
  }
}
