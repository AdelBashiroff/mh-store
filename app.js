/* M&H — логика магазина: роутер, каталог, корзина, оформление заказа. Без зависимостей. */
(function () {
    'use strict';

    /* ===================== Утилиты ===================== */
    const $ = (s, r = document) => r.querySelector(s);
    const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
    const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const fmt = n => Math.round(n).toLocaleString('ru-RU') + ' ₽';
    const byId = id => PRODUCTS.find(p => p.id === id);
    const plural = (n, f) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; };
    const rnd = arr => arr[Math.floor(Math.random() * arr.length)];
    const hash = s => Array.from(s).reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
    const dateRu = (ts, o) => new Date(ts).toLocaleDateString('ru-RU', o || { day: 'numeric', month: 'long' });

    const store = {
        get(k, d) { try { const v = localStorage.getItem('mh.' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
        set(k, v) { try { localStorage.setItem('mh.' + k, JSON.stringify(v)); } catch (e) { /* без хранилища тоже работаем */ } }
    };

    let cart = store.get('cart', []);      // [{pid, color, size, qty}]
    let wish = store.get('wish', []);      // [pid]
    let orders = store.get('orders', []);
    let promo = store.get('promo', null);  // код
    let noScroll = false;
    let timers = [];

    const STAGE_SEC = 8;
    const PAGE = 12;

    /* ===================== Картинки и рейтинг ===================== */
    function art(p, ci, o) {
        const c = p.colors[ci] || p.colors[0];
        return MH_ART.garment(p.type, c.h, Object.assign({ print: p.print, variant: p.variant, label: p.name }, o));
    }
    function reviewsOf(p) {
        const own = (store.get('rev', {})[p.id] || []);
        return own.concat(p.rev.map(([name, stars, text]) => ({ name, stars, text })));
    }
    function ratingOf(p) {
        const r = reviewsOf(p);
        return { avg: r.reduce((a, x) => a + x.stars, 0) / r.length, n: r.length };
    }
    const stars = n => '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));
    const discount = p => p.old ? Math.round((1 - p.price / p.old) * 100) : 0;
    const catName = id => (CATEGORIES[id] || {}).name || '';

    /* ===================== Уведомления ===================== */
    function toast(msg, kind) {
        const el = document.createElement('div');
        el.className = 'toast' + (kind ? ' ' + kind : '');
        el.textContent = msg;
        $('#toasts').appendChild(el);
        requestAnimationFrame(() => el.classList.add('in'));
        setTimeout(() => { el.classList.remove('in'); setTimeout(() => el.remove(), 300); }, 3200);
    }

    /* ===================== Корзина ===================== */
    const itemKey = i => `${i.pid}|${i.color}|${i.size}`;

    function cartSub() { return cart.reduce((s, i) => s + byId(i.pid).price * i.qty, 0); }
    function cartCount() { return cart.reduce((s, i) => s + i.qty, 0); }

    function promoInfo(sub) {
        if (!promo || !PROMOS[promo]) return null;
        const pr = PROMOS[promo];
        if (pr.min && sub < pr.min) return { code: promo, amount: 0, label: pr.label, note: `Нужно ещё ${fmt(pr.min - sub)} до порога` };
        const amount = pr.pct ? Math.round(sub * pr.pct / 100) : Math.min(pr.fixed, sub);
        return { code: promo, amount, label: pr.label };
    }

    function totals(deliveryId) {
        const sub = cartSub();
        const pr = promoInfo(sub);
        const disc = pr ? pr.amount : 0;
        const after = sub - disc;
        const d = DELIVERY[deliveryId || 'courier'];
        const free = after >= FREE_SHIPPING;
        const ship = !sub ? 0 : (free && d.fee > 0 ? 0 : d.fee);
        return { sub, disc, after, ship, total: after + ship, free, pr };
    }

    function saveCart() {
        store.set('cart', cart);
        const n = cartCount();
        const b = $('#cart-count');
        b.textContent = n; b.hidden = !n;
        if (isCartOpen()) renderDrawer();
    }
    function saveWish() {
        store.set('wish', wish);
        const b = $('#wish-count');
        b.textContent = wish.length; b.hidden = !wish.length;
    }

    function addToCart(pid, color, size, qty) {
        const it = { pid, color, size, qty: qty || 1 };
        const ex = cart.find(i => itemKey(i) === itemKey(it));
        if (ex) ex.qty = Math.min(10, ex.qty + it.qty); else cart.push(it);
        saveCart();
    }

    function toggleWish(pid) {
        const i = wish.indexOf(pid);
        if (i >= 0) { wish.splice(i, 1); toast('Убрали из избранного. Вещь не обиделась.'); }
        else { wish.push(pid); toast('Добавили в избранное. Будем хранить, пока вы решаетесь.'); }
        saveWish();
        $$(`[data-act="wish"][data-id="${pid}"]`).forEach(b => { b.classList.toggle('on', i < 0); b.setAttribute('aria-pressed', i < 0); });
        if (route().name === 'wishlist') render();
    }

    /* ===================== Шаблоны карточек ===================== */
    function swatches(p, max) {
        return p.colors.slice(0, max || 4).map(c => `<i style="background:${c.h}" title="${esc(c.n)}"></i>`).join('');
    }
    function priceHTML(p) {
        return `<span class="price-now">${fmt(p.price)}</span>${p.old ? `<s class="price-old">${fmt(p.old)}</s>` : ''}`;
    }
    const heart = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.5-8.5-9A4.7 4.7 0 0112 6.6 4.7 4.7 0 0120.5 11C19 15.5 12 20 12 20z"/></svg>';

    function card(p) {
        const on = wish.includes(p.id);
        const r = ratingOf(p);
        const tagCls = p.tag && p.tag[0] === '−' ? 'sale' : '';
        return `<article class="card" style="--bg:${p.bg}">
    <a class="card-img" href="#/product/${p.id}" aria-label="${esc(p.name)}">${art(p)}${p.tag ? `<span class="tag ${tagCls}">${esc(p.tag)}</span>` : ''}</a>
    <button class="wish ${on ? 'on' : ''}" data-act="wish" data-id="${p.id}" aria-label="В избранное" aria-pressed="${on}">${heart}</button>
    <button class="quick" data-act="quick" data-id="${p.id}">Быстрый просмотр</button>
    <div class="card-body">
        <a class="card-name" href="#/product/${p.id}">${esc(p.name)}</a>
        <div class="card-meta"><span class="swatches">${swatches(p)}</span><span class="rate"><b>★</b> ${r.avg.toFixed(1)} <small>(${r.n})</small></span></div>
        <div class="price">${priceHTML(p)}</div>
    </div>
</article>`;
    }

    function grid(list) { return `<div class="grid">${list.map(card).join('')}</div>`; }

    /* ===================== Роутер ===================== */
    function route() {
        const h = location.hash.slice(1) || '/';
        const [path, qs] = h.split('?');
        const q = Object.fromEntries(new URLSearchParams(qs || ''));
        const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
        const name = !parts.length ? 'home' : parts[0];
        return { name, id: parts[1], q };
    }

    function stopTimers() { timers.forEach(clearInterval); timers = []; }

    function render() {
        stopTimers();
        const r = route();
        const v = $('#view');
        let out;
        switch (r.name) {
            case 'home': out = viewHome(); break;
            case 'catalog': out = viewCatalog(r.q); break;
            case 'product': out = viewProduct(r.id); break;
            case 'wishlist': out = viewWishlist(); break;
            case 'checkout': out = viewCheckout(); break;
            case 'orders': out = viewOrders(); break;
            case 'order': out = viewOrder(r.id); break;
            case 'about': out = viewAbout(); break;
            default: out = view404();
        }
        document.title = out.title ? `${out.title} — M&H` : 'M&H — интернет-магазин одежды (пародия)';
        v.innerHTML = out.html;
        if (!noScroll) window.scrollTo(0, 0);
        noScroll = false;
        closeMenu();
        if (out.after) out.after();
        revealOnScroll();
    }

    function revealOnScroll() {
        const els = $$('.reveal:not(.in)');
        if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
        const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: 0.08 });
        els.forEach(e => io.observe(e));
    }

    /* ===================== Главная ===================== */
    function viewHome() {
        const hits = PRODUCTS.slice().sort((a, b) => b.pop - a.pop).slice(0, 8);
        const sale = PRODUCTS.filter(p => p.old).sort((a, b) => discount(b) - discount(a)).slice(0, 4);
        const catTiles = Object.entries(CATEGORIES).map(([id, c]) => `
<a class="cat-tile reveal" href="#/catalog?cat=${id}" style="--bg:${c.bg}">
    <div class="cat-art">${MH_ART.garment(c.type, c.hex, { print: c.print, variant: c.variant, label: c.name })}</div>
    <div class="cat-text"><h3>${c.name}</h3><p>${c.joke}</p></div>
</a>`).join('');
        return {
            title: '', html: `
<section class="hero">
    <div class="hero-text">
        <span class="eyebrow">Осень–зима 2026 / «ещё не решили»</span>
        <h1>Это не H&amp;M.<br>Это <span class="mirror-word"><em>M</em>&amp;<em>H</em></span>.</h1>
        <p>Одежда, которая очень похожа на ту, про которую вы подумали. Но с другой буквой впереди, другими названиями и гораздо более справедливыми ценами.</p>
        <div class="hero-cta">
            <a class="btn" href="#/catalog">Смотреть коллекцию</a>
            <button class="btn ghost" data-act="toggle-mirror">Отзеркалить сайт</button>
        </div>
    </div>
    <div class="hero-art" aria-hidden="true">
        <div class="mirror-line"></div>
        <div class="hero-item l">${MH_ART.garment('tee', '#f4f4f4', { print: { lines: ['ЭТО', 'НЕ H&M'] } })}</div>
        <div class="hero-item r">${MH_ART.garment('tee', '#f4f4f4', { print: { lines: ['ЭТО', 'НЕ H&M'] }, mirror: true })}</div>
        <div class="hero-tag a">Нас часто путают</div>
        <div class="hero-tag b">Мы тоже иногда</div>
    </div>
</section>

<section class="sale-strip reveal">
    <div><b>Распродажа до −50%</b><span>заканчивается через <span class="cd">02:14:59</span> и начинается снова</span></div>
    <a class="btn white" href="#/catalog?sale=1">К скидкам</a>
</section>

<section class="block reveal">
    <div class="block-head"><h2>Выберите, для кого</h2><p>Или для чего. Мы не осуждаем.</p></div>
    <div class="cat-grid">${catTiles}</div>
</section>

<section class="block reveal">
    <div class="block-head"><h2>Бестселлеры</h2><a class="link" href="#/catalog?sort=pop">Весь каталог →</a></div>
    ${grid(hits)}
</section>

<section class="banner reveal">
    <div class="banner-text">
        <span class="eyebrow">M&amp;H Conscious</span>
        <h2>Мы осознаём, что вы это покупаете.</h2>
        <p>Каждая вещь M&amp;H сделана с осознанием: мы осознаём, что она вам нужна ещё меньше, чем вам кажется. Зато стоит дешевле, чем вы боялись.</p>
        <a class="btn white" href="#/about">Узнать больше (или нет)</a>
    </div>
    <div class="banner-art" aria-hidden="true">${MH_ART.garment('sweater', '#1e3a5f', { label: '' })}</div>
</section>

<section class="block reveal">
    <div class="block-head"><h2>Со скидкой, которая выглядит убедительно</h2><a class="link" href="#/catalog?sale=1">Все скидки →</a></div>
    ${grid(sale)}
</section>

<section class="perks reveal">
    <div><b>Бесплатная доставка</b><span>от ${fmt(FREE_SHIPPING)}</span></div>
    <div><b>30 дней на возврат</b><span>если вещь ещё помнит магазин</span></div>
    <div><b>Подарочная упаковка</b><span>это тоже пакет, но с бантиком</span></div>
    <div><b>Поддержка 24/7</b><span>иногда отвечает</span></div>
</section>

<section class="member reveal">
    <div>
        <h2>Клуб M&amp;H Member</h2>
        <p>Подпишитесь — и получите промокод и еженедельное письмо о том, что скидки «вот-вот закончатся». Отписаться можно. Но зачем?</p>
    </div>
    <form class="member-form" data-form="newsletter" novalidate>
        <input type="email" name="email" placeholder="Ваш e-mail" aria-label="E-mail" required>
        <button class="btn" type="submit">Вступить в клуб</button>
        <p class="form-err" hidden></p>
    </form>
</section>`,
            after() { tickCountdown(); }
        };
    }

    /* ===================== Каталог ===================== */
    function qs(obj) {
        const s = new URLSearchParams();
        Object.entries(obj).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) s.set(k, v); });
        const t = s.toString();
        return t ? '?' + t : '';
    }

    function filterProducts(q) {
        let list = PRODUCTS.slice();
        if (q.cat) list = list.filter(p => p.cat === q.cat);
        if (q.q) {
            const tokens = q.q.toLowerCase().split(/\s+/).filter(Boolean);
            list = list.filter(p => {
                const hay = (p.name + ' ' + p.desc + ' ' + catName(p.cat) + ' ' + p.colors.map(c => c.n).join(' ')).toLowerCase();
                return tokens.every(t => hay.includes(t));
            });
        }
        if (q.sale) list = list.filter(p => p.old);
        if (q.min) list = list.filter(p => p.price >= +q.min);
        if (q.max) list = list.filter(p => p.price <= +q.max);
        if (q.size) { const ss = q.size.split(','); list = list.filter(p => ss.some(s => p.sizes.includes(s) && !p.out.includes(s))); }
        if (q.color) { const cs = q.color.split(','); list = list.filter(p => p.colors.some(c => cs.includes(c.f))); }
        const sorts = {
            pop: (a, b) => b.pop - a.pop,
            'price-asc': (a, b) => a.price - b.price,
            'price-desc': (a, b) => b.price - a.price,
            disc: (a, b) => discount(b) - discount(a),
            rate: (a, b) => ratingOf(b).avg - ratingOf(a).avg
        };
        list.sort(sorts[q.sort] || sorts.pop);
        return list;
    }

    const COLOR_FAMS = [['white', 'Белый', '#f4f4f4'], ['black', 'Чёрный', '#1a1a1a'], ['grey', 'Серый', '#9aa0a6'], ['beige', 'Бежевый', '#e9d6c4'],
    ['red', 'Красный', '#c0283d'], ['pink', 'Розовый', '#e8b4bc'], ['blue', 'Синий', '#2c4a7c'], ['green', 'Зелёный', '#4f7d5a'], ['yellow', 'Жёлтый', '#f2c14e']];
    const ALL_SIZES = ['XS', 'S', 'M', 'H', 'XL', 'Один размер', '98', '104', '110', '116', '122', '40', '41', '42', '43', '44', '45', 'Кот-XL'];

    function viewCatalog(q) {
        const list = filterProducts(q);
        const page = Math.max(1, +q.page || 1);
        const shown = list.slice(0, page * PAGE);
        const cur = (extra) => '#/catalog' + qs(Object.assign({}, q, { page: '' }, extra));
        const sel = k => (q[k] || '').split(',').filter(Boolean);
        const sizeSel = sel('size'), colSel = sel('color');
        const toggleIn = (arr, v) => (arr.includes(v) ? arr.filter(x => x !== v) : arr.concat(v)).join(',');
        const activeCount = [q.cat, q.sale, q.min, q.max, q.size, q.color].filter(Boolean).length;
        const hm = q.q && /^(h\s*&\s*m|н\s*&\s*м|hm|хм)$/i.test(q.q.trim());
        const title = q.q ? `Поиск: ${q.q}` : q.cat ? catName(q.cat) : q.sale ? 'Распродажа' : 'Каталог';

        const cats = Object.entries(CATEGORIES).map(([id, c]) =>
            `<a class="chip ${q.cat === id ? 'on' : ''}" href="${cur({ cat: q.cat === id ? '' : id })}">${c.name}</a>`).join('');
        const sizes = ALL_SIZES.filter(s => PRODUCTS.some(p => p.sizes.includes(s))).map(s =>
            `<a class="size-chip ${sizeSel.includes(s) ? 'on' : ''}" href="${cur({ size: toggleIn(sizeSel, s) })}">${s}</a>`).join('');
        const cols = COLOR_FAMS.filter(([f]) => PRODUCTS.some(p => p.colors.some(c => c.f === f))).map(([f, n, h]) =>
            `<a class="col-chip ${colSel.includes(f) ? 'on' : ''}" href="${cur({ color: toggleIn(colSel, f) })}" title="${n}" style="--c:${h}" aria-label="${n}"></a>`).join('');

        const empty = `<div class="empty">
    <div class="empty-art">${MH_ART.garment('socks', '#e8e1d4', { print: {} })}</div>
    <h3>${q.q ? `По запросу «${esc(q.q)}» ничего нет` : 'Под такие фильтры ничего не подошло'}</h3>
    <p>${q.q ? 'Мы тоже иногда не знаем, что искать. Попробуйте «футболка», «кот» или «носок».' : 'Возможно, вы слишком требовательны. Или мы слишком странные.'}</p>
    <a class="btn" href="#/catalog">Сбросить всё</a>
</div>`;

        return {
            title, html: `
<section class="page-head">
    <nav class="crumbs"><a href="#/">Главная</a><span>/</span><span>${esc(title)}</span></nav>
    <h1>${esc(title)}</h1>
    ${hm ? `<p class="hm-note">Вы искали H&amp;M? Мы — M&amp;H. Другая буква, другой магазин, другая жизнь. Но раз уж вы здесь — вот всё, что у нас есть.</p>` : ''}
</section>
<div class="cat-layout">
    <aside class="filters" id="filters">
        <div class="filters-head"><b>Фильтры${activeCount ? ` (${activeCount})` : ''}</b><button class="icon-btn only-mobile" data-act="toggle-filters" aria-label="Закрыть">✕</button></div>
        <div class="f-group"><h4>Категория</h4><div class="chips">${cats}</div></div>
        <div class="f-group"><h4>Цена, ₽</h4>
            <form class="price-range" data-form="price">
                <input type="number" name="min" placeholder="от" min="0" value="${esc(q.min || '')}" aria-label="Цена от">
                <span>—</span>
                <input type="number" name="max" placeholder="до" min="0" value="${esc(q.max || '')}" aria-label="Цена до">
                <button class="btn small" type="submit">ОК</button>
            </form>
        </div>
        <div class="f-group"><h4>Размер</h4><div class="chips">${sizes}</div></div>
        <div class="f-group"><h4>Цвет</h4><div class="col-chips">${cols}</div></div>
        <div class="f-group"><a class="chip ${q.sale ? 'on' : ''}" href="${cur({ sale: q.sale ? '' : '1' })}">Только со скидкой</a></div>
        ${activeCount ? `<a class="link" href="#/catalog${q.q ? qs({ q: q.q }) : ''}">Сбросить фильтры</a>` : ''}
    </aside>
    <div class="results">
        <div class="results-bar">
            <button class="btn ghost small only-mobile" data-act="toggle-filters">Фильтры${activeCount ? ` (${activeCount})` : ''}</button>
            <span class="count">${list.length} ${plural(list.length, ['товар', 'товара', 'товаров'])}</span>
            <label class="sort">Сортировка
                <select data-change="sort" aria-label="Сортировка">
                    ${[['pop', 'Популярные'], ['price-asc', 'Сначала дешёвые'], ['price-desc', 'Сначала дорогие'], ['disc', 'По размеру скидки'], ['rate', 'По рейтингу']].map(([v, n]) => `<option value="${v}" ${(q.sort || 'pop') === v ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
            </label>
        </div>
        ${list.length ? grid(shown) : empty}
        ${shown.length < list.length ? `<div class="more"><a class="btn ghost" href="${cur({ page: page + 1 })}" data-keep>Показать ещё (${list.length - shown.length})</a></div>` : ''}
    </div>
</div>`
        };
    }

    /* ===================== Страница товара ===================== */
    let pv = null; // состояние страницы товара

    function stockNote(p) {
        const notes = ['Осталось 3 штуки. (На складе ещё 4000, но мы этого не говорили.)', 'Последняя штука. Серьёзно. Ну, почти.', 'Сейчас эту вещь смотрит 1 человек. Это вы.', 'В корзинах у 14 человек. Они тоже сомневаются.', 'Скоро закончится. Или нет. Мы сами не знаем.'];
        return notes[hash(p.id) % notes.length];
    }

    function viewProduct(id) {
        const p = byId(id);
        if (!p) return view404();
        pv = { id, color: 0, size: p.sizes.length === 1 ? p.sizes[0] : '', qty: 1, view: 'front' };
        const rel = PRODUCTS.filter(x => x.id !== p.id && x.cat === p.cat).concat(PRODUCTS.filter(x => x.cat !== p.cat && x.id !== p.id)).slice(0, 4);
        return {
            title: p.name, html: `
<section class="page-head">
    <nav class="crumbs"><a href="#/">Главная</a><span>/</span><a href="#/catalog?cat=${p.cat}">${catName(p.cat)}</a><span>/</span><span>${esc(p.name)}</span></nav>
</section>
<div id="pv-top" class="pv"></div>
<section class="block" id="reviews"></section>
<section class="block">
    <div class="block-head"><h2>С этим берут</h2></div>
    ${grid(rel)}
</section>`,
            after() { renderProductTop(); renderReviews(); }
        };
    }

    function renderProductTop() {
        const p = byId(pv.id);
        const el = $('#pv-top');
        if (!el) return;
        const c = p.colors[pv.color];
        const r = ratingOf(p);
        const d = discount(p);
        const on = wish.includes(p.id);
        const views = [['front', 'Спереди', {}], ['mirror', 'Сзади (то же самое)', { mirror: true }], ['detail', 'Деталь', { zoom: true }]];
        const main = views.find(v => v[0] === pv.view);
        const sizes = p.sizes.map(s => {
            const out = p.out.includes(s);
            return `<button class="size ${pv.size === s ? 'on' : ''} ${out ? 'out' : ''}" data-act="pick-size" data-size="${esc(s)}" ${out ? 'aria-disabled="true"' : ''} ${s === 'H' ? 'title="H — Hормально"' : ''}>${esc(s)}</button>`;
        }).join('');
        const eta = dateRu(Date.now() + 3 * 864e5);
        el.innerHTML = `
<div class="pv-gallery">
    <div class="pv-thumbs">${views.map(v => `<button class="pv-thumb ${pv.view === v[0] ? 'on' : ''}" data-act="pick-view" data-view="${v[0]}" style="--bg:${p.bg}" aria-label="${v[1]}">${art(p, pv.color, v[2])}</button>`).join('')}</div>
    <div class="pv-main" style="--bg:${p.bg}" id="pv-main">
        ${art(p, pv.color, main[2])}
        ${p.tag ? `<span class="tag ${p.tag[0] === '−' ? 'sale' : ''}">${esc(p.tag)}</span>` : ''}
        <span class="pv-cap">${main[1]}</span>
    </div>
</div>
<div class="pv-info">
    <h1>${esc(p.name)}</h1>
    <a class="pv-rate" href="#reviews" data-act="to-reviews"><b>${stars(r.avg)}</b> ${r.avg.toFixed(1)} · ${r.n} ${plural(r.n, ['отзыв', 'отзыва', 'отзывов'])}</a>
    <div class="pv-price">${priceHTML(p)}${d ? `<span class="tag sale inline">−${d}%</span>` : ''}</div>
    <p class="pv-desc">${esc(p.desc)}</p>

    <div class="opt"><h4>Цвет: <span>${esc(c.n)}</span></h4>
        <div class="pv-colors">${p.colors.map((x, i) => `<button class="pv-col ${i === pv.color ? 'on' : ''}" data-act="pick-color" data-i="${i}" style="--c:${x.h}" aria-label="${esc(x.n)}" title="${esc(x.n)}"></button>`).join('')}</div>
    </div>
    <div class="opt" id="size-opt"><h4>Размер ${p.sizes.length > 1 && p.sizes[0] === 'XS' ? '<button class="link-btn" data-act="size-advisor">Подобрать размер</button>' : ''}</h4>
        <div class="pv-sizes">${sizes}</div>
        ${p.sizes.includes('H') ? '<p class="hint">H — между M и XL. Не спрашивайте, куда делась L.</p>' : ''}
    </div>
    <div class="buy">
        <div class="qty"><button data-act="qty-" aria-label="Меньше">−</button><span id="pv-qty">${pv.qty}</span><button data-act="qty+" aria-label="Больше">+</button></div>
        <button class="btn big" data-act="add-pv">В корзину · ${fmt(p.price * pv.qty)}</button>
        <button class="wish inline ${on ? 'on' : ''}" data-act="wish" data-id="${p.id}" aria-label="В избранное" aria-pressed="${on}">${heart}</button>
    </div>
    <p class="stock">● ${esc(stockNote(p))}</p>
    <ul class="pv-perks">
        <li>Доставим до ${eta}… или нет</li>
        <li>Бесплатно от ${fmt(FREE_SHIPPING)} · возврат 30 дней</li>
    </ul>
    <details class="acc" open><summary>Описание</summary><ul>${p.details.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>
    <details class="acc"><summary>Состав и уход</summary><p>${esc(p.comp)}</p><p>Стирка при 30°. Если сядет — значит, так и было задумано.</p></details>
    <details class="acc"><summary>Доставка и возврат</summary><p>Курьером, в пункт выдачи или оставим у соседа (с вас пирожок). Вернуть можно в течение 30 дней, если вещь ещё помнит запах магазина.</p></details>
</div>`;
    }

    function renderReviews() {
        const p = byId(pv.id);
        const el = $('#reviews');
        if (!el) return;
        const rs = reviewsOf(p);
        const r = ratingOf(p);
        const dist = [5, 4, 3, 2, 1].map(n => {
            const c = rs.filter(x => x.stars === n).length;
            return `<div class="bar"><span>${n}★</span><i><b style="width:${rs.length ? c / rs.length * 100 : 0}%"></b></i><small>${c}</small></div>`;
        }).join('');
        el.innerHTML = `
<div class="block-head"><h2>Отзывы</h2></div>
<div class="rev-layout">
    <div class="rev-sum"><div class="rev-big">${r.avg.toFixed(1)}</div><div class="rev-stars">${stars(r.avg)}</div><small>${r.n} ${plural(r.n, ['отзыв', 'отзыва', 'отзывов'])}</small>${dist}</div>
    <div class="rev-list">${rs.map(x => `<div class="rev"><div class="rev-top"><b>${esc(x.name)}</b><span class="rev-stars">${stars(x.stars)}</span></div><p>${esc(x.text)}</p></div>`).join('')}</div>
    <form class="rev-form" data-form="review" novalidate>
        <h4>Оставить отзыв</h4>
        <input name="name" placeholder="Ваше имя" maxlength="30" aria-label="Имя">
        <div class="star-pick" role="radiogroup" aria-label="Оценка">${[5, 4, 3, 2, 1].map(n => `<input type="radio" id="st${n}" name="stars" value="${n}"><label for="st${n}" title="${n}">★</label>`).join('')}</div>
        <textarea name="text" rows="3" maxlength="300" placeholder="Что думаете? Честно, но не слишком" aria-label="Текст отзыва"></textarea>
        <p class="form-err" hidden></p>
        <button class="btn" type="submit">Отправить</button>
    </form>
</div>`;
    }

    /* ===================== Избранное ===================== */
    function viewWishlist() {
        const list = wish.map(byId).filter(Boolean);
        return {
            title: 'Избранное', html: `
<section class="page-head"><nav class="crumbs"><a href="#/">Главная</a><span>/</span><span>Избранное</span></nav><h1>Избранное</h1></section>
<section class="block">${list.length ? grid(list) : `<div class="empty"><div class="empty-art">${MH_ART.garment('tee', '#e8b4bc', {})}</div><h3>Тут пока пусто</h3><p>Нажмите на сердечко у вещи — она будет ждать вас здесь. Ждать вещи умеют лучше людей.</p><a class="btn" href="#/catalog">В каталог</a></div>`}</section>`
        };
    }

    /* ===================== Оформление заказа ===================== */
    const PICKUPS = ['Пункт «У Вити» — ул. Зеркальная, 1', 'Постамат «Не тот» — пр. Отражения, 14', 'Магазин M&H — ТЦ «Мы тут». Мы тут', 'Окно выдачи «Подождите» — ул. Очередная, 7'];
    let co = { delivery: 'courier', pay: 'card' };

    function viewCheckout() {
        if (!cart.length) { setTimeout(() => { toast('В корзине пусто — оформлять нечего. Это не упрёк.'); location.hash = '#/catalog'; }, 0); return { title: 'Оформление', html: '' }; }
        co = { delivery: 'courier', pay: 'card' };
        return {
            title: 'Оформление заказа', html: `
<section class="page-head"><nav class="crumbs"><a href="#/">Главная</a><span>/</span><span>Оформление заказа</span></nav><h1>Оформление заказа</h1></section>
<div class="demo-note">Демо-режим: деньги не списываются, данные никуда не отправляются и нигде, кроме вашего браузера, не хранятся.</div>
<div class="co-layout">
    <form class="co-form" id="co-form" data-form="checkout" novalidate>
        <fieldset><legend>1. Кто вы</legend>
            <div class="field"><label for="f-name">Имя и фамилия</label><input id="f-name" name="name" autocomplete="name" placeholder="Мавродий Хенрикович"><small class="err"></small></div>
            <div class="row2">
                <div class="field"><label for="f-phone">Телефон</label><input id="f-phone" name="phone" type="tel" autocomplete="tel" placeholder="+7 (900) 000-00-00" inputmode="tel"><small class="err"></small></div>
                <div class="field"><label for="f-email">E-mail</label><input id="f-email" name="email" type="email" autocomplete="email" placeholder="you@example.com"><small class="err"></small></div>
            </div>
        </fieldset>

        <fieldset><legend>2. Доставка</legend>
            <div class="options" id="opt-delivery">
                ${Object.entries(DELIVERY).map(([id, d]) => `<label class="option ${id === co.delivery ? 'on' : ''}"><input type="radio" name="delivery" value="${id}" ${id === co.delivery ? 'checked' : ''}><span><b>${d.name}</b><small>${d.note}</small></span><em data-fee="${id}"></em></label>`).join('')}
            </div>
            <div id="addr-box"></div>
        </fieldset>

        <fieldset><legend>3. Оплата</legend>
            <div class="options" id="opt-pay">
                <label class="option on"><input type="radio" name="pay" value="card" checked><span><b>Картой онлайн</b><small>Деньги не спишутся, это демо</small></span></label>
                <label class="option"><input type="radio" name="pay" value="cash"><span><b>При получении</b><small>Наличными или картой курьеру</small></span></label>
                <label class="option"><input type="radio" name="pay" value="compliment"><span><b>Комплиментом кассиру</b><small>Принимаются искренние</small></span></label>
            </div>
            <div id="pay-box"></div>
        </fieldset>

        <fieldset><legend>4. Комментарий</legend>
            <div class="field"><textarea name="comment" rows="2" placeholder="Например: «звоните в дверь, а не в душу»" maxlength="200"></textarea></div>
        </fieldset>

        <label class="agree"><input type="checkbox" name="agree"><span>Я согласен(а) с условиями и понимаю, что это пародия</span></label>
        <small class="err" id="agree-err"></small>
        <button class="btn big" type="submit">Оформить заказ</button>
    </form>
    <aside class="co-summary" id="co-summary"></aside>
</div>`,
            after() { renderAddrBox(); renderPayBox(); renderSummary(); }
        };
    }

    function renderAddrBox() {
        const box = $('#addr-box'); if (!box) return;
        if (co.delivery === 'courier') {
            box.innerHTML = `<div class="row2"><div class="field"><label for="f-city">Город</label><input id="f-city" name="city" autocomplete="address-level2" placeholder="Зазеркальск"><small class="err"></small></div>
<div class="field"><label for="f-street">Улица, дом, квартира</label><input id="f-street" name="street" autocomplete="street-address" placeholder="ул. Отражения, 5, кв. 12"><small class="err"></small></div></div>`;
        } else if (co.delivery === 'pickup') {
            box.innerHTML = `<div class="field"><label for="f-point">Пункт выдачи</label><select id="f-point" name="point">${PICKUPS.map(x => `<option>${esc(x)}</option>`).join('')}</select></div>`;
        } else {
            box.innerHTML = `<div class="field"><label for="f-street">Адрес соседа (или ваш, сосед разберётся)</label><input id="f-street" name="street" placeholder="ул. Отражения, 5, кв. 11"><small class="err"></small></div>`;
        }
    }

    function renderPayBox() {
        const box = $('#pay-box'); if (!box) return;
        if (co.pay === 'card') {
            box.innerHTML = `<div class="field"><label for="f-card">Номер карты</label><input id="f-card" name="card" inputmode="numeric" autocomplete="off" placeholder="0000 0000 0000 0000" maxlength="19"><small class="err"></small></div>
<div class="row2"><div class="field"><label for="f-exp">Срок</label><input id="f-exp" name="exp" inputmode="numeric" autocomplete="off" placeholder="ММ/ГГ" maxlength="5"><small class="err"></small></div>
<div class="field"><label for="f-cvc">CVC</label><input id="f-cvc" name="cvc" inputmode="numeric" autocomplete="off" placeholder="123" maxlength="3"><small class="err"></small></div></div>
<button type="button" class="link-btn" data-act="fill-card">Подставить тестовую карту</button>`;
        } else if (co.pay === 'cash') {
            box.innerHTML = '<p class="hint">Приготовьте сдачу. Курьер не обязан её иметь, но будет очень стараться.</p>';
        } else {
            box.innerHTML = `<div class="field"><label for="f-comp">Ваш комплимент (от 10 символов)</label><textarea id="f-comp" name="compliment" rows="2" placeholder="У вас отличная касса!"></textarea><small class="err"></small></div>`;
        }
    }

    function renderSummary() {
        const el = $('#co-summary'); if (!el) return;
        const t = totals(co.delivery);
        el.innerHTML = `<h3>Ваш заказ</h3>
<div class="sum-items">${cart.map(i => { const p = byId(i.pid); return `<div class="sum-item"><div class="thumb" style="--bg:${p.bg}">${art(p, i.color)}</div><div><b>${esc(p.name)}</b><small>${esc(p.colors[i.color].n)} · ${esc(i.size)} · ×${i.qty}</small></div><span>${fmt(p.price * i.qty)}</span></div>`; }).join('')}</div>
${totalsHTML(t)}
<a class="link" href="#/catalog">← Вернуться к покупкам</a>`;
        Object.keys(DELIVERY).forEach(id => {
            const em = $(`[data-fee="${id}"]`);
            if (em) { const d = DELIVERY[id]; em.textContent = !t.sub ? '' : (d.fee === 0 ? '0 ₽' : (t.after >= FREE_SHIPPING ? 'бесплатно' : fmt(d.fee))); }
        });
    }

    function totalsHTML(t) {
        return `<dl class="totals">
<div><dt>Товары</dt><dd>${fmt(t.sub)}</dd></div>
${t.pr ? `<div class="disc"><dt>Промокод ${esc(t.pr.code)}</dt><dd>${t.pr.amount ? '−' + fmt(t.pr.amount) : '—'}</dd></div>` : ''}
<div><dt>Доставка</dt><dd>${t.ship === 0 ? 'бесплатно' : fmt(t.ship)}</dd></div>
<div class="grand"><dt>Итого</dt><dd>${fmt(t.total)}</dd></div></dl>`;
    }

    // Алгоритм Луна
    function luhn(num) {
        let s = 0, alt = false;
        for (let i = num.length - 1; i >= 0; i--) { let d = +num[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; }
        return s % 10 === 0;
    }

    function setErr(input, msg) {
        const f = input.closest('.field');
        if (!f) return;
        f.classList.toggle('bad', !!msg);
        const e = $('.err', f); if (e) e.textContent = msg || '';
    }

    function validateCheckout(form) {
        const v = n => (form.elements[n] ? form.elements[n].value.trim() : '');
        let first = null;
        const check = (name, ok, msg) => {
            const el = form.elements[name]; if (!el) return;
            setErr(el, ok ? '' : msg);
            if (!ok && !first) first = el;
        };
        check('name', v('name').split(/\s+/).filter(Boolean).length >= 2 && v('name').length >= 5, 'Введите имя и фамилию');
        check('phone', v('phone').replace(/\D/g, '').length >= 10, 'Телефон: минимум 10 цифр');
        check('email', /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v('email')), 'Похоже на неполный e-mail');
        if (co.delivery === 'courier') { check('city', v('city').length >= 2, 'Укажите город'); check('street', v('street').length >= 5, 'Укажите улицу и дом'); }
        if (co.delivery === 'neighbor') check('street', v('street').length >= 5, 'Укажите адрес');
        if (co.pay === 'card') {
            const num = v('card').replace(/\s/g, '');
            check('card', /^\d{16}$/.test(num) && luhn(num), 'Неверный номер карты');
            const m = v('exp').match(/^(\d{2})\/(\d{2})$/);
            const okExp = m && +m[1] >= 1 && +m[1] <= 12 && (2000 + +m[2]) * 12 + +m[1] >= new Date().getFullYear() * 12 + new Date().getMonth() + 1;
            check('exp', !!okExp, 'Срок: ММ/ГГ, не истёк');
            check('cvc', /^\d{3}$/.test(v('cvc')), '3 цифры');
        }
        if (co.pay === 'compliment') check('compliment', v('compliment').length >= 10, 'Минимум 10 символов. Мы чувствуем неискренность');
        const agree = form.elements.agree.checked;
        $('#agree-err').textContent = agree ? '' : 'Нужно согласие. Это быстро.';
        if (!agree && !first) first = form.elements.agree;
        if (first) { first.focus(); first.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
        return !first;
    }

    function placeOrder(form) {
        const v = n => (form.elements[n] ? form.elements[n].value.trim() : '');
        const t = totals(co.delivery);
        const id = 'MH-' + String(Math.floor(10000 + Math.random() * 89999));
        const order = {
            id, ts: Date.now(),
            items: cart.map(i => { const p = byId(i.pid); return { pid: i.pid, name: p.name, color: i.color, colorName: p.colors[i.color].n, size: i.size, qty: i.qty, price: p.price }; }),
            sub: t.sub, disc: t.disc, ship: t.ship, total: t.total, promo: t.pr ? t.pr.code : null,
            delivery: co.delivery, pay: co.pay,
            customer: { name: v('name'), phone: v('phone'), email: v('email') },
            address: co.delivery === 'pickup' ? v('point') : (co.delivery === 'courier' ? `${v('city')}, ${v('street')}` : v('street')),
            comment: v('comment')
        };
        orders.unshift(order);
        store.set('orders', orders);
        cart = []; promo = null; store.set('promo', null);
        saveCart();
        location.hash = '#/order/' + id + '?new=1';
    }

    /* ===================== Заказы ===================== */
    const stageOf = o => Math.min(STAGES.length - 1, Math.floor((Date.now() - o.ts) / 1000 / STAGE_SEC));

    function trackerHTML(o) {
        const s = stageOf(o);
        return `<ol class="tracker">${STAGES.map((t, i) => `<li class="${i < s ? 'done' : i === s ? 'cur' : ''}"><i></i><span>${t}</span></li>`).join('')}</ol>`;
    }

    function orderItemsHTML(o) {
        return `<div class="sum-items">${o.items.map(i => { const p = byId(i.pid) || { bg: '#eee', type: 'tee', colors: [{ h: '#ccc' }] }; return `<div class="sum-item"><div class="thumb" style="--bg:${p.bg}">${byId(i.pid) ? art(p, i.color) : ''}</div><div><b>${esc(i.name)}</b><small>${esc(i.colorName)} · ${esc(i.size)} · ×${i.qty}</small></div><span>${fmt(i.price * i.qty)}</span></div>`; }).join('')}</div>`;
    }

    function viewOrders() {
        const body = orders.length ? orders.map(o => `
<a class="order-row" href="#/order/${o.id}">
    <div><b>Заказ ${o.id}</b><small>${dateRu(o.ts, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</small></div>
    <div class="order-thumbs">${o.items.slice(0, 4).map(i => { const p = byId(i.pid); return p ? `<span style="--bg:${p.bg}">${art(p, i.color)}</span>` : ''; }).join('')}</div>
    <div class="status" data-stage-of="${o.id}">${esc(STAGES[stageOf(o)])}</div>
    <b>${fmt(o.total)}</b>
</a>`).join('') : `<div class="empty"><div class="empty-art">${MH_ART.garment('bag', '#e6dcc6', {})}</div><h3>Заказов пока нет</h3><p>Как и повода для радости на этой неделе. Но это поправимо.</p><a class="btn" href="#/catalog">Выбрать что-нибудь</a></div>`;
        return {
            title: 'Мои заказы', html: `
<section class="page-head"><nav class="crumbs"><a href="#/">Главная</a><span>/</span><span>Мои заказы</span></nav><h1>Мои заказы</h1></section>
<section class="block orders">${body}${orders.length ? '<button class="link-btn" data-act="clear-orders">Очистить историю заказов</button>' : ''}</section>`,
            after() { timers.push(setInterval(() => orders.forEach(o => { const e = $(`[data-stage-of="${o.id}"]`); if (e) e.textContent = STAGES[stageOf(o)]; }), 1000)); }
        };
    }

    function viewOrder(id) {
        const o = orders.find(x => x.id === id);
        if (!o) return view404('Такого заказа нет. Возможно, его потеряла служба доставки — это ещё не начиналось, а уже потеряла.');
        const fresh = /new=1/.test(location.hash);
        const dlv = DELIVERY[o.delivery];
        return {
            title: 'Заказ ' + o.id, html: `
<section class="page-head"><nav class="crumbs"><a href="#/">Главная</a><span>/</span><a href="#/orders">Мои заказы</a><span>/</span><span>${o.id}</span></nav></section>
<section class="success">
    ${fresh ? '<div class="confetti" id="confetti" aria-hidden="true"></div>' : ''}
    <div class="check"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24"/><path d="M14 27l8 8 16-17"/></svg></div>
    <h1>${fresh ? 'Спасибо за заказ!' : 'Заказ ' + o.id}</h1>
    <p class="success-sub">Номер заказа: <b>${o.id}</b> <button class="link-btn" data-act="copy" data-text="${o.id}">скопировать</button><br>${fresh ? `Мы отправили письмо на ${esc(o.customer.email)}. Ну, могли бы отправить.` : dateRu(o.ts, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
</section>
<div class="co-layout order-layout">
    <div>
        <div class="card-box"><h3>Где ваш заказ</h3><div id="tracker">${trackerHTML(o)}</div><p class="hint" id="tracker-note"></p></div>
        <div class="card-box"><h3>Детали</h3>
            <dl class="info"><div><dt>Получатель</dt><dd>${esc(o.customer.name)}, ${esc(o.customer.phone)}</dd></div>
            <div><dt>Доставка</dt><dd>${dlv.name}: ${esc(o.address)}</dd></div>
            <div><dt>Оплата</dt><dd>${{ card: 'Картой онлайн', cash: 'При получении', compliment: 'Комплиментом кассиру' }[o.pay]}</dd></div>
            ${o.comment ? `<div><dt>Комментарий</dt><dd>${esc(o.comment)}</dd></div>` : ''}</dl>
        </div>
    </div>
    <aside class="co-summary"><h3>Состав заказа</h3>${orderItemsHTML(o)}${totalsHTML({ sub: o.sub, pr: o.promo ? { code: o.promo, amount: o.disc } : null, ship: o.ship, total: o.total })}
        <a class="btn ghost" href="#/catalog">Продолжить покупки</a></aside>
</div>`,
            after() {
                if (fresh) { confetti(); history.replaceState(null, '', '#/order/' + id); }
                const upd = () => {
                    const t = $('#tracker'); if (!t) return;
                    t.innerHTML = trackerHTML(o);
                    const done = stageOf(o) === STAGES.length - 1;
                    $('#tracker-note').textContent = done ? 'Дальше всё зависит от вас и ближайшего окна.' : 'Статус обновляется в реальном времени. Ускорено в 10 000 раз, чтобы вы успели заметить.';
                };
                upd(); timers.push(setInterval(upd, 1000));
            }
        };
    }

    function confetti() {
        const box = $('#confetti'); if (!box) return;
        const colors = ['#e50010', '#111', '#fff', '#f2c14e', '#8fc1e3'];
        for (let i = 0; i < 46; i++) {
            const s = document.createElement('span');
            s.style.cssText = `left:${Math.random() * 100}%;background:${rnd(colors)};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.6 + Math.random() * 1.6}s;transform:rotate(${Math.random() * 360}deg)`;
            box.appendChild(s);
        }
        setTimeout(() => box.remove(), 4000);
    }

    /* ===================== О нас ===================== */
    function viewAbout() {
        const faq = [
            ['Вы случайно не H&M?', 'Нет. У нас другая буква впереди, другая цена и другое чувство юмора. Если вы нас с кем-то спутали — это нормально, мы даже запустили таблицу «Нас часто путают».'],
            ['Почему размер L называется H?', 'Потому что H — это «Hормально». Он находится между M и XL, и вопрос, куда делась L, нам задавать не стоит. Мы нервничаем.'],
            ['Как вернуть вещь?', 'В течение 30 дней, если она ещё помнит запах магазина и не успела стать вашим любимым предметом гардероба.'],
            ['Что значит «Один размер»?', 'Один размер, один на всех, один на одну ногу. Мы доверяем резинке.'],
            ['Почему носок «Левый» и «Тоже левый»?', 'Потому что правый потерялся ещё в производстве. Зато симметрия идеальная.'],
            ['Это настоящий магазин?', 'Нет, это демо-проект и пародия. Купить здесь ничего нельзя, деньги не списываются, а все вещи нарисованы кодом (SVG).']
        ];
        return {
            title: 'О нас', html: `
<section class="page-head"><nav class="crumbs"><a href="#/">Главная</a><span>/</span><span>О нас</span></nav><h1>О нас (и о сходстве)</h1></section>
<section class="about">
    <div class="about-lead">
        <p>M&amp;H основали двое друзей — Мавродий и Хенрик, которые при регистрации домена перепутали порядок букв и решили не исправлять.</p>
        <p>С тех пор мы делаем одежду, которая очень старается быть нормальной. Получается примерно в половине случаев — и мы честно об этом пишем в названиях.</p>
    </div>
    <div class="about-grid">
        <div class="card-box"><h3>Таблица размеров</h3>
            <table class="size-table"><thead><tr><th>Размер</th><th>Рост</th><th>Комментарий</th></tr></thead><tbody>
                <tr><td>XS</td><td>150–160</td><td>Для тех, кто в курсе</td></tr>
                <tr><td>S</td><td>160–168</td><td>Для тех, кто почти</td></tr>
                <tr><td>M</td><td>168–176</td><td>Стандарт</td></tr>
                <tr><td><b>H</b></td><td>176–184</td><td>«Hормально»</td></tr>
                <tr><td>XL</td><td>184+</td><td>Куда делась L — не обсуждается</td></tr></tbody></table>
        </div>
        <div class="card-box"><h3>Доставка и возврат</h3>
            <ul class="plain"><li>Курьер — ${fmt(DELIVERY.courier.fee)}, пункт выдачи — ${fmt(DELIVERY.pickup.fee)}</li><li>Бесплатно от ${fmt(FREE_SHIPPING)}</li><li>«Оставить у соседа» — 0 ₽, с вас пирожок</li><li>Возврат — 30 дней</li></ul>
        </div>
    </div>
    <h2 class="faq-title">Вопросы и ответы</h2>
    <div class="faq">${faq.map(([q, a]) => `<details class="acc"><summary>${q}</summary><p>${a}</p></details>`).join('')}</div>
</section>`
        };
    }

    function view404(msg) {
        return {
            title: 'Не найдено', html: `
<section class="empty page404"><div class="empty-art">${MH_ART.garment('socks', '#9aa0a6', {})}</div><h1>404</h1><h3>Эта страница ушла на примерку и не вернулась</h3><p>${msg || 'Скорее всего, ей просто что-то не подошло по размеру.'}</p><a class="btn" href="#/">На главную</a></section>`
        };
    }

    /* ===================== Корзина (drawer) ===================== */
    const isCartOpen = () => $('#drawer').classList.contains('open');

    function openCart() {
        renderDrawer();
        $('#drawer').classList.add('open'); $('#drawer').setAttribute('aria-hidden', 'false');
        $('#overlay').hidden = false; requestAnimationFrame(() => $('#overlay').classList.add('show'));
        document.body.classList.add('lock');
    }
    function closeCart() {
        $('#drawer').classList.remove('open'); $('#drawer').setAttribute('aria-hidden', 'true');
        if ($('#modal').hidden) { $('#overlay').classList.remove('show'); setTimeout(() => { if (!isCartOpen() && $('#modal').hidden) $('#overlay').hidden = true; }, 250); document.body.classList.remove('lock'); }
    }

    function renderDrawer() {
        const body = $('#drawer-body'), foot = $('#drawer-foot');
        const n = cartCount();
        $('#drawer-count').textContent = n ? `(${n})` : '';
        if (!cart.length) {
            body.innerHTML = `<div class="empty small"><div class="empty-art">${MH_ART.garment('bag', '#e6dcc6', {})}</div><h3>Корзина пуста</h3><p>Как и ваши планы на выходные. Но это можно исправить.</p><a class="btn" href="#/catalog" data-act="close-cart">Перейти в каталог</a></div>`;
            foot.innerHTML = '';
            return;
        }
        const t = totals('courier');
        const left = Math.max(0, FREE_SHIPPING - t.after);
        const pct = Math.min(100, t.after / FREE_SHIPPING * 100);
        body.innerHTML = `
<div class="ship-bar"><p>${left ? `До бесплатной доставки — ${fmt(left)}` : 'Бесплатная доставка включена. Ура!'}</p><i><b style="width:${pct}%"></b></i></div>
<ul class="cart-list">${cart.map((i, idx) => {
            const p = byId(i.pid);
            return `<li class="cart-item"><a class="thumb" href="#/product/${p.id}" data-act="close-cart" style="--bg:${p.bg}">${art(p, i.color)}</a>
<div class="ci-info"><a href="#/product/${p.id}" data-act="close-cart">${esc(p.name)}</a><small>${esc(p.colors[i.color].n)} · ${esc(i.size)}</small>
<div class="ci-row"><div class="qty small"><button data-act="cart-dec" data-i="${idx}" aria-label="Меньше">−</button><span>${i.qty}</span><button data-act="cart-inc" data-i="${idx}" aria-label="Больше">+</button></div><b>${fmt(p.price * i.qty)}</b></div></div>
<button class="ci-del" data-act="cart-del" data-i="${idx}" aria-label="Удалить">✕</button></li>`;
        }).join('')}</ul>`;
        foot.innerHTML = `
<form class="promo" data-form="promo" novalidate><input name="code" placeholder="Промокод" value="${promo ? esc(promo) : ''}" aria-label="Промокод" autocomplete="off"><button class="btn small" type="submit">${promo ? 'Заменить' : 'Применить'}</button></form>
<p class="promo-msg ${t.pr ? 'ok' : ''}" id="promo-msg">${t.pr ? `Промокод ${esc(t.pr.code)}: ${t.pr.label}${t.pr.note ? '. ' + t.pr.note : ''} <button class="link-btn" data-act="promo-clear">убрать</button>` : `Попробуйте: <button class="link-btn" data-act="promo-try" data-code="ЗЕРКАЛО">ЗЕРКАЛО</button>`}</p>
${totalsHTML(t)}
<a class="btn big" href="#/checkout" data-act="close-cart">Оформить заказ</a>`;
    }

    function applyPromo(raw) {
        const code = raw.trim().toUpperCase().replace(/\s+/g, '');
        const msg = $('#promo-msg');
        if (!code) return;
        if (/^(H&M|Н&М|HM|HENNES|ХМ)$/.test(code)) { promo = null; store.set('promo', null); renderDrawer(); $('#promo-msg').textContent = 'Вы не туда. Здесь M&H. Но за попытку — респект.'; $('#promo-msg').classList.add('err'); return; }
        if (!PROMOS[code]) { $('#promo-msg').textContent = 'Такого промокода нет. Мы проверили дважды и даже спросили у соседа.'; $('#promo-msg').classList.add('err'); return; }
        promo = code; store.set('promo', code);
        renderDrawer();
        toast(`Промокод ${code} применён`);
        if (route().name === 'checkout') renderSummary();
    }

    /* ===================== Модальные окна ===================== */
    function openModal(html) {
        $('#modal-box').innerHTML = html;
        $('#modal').hidden = false;
        $('#overlay').hidden = false; requestAnimationFrame(() => $('#overlay').classList.add('show'));
        document.body.classList.add('lock');
        const f = $('#modal-box button, #modal-box input, #modal-box select'); if (f) f.focus();
    }
    function closeModal() {
        $('#modal').hidden = true;
        if (!isCartOpen()) { $('#overlay').classList.remove('show'); setTimeout(() => { if (!isCartOpen() && $('#modal').hidden) $('#overlay').hidden = true; }, 250); document.body.classList.remove('lock'); }
    }

    let qv = null;
    function openQuick(pid) {
        const p = byId(pid);
        qv = { id: pid, color: 0, size: p.sizes.length === 1 ? p.sizes[0] : '' };
        renderQuick();
        openModal($('#modal-box').innerHTML);
    }
    function renderQuick() {
        const p = byId(qv.id);
        $('#modal-box').innerHTML = `
<button class="modal-x" data-act="close-modal" aria-label="Закрыть">✕</button>
<div class="quick-box">
    <div class="quick-img" style="--bg:${p.bg}">${art(p, qv.color)}</div>
    <div class="quick-info">
        <h2 id="modal-title">${esc(p.name)}</h2>
        <div class="pv-price">${priceHTML(p)}</div>
        <p class="pv-desc">${esc(p.desc)}</p>
        <div class="opt"><h4>Цвет: <span>${esc(p.colors[qv.color].n)}</span></h4><div class="pv-colors">${p.colors.map((x, i) => `<button class="pv-col ${i === qv.color ? 'on' : ''}" data-act="q-color" data-i="${i}" style="--c:${x.h}" aria-label="${esc(x.n)}"></button>`).join('')}</div></div>
        <div class="opt"><h4>Размер</h4><div class="pv-sizes">${p.sizes.map(s => { const out = p.out.includes(s); return `<button class="size ${qv.size === s ? 'on' : ''} ${out ? 'out' : ''}" data-act="q-size" data-size="${esc(s)}">${esc(s)}</button>`; }).join('')}</div></div>
        <div class="buy"><button class="btn big" data-act="q-add">В корзину</button><a class="btn ghost" href="#/product/${p.id}" data-act="close-modal">Подробнее</a></div>
    </div>
</div>`;
    }

    const ADVISOR_JOKES = [
        'Алгоритм обучен на трёх примерах. Все три были H.',
        'Мы взвесили ваш рост и измерили вес. Получилось H. Не спрашивайте как.',
        'Нейросеть посовещалась с зеркалом. Зеркало сказало: H.',
        'По результатам консилиума из двух бухгалтеров и одного кота — H.'
    ];
    function openAdvisor() {
        openModal(`
<button class="modal-x" data-act="close-modal" aria-label="Закрыть">✕</button>
<div class="advisor"><h2 id="modal-title">Подбор размера</h2>
<p class="hint">Введите рост и вес — мы подберём идеальный размер. Серьёзно.</p>
<form data-form="advisor" novalidate>
    <div class="row2"><div class="field"><label for="a-h">Рост, см</label><input id="a-h" name="h" type="number" min="100" max="230" placeholder="175"></div>
    <div class="field"><label for="a-w">Вес, кг</label><input id="a-w" name="w" type="number" min="30" max="250" placeholder="70"></div></div>
    <div class="field"><label>Как должно сидеть</label><div class="chips"><label class="chip"><input type="radio" name="fit" value="1" checked hidden>В обтяжку</label><label class="chip"><input type="radio" name="fit" value="2" hidden>Обычно</label><label class="chip"><input type="radio" name="fit" value="3" hidden>Как мешок</label></div></div>
    <button class="btn big" type="submit">Подобрать</button>
</form><div id="advisor-res"></div></div>`);
    }

    /* ===================== Шапка, поиск, меню ===================== */
    function closeMenu() { $('#nav').classList.remove('open'); const b = $('[data-act="toggle-menu"]'); if (b) b.setAttribute('aria-expanded', 'false'); }

    function suggest(q) {
        const box = $('#suggest');
        q = q.trim().toLowerCase();
        if (q.length < 2) { box.hidden = true; return; }
        const tokens = q.split(/\s+/);
        const res = PRODUCTS.filter(p => { const h = (p.name + ' ' + catName(p.cat)).toLowerCase(); return tokens.every(t => h.includes(t)); }).slice(0, 5);
        box.innerHTML = res.length ? res.map(p => `<a href="#/product/${p.id}" data-act="close-suggest"><span style="--bg:${p.bg}">${art(p, 0)}</span><b>${esc(p.name)}</b><small>${fmt(p.price)}</small></a>`).join('') + `<a class="all" href="#/catalog?q=${encodeURIComponent(q)}" data-act="close-suggest">Все результаты →</a>`
            : '<p class="none">Ничего не нашли. Мы тоже иногда теряемся.</p>';
        box.hidden = false;
    }

    function setMirror(on) {
        document.body.classList.toggle('mirrored', on);
        store.set('mirror', on);
        $('#mirror-btn').classList.toggle('on', on);
    }

    /* ===================== Фишки ===================== */
    const TOPBAR = ['Бесплатная доставка от 5 000 ₽', 'Нас часто путают с другими — это нормально', 'Возврат в течение 30 дней', 'Размер H — Hормально', 'Скидки до −50%, которые вы видели ещё в мае', 'Это пародия, всё вымышлено'];
    function initTopbar() {
        const items = TOPBAR.map(t => `<span>${t}</span>`).join('');
        $('#topbar-track').innerHTML = items + items + items;
    }

    let saleEnd = Date.now() + (2 * 3600 + 14 * 60 + 59) * 1000;
    function tickCountdown() {
        const els = $$('.cd'); if (!els.length) return;
        const upd = () => {
            let s = Math.floor((saleEnd - Date.now()) / 1000);
            if (s < 0) { saleEnd = Date.now() + (2 * 3600 + 14 * 60 + 59) * 1000; s = 2 * 3600 + 14 * 60 + 59; toast('Распродажа закончилась. Началась новая. Всё как обычно.'); }
            const t = [Math.floor(s / 3600), Math.floor(s % 3600 / 60), s % 60].map(x => String(x).padStart(2, '0')).join(':');
            $$('.cd').forEach(e => e.textContent = t);
        };
        upd(); timers.push(setInterval(upd, 1000));
    }

    function initCookie() {
        if (store.get('cookie', false)) return;
        const box = $('#cookie');
        box.innerHTML = `<div class="cookie-box"><p><b>Мы используем печеньки.</b> Настоящие, с шоколадом. И ещё немного cookie — для порядка. Согласны?</p>
<div class="cookie-btns"><button class="btn small" data-act="cookie-yes">Конечно</button><button class="btn ghost small" id="cookie-no" data-act="cookie-no">Нет, спасибо</button></div></div>`;
        setTimeout(() => { box.hidden = false; requestAnimationFrame(() => box.classList.add('in')); }, 1200);
        const no = $('#cookie-no');
        let hops = 0;
        const dodge = () => {
            if (hops >= 4) return;
            hops++;
            no.style.transform = `translate(${(Math.random() * 160 - 80) | 0}px, ${(Math.random() * 60 - 30) | 0}px)`;
            if (hops === 4) no.textContent = 'Ладно, нажимайте';
        };
        no.addEventListener('mouseenter', dodge);
        no.addEventListener('touchstart', e => { if (hops < 4) { e.preventDefault(); dodge(); } }, { passive: false });
    }
    function dismissCookie(msg) {
        store.set('cookie', true);
        const b = $('#cookie'); b.classList.remove('in'); setTimeout(() => { b.hidden = true; }, 400);
        toast(msg);
    }

    /* ===================== События ===================== */
    const actions = {
        'toggle-menu'(el) { const o = $('#nav').classList.toggle('open'); el.setAttribute('aria-expanded', o); },
        'toggle-mirror'() { const on = !document.body.classList.contains('mirrored'); setMirror(on); toast(on ? 'Теперь всё как в зазеркалье. Читать сложнее, зато оригинально.' : 'Всё вернулось на свои места. Скучно, но привычно.'); },
        'open-cart'() { openCart(); },
        'close-cart'() { closeCart(); },
        'close-modal'() { closeModal(); },
        'close-all'() { closeCart(); closeModal(); },
        'close-suggest'() { $('#suggest').hidden = true; $('#search-input').value = ''; },
        'toggle-filters'() { $('#filters').classList.toggle('open'); document.body.classList.toggle('lock', $('#filters').classList.contains('open')); },
        'wish'(el) { toggleWish(el.dataset.id); },
        'quick'(el) { openQuick(el.dataset.id); },
        'q-color'(el) { qv.color = +el.dataset.i; renderQuick(); },
        'q-size'(el) {
            const p = byId(qv.id);
            if (p.out.includes(el.dataset.size)) { toast(`Размера ${el.dataset.size} нет. Мы его… продали? Съели? Не знаем.`); return; }
            qv.size = el.dataset.size; renderQuick();
        },
        'q-add'() {
            if (!qv.size) { toast('Выберите размер. H — хороший выбор.'); const s = $('.quick-info .pv-sizes'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); return; }
            addToCart(qv.id, qv.color, qv.size, 1); closeModal(); toast('Добавлено в корзину'); openCart();
        },
        'pick-color'(el) { pv.color = +el.dataset.i; renderProductTop(); },
        'pick-view'(el) { pv.view = el.dataset.view; renderProductTop(); },
        'pick-size'(el) {
            const p = byId(pv.id);
            if (p.out.includes(el.dataset.size)) { toast(`Размера ${el.dataset.size} нет. Мы его… продали? Съели? Не знаем.`); return; }
            pv.size = el.dataset.size; renderProductTop();
        },
        'qty-'() { pv.qty = Math.max(1, pv.qty - 1); renderProductTop(); },
        'qty+'() { pv.qty = Math.min(10, pv.qty + 1); renderProductTop(); },
        'add-pv'() {
            if (!pv.size) {
                toast('Выберите размер. H — хороший выбор.');
                const s = $('#size-opt'); s.classList.remove('shake'); void s.offsetWidth; s.classList.add('shake'); return;
            }
            addToCart(pv.id, pv.color, pv.size, pv.qty);
            toast('Добавлено в корзину');
            openCart();
        },
        'to-reviews'(el, e) { e.preventDefault(); $('#reviews').scrollIntoView({ behavior: 'smooth' }); },
        'size-advisor'() { openAdvisor(); },
        'advisor-pick'(el) {
            if (pv && byId(pv.id).sizes.includes('H') && !byId(pv.id).out.includes('H')) { pv.size = 'H'; renderProductTop(); toast('Выбран размер H'); }
            closeModal();
        },
        'cart-inc'(el) { const i = cart[+el.dataset.i]; i.qty = Math.min(10, i.qty + 1); saveCart(); if (route().name === 'checkout') renderSummary(); },
        'cart-dec'(el) { const i = cart[+el.dataset.i]; i.qty = Math.max(1, i.qty - 1); saveCart(); if (route().name === 'checkout') renderSummary(); },
        'cart-del'(el) { cart.splice(+el.dataset.i, 1); saveCart(); toast('Убрали. Вещь не обиделась.'); if (route().name === 'checkout') { cart.length ? renderSummary() : (location.hash = '#/catalog'); } },
        'promo-clear'() { promo = null; store.set('promo', null); renderDrawer(); if (route().name === 'checkout') renderSummary(); },
        'promo-try'(el) { applyPromo(el.dataset.code); },
        'fill-card'() {
            const f = $('#co-form'); f.elements.card.value = '4242 4242 4242 4242';
            const d = new Date(); f.elements.exp.value = String(d.getMonth() + 1).padStart(2, '0') + '/' + String((d.getFullYear() + 3) % 100).padStart(2, '0');
            f.elements.cvc.value = '123';
            ['card', 'exp', 'cvc'].forEach(n => setErr(f.elements[n], ''));
        },
        'copy'(el) { (navigator.clipboard ? navigator.clipboard.writeText(el.dataset.text) : Promise.reject()).then(() => toast('Номер скопирован'), () => toast('Не удалось скопировать. Бывает.')); },
        'clear-orders'() { orders = []; store.set('orders', orders); render(); toast('История очищена. Мы ничего не помним.'); },
        'cookie-yes'() { dismissCookie('Спасибо! Печенье вкусное.'); },
        'cookie-no'() { dismissCookie('Ладно. Мы всё равно угадаем ваш размер.'); }
    };

    document.addEventListener('click', e => {
        const el = e.target.closest('[data-act]');
        if (el && actions[el.dataset.act]) {
            // ссылки с data-act="close-*" должны продолжать навигацию
            if (el.tagName !== 'A' && !el.matches('.modal-x')) e.preventDefault();
            actions[el.dataset.act](el, e);
        }
        const keep = e.target.closest('[data-keep]');
        if (keep) noScroll = true;
        if (!e.target.closest('.search')) $('#suggest').hidden = true;
        if (e.target.closest('a[href^="#/catalog"]') && !e.target.closest('.filters') && !keep) noScroll = false;
        if (e.target.closest('.filters a')) noScroll = true;
        // клик по логотипу — шутка
        if (e.target.closest('#logo')) toast(rnd(['Нет, мы не H&M. Мы M&H.', 'Буквы на месте. Проверяли.', 'Это M&H. Да, мы уже устали объяснять.']));
        // выбор опции в радиогруппах checkout
        const opt = e.target.closest('.option');
        if (opt) setTimeout(syncOptions, 0);
        const chipLbl = e.target.closest('.advisor .chip');
        if (chipLbl) { $$('.advisor .chip').forEach(c => c.classList.remove('on')); chipLbl.classList.add('on'); }
    });

    function syncOptions() {
        const f = $('#co-form'); if (!f) return;
        $$('.option', f).forEach(o => o.classList.toggle('on', $('input', o).checked));
        const d = f.elements.delivery.value, pay = f.elements.pay.value;
        if (d !== co.delivery) { co.delivery = d; renderAddrBox(); renderSummary(); }
        if (pay !== co.pay) { co.pay = pay; renderPayBox(); }
    }

    document.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-change="sort"]')) { const q = route().q; location.hash = '#/catalog' + qs(Object.assign({}, q, { sort: t.value, page: '' })); noScroll = true; }
        if (t.closest('#co-form') && (t.name === 'delivery' || t.name === 'pay')) syncOptions();
    });

    document.addEventListener('input', e => {
        const t = e.target;
        if (t.id === 'search-input') suggest(t.value);
        if (t.name === 'card') { t.value = t.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); }
        if (t.name === 'exp') { let v = t.value.replace(/\D/g, '').slice(0, 4); if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2); t.value = v; }
        if (t.name === 'cvc') t.value = t.value.replace(/\D/g, '').slice(0, 3);
        if (t.closest('.field.bad')) setErr(t, '');
    });

    document.addEventListener('submit', e => {
        const f = e.target;
        if (f.id === 'search-form') {
            e.preventDefault();
            const q = $('#search-input').value.trim();
            $('#suggest').hidden = true;
            if (q) location.hash = '#/catalog' + qs({ q });
            return;
        }
        const kind = f.dataset.form;
        if (!kind) return;
        e.preventDefault();
        if (kind === 'price') {
            const q = route().q;
            noScroll = true;
            location.hash = '#/catalog' + qs(Object.assign({}, q, { min: f.elements.min.value, max: f.elements.max.value, page: '' }));
        }
        if (kind === 'promo') applyPromo(f.elements.code.value);
        if (kind === 'newsletter') {
            const em = f.elements.email.value.trim(), err = $('.form-err', f);
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(em)) { err.hidden = false; err.textContent = 'Похоже, e-mail неполный. Мы пока не умеем читать мысли.'; return; }
            f.innerHTML = `<p class="member-ok">Добро пожаловать в клуб! Ваш промокод — <b>НАСПУТАЛИ</b> (−10%). Отписаться можно. Но зачем?</p>`;
            store.set('sub', em);
        }
        if (kind === 'review') {
            const name = f.elements.name.value.trim(), text = f.elements.text.value.trim();
            const st = (f.querySelector('[name="stars"]:checked') || {}).value;
            const err = $('.form-err', f);
            if (!name || !st || text.length < 5) { err.hidden = false; err.textContent = 'Нужны имя, оценка и хотя бы пара слов (от 5 символов).'; return; }
            const all = store.get('rev', {});
            (all[pv.id] = all[pv.id] || []).unshift({ name, stars: +st, text });
            store.set('rev', all);
            renderReviews(); renderProductTop();
            toast('Спасибо за отзыв! Мы его почти прочитали.');
        }
        if (kind === 'checkout') { if (validateCheckout(f)) placeOrder(f); }
        if (kind === 'advisor') {
            const h = +f.elements.h.value, w = +f.elements.w.value;
            const res = $('#advisor-res');
            if (!h || !w || h < 100 || h > 230 || w < 30 || w > 250) { res.innerHTML = '<p class="form-err">Введите рост (100–230 см) и вес (30–250 кг). Врать зеркалу бесполезно.</p>'; return; }
            const p = pv && byId(pv.id);
            const canH = p && p.sizes.includes('H');
            res.innerHTML = `<div class="adv-res"><div class="adv-size">H</div><p>${esc(rnd(ADVISOR_JOKES))}</p>${canH ? '<button class="btn" data-act="advisor-pick">Выбрать H</button>' : '<button class="btn" data-act="close-modal">Понятно</button>'}</div>`;
        }
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') { closeCart(); closeModal(); $('#suggest').hidden = true; const f = $('#filters'); if (f) f.classList.remove('open'); document.body.classList.remove('lock'); }
        if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#search-input').focus(); }
    });

    window.addEventListener('hashchange', () => { if (!/^#reviews/.test(location.hash)) render(); });
    window.addEventListener('scroll', () => $('#header').classList.toggle('scrolled', window.scrollY > 10), { passive: true });

    /* ===================== Старт ===================== */
    initTopbar();
    saveCart(); saveWish();
    if (store.get('mirror', false)) setMirror(true);
    initCookie();
    render();
})();
