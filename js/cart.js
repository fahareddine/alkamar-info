// js/cart.js — Gestion panier localStorage
const CART_KEY = 'alkamar_cart';

const Cart = (function () {
  function load() {
    try { return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
    catch { return []; }
  }

  function save(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: { items } }));
  }

  function add(product) {
    const items = load();
    const idx = items.findIndex(i => i.id === product.id);
    if (idx >= 0) {
      items[idx].qty = (items[idx].qty || 1) + 1;
    } else {
      items.push({ ...product, qty: 1 });
    }
    save(items);
    return items;
  }

  function remove(id) {
    const items = load().filter(i => i.id !== id);
    save(items);
    return items;
  }

  function updateQty(id, qty) {
    const items = load();
    const idx = items.findIndex(i => i.id === id);
    if (idx < 0) return items;
    if (qty <= 0) return remove(id);
    items[idx].qty = qty;
    save(items);
    return items;
  }

  function clear() { save([]); }

  function total() {
    return load().reduce((sum, i) => sum + (i.price_eur || 0) * (i.qty || 1), 0);
  }

  function count() {
    return load().reduce((sum, i) => sum + (i.qty || 1), 0);
  }

  return { load, add, remove, updateQty, clear, total, count };
})();

window.Cart = Cart;
