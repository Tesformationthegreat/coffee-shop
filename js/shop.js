/* Lowfield Coffee: cart, subscription builder, roast dates, roast-week steps.
   Cart lives in localStorage under "lowfield-cart". Checkout is not wired yet. */

(function () {
  const STORE = 'lowfield-cart';
  const SHIP_FLAT = 6;
  const FREE_SHIP_AT = 45;
  const SUB_DISCOUNT = 0.10;

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const money = n => '$' + n.toFixed(2);
  const round2 = n => Math.round(n * 100) / 100;

  /* ---------- Roast dates ----------
     Orders by Sunday 11:59 pm go into Monday's roast. Pack Tuesday, ship Wednesday. */
  function nextRoast(now = new Date()) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const add = ((8 - d.getDay()) % 7) || 7; // Monday is roast day, so a Monday order waits a week
    d.setDate(d.getDate() + add);
    return d;
  }
  const shift = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const fmtShort = d => d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const fmtLong = d => d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const roast = nextRoast();
  const dates = {
    cutoff: fmtShort(shift(roast, -1)) + ', 11:59 pm',
    roast: fmtShort(roast),
    pack: fmtShort(shift(roast, 1)),
    ship: fmtShort(shift(roast, 2)),
    'roast-long': fmtLong(roast)
  };
  $$('[data-date]').forEach(el => {
    const key = el.dataset.date;
    if (key === 'cutoff' && el.classList.contains('when')) el.textContent = fmtShort(shift(roast, -1));
    else if (dates[key]) el.textContent = dates[key];
  });
  $$('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  /* ---------- Cart state ---------- */
  function load() {
    try { const v = JSON.parse(localStorage.getItem(STORE)); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  let cart = load();
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(cart)); } catch (e) { /* private mode: cart still works for this visit */ }
  }

  function addLine(item) {
    const key = [item.id, item.grind, item.plan || ''].join('|');
    const found = cart.find(l => l.key === key);
    if (found) found.qty = Math.min(20, found.qty + item.qty);
    else cart.push({ key, ...item });
    save(); render();
  }
  function setQty(key, qty) {
    const line = cart.find(l => l.key === key);
    if (!line) return;
    line.qty = Math.max(0, Math.min(20, qty));
    if (line.qty === 0) cart = cart.filter(l => l.key !== key);
    save(); render();
  }

  function totals() {
    const subtotal = round2(cart.reduce((s, l) => s + l.price * l.qty, 0));
    const hasSub = cart.some(l => l.plan);
    const oneOff = cart.filter(l => !l.plan).reduce((s, l) => s + l.price * l.qty, 0);
    const shipping = cart.length === 0 || hasSub || oneOff >= FREE_SHIP_AT ? 0 : SHIP_FLAT;
    return { subtotal, shipping, total: round2(subtotal + shipping), count: cart.reduce((n, l) => n + l.qty, 0) };
  }

  /* ---------- Cart rendering ---------- */
  const linesEl = $('[data-cart-lines]');
  const footEl = $('[data-cart-foot]');

  function render() {
    const t = totals();
    $$('[data-cart-count]').forEach(el => { el.textContent = t.count; });
    $('[data-open-cart]').setAttribute('aria-label', `Cart, ${t.count} item${t.count === 1 ? '' : 's'}`);

    if (!cart.length) {
      linesEl.innerHTML = '<div class="empty"><p>Your cart is empty.</p><a class="btn btn-dark" href="#shop" data-close-cart>Shop the beans</a></div>';
      footEl.hidden = true;
      return;
    }
    footEl.hidden = false;
    linesEl.innerHTML = '';
    cart.forEach(l => {
      const row = document.createElement('div');
      row.className = 'line';
      const meta = [l.grind, '340 g', l.plan ? `every ${l.plan} weeks, 10 percent off` : null].filter(Boolean).join(', ');
      row.innerHTML = `
        <span class="line-name"></span>
        <span class="line-price">${money(l.price * l.qty)}</span>
        <span class="line-meta"></span>
        <div class="line-controls">
          <div class="qty" role="group" aria-label="Quantity">
            <button type="button" data-dec aria-label="One fewer">&minus;</button>
            <output aria-live="polite">${l.qty}</output>
            <button type="button" data-inc aria-label="One more">+</button>
          </div>
          <button class="remove" type="button" data-remove>Remove</button>
        </div>`;
      $('.line-name', row).textContent = l.name;
      $('.line-meta', row).textContent = meta + (l.plan ? `. ${l.qty} bag${l.qty === 1 ? '' : 's'} per delivery.` : '');
      $('[data-dec]', row).addEventListener('click', () => setQty(l.key, l.qty - 1));
      $('[data-inc]', row).addEventListener('click', () => setQty(l.key, l.qty + 1));
      $('[data-remove]', row).addEventListener('click', () => setQty(l.key, 0));
      linesEl.appendChild(row);
    });
    $('[data-cart-subtotal]').textContent = money(t.subtotal);
    $('[data-cart-shipping]').textContent = t.shipping ? money(t.shipping) : 'Free';
    $('[data-cart-total]').textContent = money(t.total);
  }

  /* ---------- Drawer ---------- */
  const drawer = $('#cart');
  const scrim = $('[data-scrim]');
  const openBtn = $('[data-open-cart]');
  let lastFocus = null;

  function openCart() {
    lastFocus = document.activeElement;
    drawer.classList.add('open'); scrim.classList.add('open');
    document.body.classList.add('lock');
    openBtn.setAttribute('aria-expanded', 'true');
    setTimeout(() => drawer.focus(), 50);
  }
  function closeCart() {
    if (!drawer.classList.contains('open')) return;
    drawer.classList.remove('open'); scrim.classList.remove('open');
    document.body.classList.remove('lock');
    openBtn.setAttribute('aria-expanded', 'false');
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  openBtn.addEventListener('click', openCart);
  scrim.addEventListener('click', closeCart);
  document.addEventListener('click', e => { if (e.target.closest('[data-close-cart]')) closeCart(); });
  document.addEventListener('keydown', e => {
    if (!drawer.classList.contains('open')) return;
    if (e.key === 'Escape') closeCart();
    if (e.key === 'Tab') { // keep focus inside the drawer
      const f = $$('button:not([disabled]), a[href], select', drawer).filter(el => el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === drawer)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- Toast ---------- */
  const toast = $('[data-toast]');
  let toastTimer;
  function notify(text) {
    toast.textContent = text;
    const view = document.createElement('button');
    view.type = 'button'; view.textContent = 'View cart';
    view.addEventListener('click', () => { toast.classList.remove('show'); openCart(); });
    toast.appendChild(view);
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
  }

  /* ---------- Product cards ---------- */
  $$('[data-product]').forEach(card => {
    $('[data-add]', card).addEventListener('click', () => {
      const grind = $('[data-grind]', card).value;
      addLine({ id: card.dataset.id, name: card.dataset.name, grind, plan: null, price: Number(card.dataset.price), qty: 1 });
      notify(`Added ${card.dataset.name}, ${grind.toLowerCase()}.`);
    });
  });

  /* ---------- Subscription builder ---------- */
  const form = $('[data-builder]');
  function readBuilder() {
    const opt = form.coffee.selectedOptions[0];
    const bag = round2(Number(opt.dataset.price) * (1 - SUB_DISCOUNT));
    const bags = Number(form.bags.value);
    return { id: 'sub-' + opt.value, name: opt.dataset.name, bag, bags, freq: form.freq.value, grind: form.grind.value };
  }
  function updateBuilder() {
    const b = readBuilder();
    $('[data-sum="bag"]', form).textContent = money(b.bag);
    $('[data-sum="total"]', form).textContent = money(b.bag * b.bags);
  }
  form.addEventListener('change', updateBuilder);
  form.addEventListener('submit', e => {
    e.preventDefault();
    const b = readBuilder();
    addLine({ id: b.id, name: b.name + ' subscription', grind: b.grind, plan: b.freq, price: b.bag, qty: b.bags });
    notify(`Added a subscription, every ${b.freq} weeks.`);
  });
  updateBuilder();

  /* ---------- Roast week: steps drive the status panel ---------- */
  const steps = $$('.step');
  const statusItems = $$('[data-status] li');
  function showStep(i) {
    steps.forEach((s, j) => s.classList.toggle('is-active', j === i));
    statusItems.forEach((li, j) => {
      li.classList.toggle('done', j < i);
      li.classList.toggle('now', j === i);
    });
  }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) showStep(Number(e.target.dataset.step)); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    steps.forEach(s => io.observe(s));
  } else {
    steps.forEach(s => s.classList.add('is-active'));
  }

  render();
})();
