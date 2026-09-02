const API_URL = 'https://script.google.com/macros/s/AKfycbwKvhwq4qTAzimrlpvSPA2psz4618xsz4UuHirPih6pa0RTRGnI0c5moxtxjYbsStOgQw/exec';
const SESSION_KEY = 'wishlist-session-id';

const state = { gifts: [], filter: 'all', sessionId: getSessionId(), carouselIndexes: {} };
const giftGrid = document.querySelector('#giftGrid');
const stateMessage = document.querySelector('#stateMessage');
const resultCount = document.querySelector('#resultCount');
const cartCount = document.querySelector('#cartCount');
const cartDrawer = document.querySelector('#cartDrawer');
const drawerBackdrop = document.querySelector('#drawerBackdrop');
const cartList = document.querySelector('#cartList');
const toast = document.querySelector('#toast');

function getSessionId() {
  let sessionId = localStorage.getItem(SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    localStorage.setItem(SESSION_KEY, sessionId);
  }
  return sessionId;
}

async function loadGifts() {
  if (API_URL.startsWith('INCOLLA_')) {
    showState('Inserisci l’URL del Web App Apps Script in script.js per collegare la wishlist.', true);
    return;
  }
  try {
    const response = await fetch(API_URL, { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Impossibile caricare i regali.');
    state.gifts = data.gifts || [];
    render();
  } catch (error) {
    showState(error.message, true);
  }
}

function filteredGifts() {
  return state.gifts.filter(gift => {
    const price = Number(gift.price) || 0;
    return state.filter === 'all' || (state.filter === 'under30' && price < 30) || (state.filter === '30to50' && price >= 30 && price <= 50) || (state.filter === '50to80' && price > 50 && price <= 80) || (state.filter === 'over80' && price > 80);
  });
}

function render() {
  const gifts = filteredGifts();
  resultCount.textContent = `${gifts.length} ${gifts.length === 1 ? 'idea' : 'idee'}`;
  stateMessage.hidden = gifts.length > 0;
  giftGrid.innerHTML = gifts.map(renderGiftCard).join('');
  updateCart();
}

function renderGiftCard(gift) {
  const photos = gift.photos?.length ? gift.photos : [];
  const index = state.carouselIndexes[gift.id] || 0;
  const reservedByMe = gift.reserved && gift.reservedBy === state.sessionId;
  const photo = photos[index] || '';
  const photoMarkup = photo ? `<img src="${escapeAttribute(photo)}" alt="" loading="lazy">` : '<div class="photo-placeholder" aria-hidden="true">♡</div>';
  const controls = photos.length > 1 ? `<button class="carousel-button prev" type="button" data-carousel="prev" data-id="${escapeAttribute(gift.id)}" aria-label="Foto precedente">‹</button><button class="carousel-button next" type="button" data-carousel="next" data-id="${escapeAttribute(gift.id)}" aria-label="Foto successiva">›</button><div class="dots">${photos.map((_, dotIndex) => `<button class="dot ${dotIndex === index ? 'is-active' : ''}" type="button" data-carousel-index="${dotIndex}" data-id="${escapeAttribute(gift.id)}" aria-label="Vai alla foto ${dotIndex + 1}"></button>`).join('')}</div>` : '';
  const links = (gift.links || []).map(link => `<a class="store-link" href="${safeUrl(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`).join(' · ');
  return `<article class="gift-card"><div class="photo-frame">${photoMarkup}${controls}</div><div class="card-content"><h3>${escapeHtml(gift.name || 'Regalo senza nome')}</h3><p class="price">${formatPrice(gift.price)}</p>${links ? `<div class="store-links">${links}</div>` : ''}<button class="primary-button" type="button" data-action="reserve" data-id="${escapeAttribute(gift.id)}" ${gift.reserved ? 'disabled' : ''}>${reservedByMe ? 'Scelto da te' : gift.reserved ? 'Già scelto' : 'Scegli questo regalo'}</button></div></article>`;
}

function updateCart() {
  const selected = state.gifts.filter(gift => gift.reserved && gift.reservedBy === state.sessionId);
  cartCount.textContent = selected.length;
  cartList.innerHTML = selected.length ? selected.map(gift => `<div class="cart-item"><h3>${escapeHtml(gift.name)}</h3><p class="price">${formatPrice(gift.price)}</p><button class="remove-button" type="button" data-action="unreserve" data-id="${escapeAttribute(gift.id)}">Rimuovi / Rendi disponibile</button></div>`).join('') : '<p class="state-message">Non hai ancora scelto regali.</p>';
}

async function changeReservation(giftId, action) {
  const gift = state.gifts.find(item => item.id === giftId);
  if (!gift || (action === 'prenota' && gift.reserved)) return;
  const previous = { reserved: gift.reserved, reservedBy: gift.reservedBy };
  gift.reserved = action === 'prenota';
  gift.reservedBy = action === 'prenota' ? state.sessionId : '';
  render();
  try {
    const response = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action, regaloId: giftId, sessionId: state.sessionId }) });
    const data = await response.json();
    if (!response.ok || !data.success) throw new Error(data.error || 'Operazione non riuscita.');
    showToast(action === 'prenota' ? 'Regalo aggiunto alle tue scelte.' : 'Regalo di nuovo disponibile.');
  } catch (error) {
    Object.assign(gift, previous);
    render();
    showToast(error.message);
  }
}

function formatPrice(value) { return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(Number(value) || 0); }
function escapeHtml(value) { const element = document.createElement('span'); element.textContent = value; return element.innerHTML; }
function escapeAttribute(value) { return escapeHtml(String(value)).replace(/`/g, '&#96;'); }
function safeUrl(value) { try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) ? escapeAttribute(url.href) : '#'; } catch { return '#'; } }
function showState(message, isError = false) { stateMessage.hidden = false; stateMessage.textContent = message; stateMessage.classList.toggle('is-error', isError); giftGrid.innerHTML = ''; }
function showToast(message) { toast.textContent = message; toast.classList.add('is-visible'); clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove('is-visible'), 3500); }
function setDrawer(open) { cartDrawer.classList.toggle('is-open', open); cartDrawer.setAttribute('aria-hidden', String(!open)); drawerBackdrop.hidden = !open; document.querySelector('#cartButton').setAttribute('aria-expanded', String(open)); if (open) document.querySelector('#closeCartButton').focus(); }

document.querySelector('#filterOptions').addEventListener('click', event => { const button = event.target.closest('[data-filter]'); if (!button) return; state.filter = button.dataset.filter; document.querySelectorAll('.filter-button').forEach(item => item.classList.toggle('is-active', item === button)); render(); });
giftGrid.addEventListener('click', event => { const target = event.target.closest('[data-action], [data-carousel], [data-carousel-index]'); if (!target) return; const gift = state.gifts.find(item => item.id === target.dataset.id); if (!gift) return; if (target.dataset.action === 'reserve') changeReservation(gift.id, 'prenota'); if (target.dataset.carousel || target.dataset.carouselIndex) { const total = gift.photos.length; let index = state.carouselIndexes[gift.id] || 0; index = target.dataset.carousel === 'next' ? (index + 1) % total : target.dataset.carousel === 'prev' ? (index - 1 + total) % total : Number(target.dataset.carouselIndex); state.carouselIndexes[gift.id] = index; render(); } });
cartList.addEventListener('click', event => { const button = event.target.closest('[data-action="unreserve"]'); if (button) changeReservation(button.dataset.id, 'sprenota'); });
document.querySelector('#cartButton').addEventListener('click', () => setDrawer(true)); document.querySelector('#closeCartButton').addEventListener('click', () => setDrawer(false)); drawerBackdrop.addEventListener('click', () => setDrawer(false));
document.addEventListener('keydown', event => { if (event.key === 'Escape') setDrawer(false); });
loadGifts();
