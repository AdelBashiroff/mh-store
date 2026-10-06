/* M&H — «фотографии» товаров: вся одежда нарисована SVG-кодом */
(function () {
    let uid = 0;

    function rgb(hex) {
        let h = hex.replace('#', '');
        if (h.length === 3) h = h.split('').map(c => c + c).join('');
        const n = parseInt(h, 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    // amt от -1 (в чёрный) до 1 (в белый)
    function shade(hex, amt) {
        const t = amt < 0 ? 0 : 255, p = Math.abs(amt);
        return '#' + rgb(hex).map(c => Math.round(c + (t - c) * p).toString(16).padStart(2, '0')).join('');
    }
    function lum(hex) {
        const [r, g, b] = rgb(hex);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    }
    const mir = s => `<g transform="translate(400 0) scale(-1 1)">${s}</g>`;

    // Контур + заливка + мягкий объём
    function piece(d, fill, k, o = {}) {
        const id = 'cl' + (++uid);
        const stroke = o.stroke || shade(fill, lum(fill) > 0.35 ? -0.32 : -0.45);
        return `<clipPath id="${id}"><path d="${d}"/></clipPath>
<path d="${d}" fill="${fill}"/>
<g clip-path="url(#${id})"><rect width="400" height="500" fill="url(#sh${k})"/>${o.clip || ''}</g>
<path d="${d}" fill="none" stroke="${stroke}" stroke-width="2.5" stroke-linejoin="round"/>`;
    }

    function printSVG(p, hex, cx, cy, maxW) {
        if (!p) return '';
        const ink = p.color || (lum(hex) > 0.55 ? '#111' : '#fff');
        if (p.lines) {
            const longest = Math.max(...p.lines.map(l => l.length));
            const size = Math.min(p.size || 46, maxW / (longest * 0.62));
            return p.lines.map((l, i) =>
                `<text x="${cx}" y="${cy + i * size * 1.05}" text-anchor="middle" font-family="Amp, Archivo Black, Impact, sans-serif" font-size="${size.toFixed(1)}" fill="${ink}" letter-spacing="1">${l}</text>`
            ).join('');
        }
        if (p.stain) {
            return `<g fill="#6b4a2f" opacity=".82"><path d="M${cx - 34} ${cy - 10} q10 -26 38 -18 q30 4 24 30 q18 18 -6 34 q-14 18 -36 6 q-30 -2 -22 -26 q-12 -12 2 -26z"/><circle cx="${cx + 52}" cy="${cy + 34}" r="7"/><circle cx="${cx - 44}" cy="${cy + 38}" r="5"/></g>`;
        }
        return '';
    }

    /* ===================== Вещи ===================== */
    const G = {};

    G.tee = (hex, p, k, v) => {
        const body = 'M150 72 Q200 64 250 72 L332 104 L374 196 L320 222 L306 182 L306 442 Q200 454 94 442 L94 182 L80 222 L26 196 L68 104 Z';
        const line = lum(hex) > 0.45 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.2)';
        let stripes = '';
        if (v === 'stripe') {
            for (let y = 150; y < 430; y += 44) stripes += `<rect x="0" y="${y}" width="400" height="20" fill="${p && p.stripe || 'rgba(255,255,255,.85)'}"/>`;
        }
        return piece(body, hex, k, { clip: stripes }) +
            `<path d="M150 72 Q200 64 250 72 Q200 132 150 72Z" fill="rgba(0,0,0,.24)"/>
<path d="M150 72 Q200 132 250 72" fill="none" stroke="${shade(hex, -0.2)}" stroke-width="7" stroke-linecap="round"/>
<path d="M68 104 L94 182 M332 104 L306 182 M94 428 Q200 440 306 428 M31 185 L85 211 M369 185 L315 211" fill="none" stroke="${line}" stroke-width="2"/>
${printSVG(p, hex, 200, p && p.lines && p.lines.length > 1 ? 232 : 260, 190)}`;
    };

    G.hoodie = (hex, p, k) => {
        const line = lum(hex) > 0.45 ? 'rgba(0,0,0,.14)' : 'rgba(255,255,255,.2)';
        const sleeve = 'M84 106 Q50 132 42 258 L36 404 Q38 414 48 414 L96 418 Q104 300 106 196 Z';
        const body = 'M134 92 Q200 136 266 92 L316 108 Q306 160 302 196 L304 440 Q200 454 96 440 L98 196 Q94 160 84 108 Z';
        const hood = 'M118 100 Q120 26 200 24 Q280 26 282 100 Q200 138 118 100Z';
        return piece(hood, shade(hex, -0.12), k) +
            piece(sleeve, hex, k) + mir(piece(sleeve, hex, k)) +
            piece(body, hex, k) +
            `<path d="M140 94 Q200 66 260 94 Q200 150 140 94Z" fill="rgba(0,0,0,.3)"/>
<path d="M140 94 Q200 150 260 94" fill="none" stroke="${shade(hex, -0.14)}" stroke-width="9" stroke-linecap="round"/>
<path d="M178 126 L174 192 M222 126 L226 192" stroke="#f3f3f3" stroke-width="4" stroke-linecap="round"/>
<circle cx="174" cy="194" r="5" fill="#f3f3f3"/><circle cx="226" cy="194" r="5" fill="#f3f3f3"/>
<path d="M122 330 L278 330 L296 410 L104 410Z" fill="rgba(0,0,0,.07)" stroke="${line}" stroke-width="2"/>
<path d="M98 424 Q200 438 302 424 L304 440 Q200 454 96 440Z" fill="${shade(hex, -0.1)}" opacity=".9"/>
<path d="M40 394 L98 404 M360 394 L302 404" stroke="${line}" stroke-width="3"/>
${printSVG(p, hex, 200, 262, 120)}`;
    };

    G.jeans = (hex, p, k, v) => {
        const body = 'M108 60 L292 60 L302 452 L212 452 L200 206 L188 452 L98 452Z';
        const stitch = '#f0c36a';
        const fade = '<ellipse cx="152" cy="270" rx="34" ry="62" fill="rgba(255,255,255,.07)"/><ellipse cx="248" cy="270" rx="34" ry="62" fill="rgba(255,255,255,.07)"/>';
        let extra = '';
        if (v === 'cargo') {
            extra = `<path id="cg" d="M112 250 L172 250 L172 330 L108 330Z" fill="rgba(0,0,0,.1)" stroke="${stitch}" stroke-width="2" stroke-dasharray="5 4"/>
<path d="M112 250 L172 250 L172 270 L111 270Z" fill="rgba(0,0,0,.12)"/>
${mir('<path d="M112 250 L172 250 L172 330 L108 330Z" fill="rgba(0,0,0,.1)" stroke="' + stitch + '" stroke-width="2" stroke-dasharray="5 4"/><path d="M112 250 L172 250 L172 270 L111 270Z" fill="rgba(0,0,0,.12)"/>')}`;
        }
        if (v === 'patch') {
            extra = `<rect x="118" y="290" width="48" height="48" rx="4" fill="#e8b84a" stroke="${stitch}" stroke-dasharray="4 3" stroke-width="2"/>
<rect x="234" y="300" width="48" height="48" rx="4" fill="#d96b6b" stroke="${stitch}" stroke-dasharray="4 3" stroke-width="2"/>`;
        }
        return piece(body, hex, k, { clip: fade }) +
            `<path d="M108 60 L292 60 L292 94 L108 94Z" fill="${shade(hex, -0.1)}" stroke="${shade(hex, -0.4)}" stroke-width="2"/>
<g fill="${shade(hex, -0.16)}" stroke="${shade(hex, -0.4)}" stroke-width="1.5"><rect x="124" y="54" width="10" height="46"/><rect x="164" y="54" width="10" height="46"/><rect x="226" y="54" width="10" height="46"/><rect x="266" y="54" width="10" height="46"/></g>
<path d="M200 96 L200 176 Q200 204 178 200" fill="none" stroke="${stitch}" stroke-width="2.4" stroke-dasharray="6 4"/>
<path d="M174 96 Q150 152 106 152 M226 96 Q250 152 294 152" fill="none" stroke="${stitch}" stroke-width="2.4" stroke-dasharray="6 4"/>
<circle cx="200" cy="77" r="7" fill="#e8c36a" stroke="#9c7a28" stroke-width="1.5"/>
${extra}
<path d="M100 438 L188 438 M212 438 L300 438" stroke="${stitch}" stroke-width="2" stroke-dasharray="6 4" fill="none"/>`;
    };

    G.dress = (hex, p, k, v) => {
        const body = 'M132 116 Q200 160 268 116 L252 214 L330 452 Q200 472 70 452 L148 214 Z';
        const line = lum(hex) > 0.45 ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.2)';
        let dots = '';
        if (v === 'dots') {
            const c = (p && p.dot) || '#fff';
            for (let y = 236; y < 470; y += 36) for (let x = 90 + ((y / 36) % 2) * 18; x < 330; x += 36) dots += `<circle cx="${x}" cy="${y}" r="5" fill="${c}" opacity=".9"/>`;
        }
        let folds = '';
        for (let i = 0; i < 6; i++) folds += `M${168 + i * 13} 226 L${108 + i * 37} 458 `;
        return `<g fill="none" stroke="${shade(hex, -0.3)}" stroke-width="14" stroke-linecap="round"><path d="M148 38 Q150 84 160 116"/><path d="M252 38 Q250 84 240 116"/></g>
<g fill="none" stroke="${hex}" stroke-width="10" stroke-linecap="round"><path d="M148 38 Q150 84 160 116"/><path d="M252 38 Q250 84 240 116"/></g>` +
            piece(body, hex, k, { clip: dots }) +
            `<path d="M132 116 Q200 160 268 116" fill="none" stroke="${shade(hex, -0.14)}" stroke-width="5"/>
<path d="${folds}" stroke="${line}" stroke-width="2" fill="none"/>
<path d="M148 204 L252 204 L254 226 L146 226Z" fill="${shade(hex, -0.18)}" stroke="${shade(hex, -0.45)}" stroke-width="2"/>
<path d="M200 215 L232 196 L232 234Z M200 215 L168 196 L168 234Z" fill="${shade(hex, -0.1)}" stroke="${shade(hex, -0.45)}" stroke-width="2"/>
<circle cx="200" cy="215" r="7" fill="${shade(hex, -0.25)}"/>`;
    };

    G.socks = (hex, p, k) => {
        const sock = 'M170 40 L262 40 L266 300 Q270 392 190 396 L112 396 Q64 396 64 350 Q66 318 112 312 L170 296Z';
        const stripe = (p && p.stripe) || '#d92b2b';
        const one = () => piece(sock, hex, k, { clip: `<ellipse cx="240" cy="352" rx="42" ry="48" fill="rgba(0,0,0,.14)"/><ellipse cx="86" cy="356" rx="30" ry="36" fill="rgba(0,0,0,.14)"/>` }) +
            `<path d="M170 40 L262 40 L262 86 L170 86Z" fill="${shade(hex, -0.08)}" stroke="${shade(hex, -0.4)}" stroke-width="2"/>
<path d="M170 56 L262 56 M170 70 L262 70" stroke="${stripe}" stroke-width="6"/>
<text x="216" y="190" text-anchor="middle" font-family="Amp, Archivo Black, Impact, sans-serif" font-size="58" fill="${shade(hex, lum(hex) > 0.5 ? -0.5 : 0.6)}" opacity=".8">Л</text>`;
        return `<g transform="translate(-14 4) scale(.84)">${one()}</g><g transform="translate(116 66) scale(.84)">${one()}</g>`;
    };

    G.cap = (hex, p, k) => {
        const dome = 'M92 300 Q88 140 200 128 Q312 140 308 300 Q200 318 92 300Z';
        const brim = 'M82 306 Q200 332 318 306 Q356 332 326 356 Q200 392 74 356 Q44 332 82 306Z';
        const line = lum(hex) > 0.45 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.25)';
        return piece(brim, shade(hex, -0.12), k) + piece(dome, hex, k) +
            `<path d="M200 132 Q172 220 152 306 M200 132 Q228 220 248 306 M200 132 Q132 196 96 290 M200 132 Q268 196 304 290" fill="none" stroke="${line}" stroke-width="2" stroke-dasharray="5 4"/>
<circle cx="200" cy="130" r="9" fill="${shade(hex, -0.14)}" stroke="${shade(hex, -0.4)}" stroke-width="2"/>
<text x="200" y="250" text-anchor="middle" font-family="Amp, Archivo Black, Impact, sans-serif" font-size="40" fill="${lum(hex) > 0.55 ? '#d4001a' : '#fff'}">M&amp;H</text>
<path d="M96 306 Q200 326 304 306" fill="none" stroke="${line}" stroke-width="2"/>`;
    };

    G.scarf = (hex, p, k) => {
        const body = 'M50 200 Q125 176 200 200 T350 200 L350 252 Q275 228 200 252 T50 252Z';
        const c2 = (p && p.stripe) || '#fff';
        let st = '';
        for (let x = 20; x < 380; x += 36) st += `<path d="M${x} 150 L${x + 40} 300" stroke="${c2}" stroke-width="12" opacity=".9"/>`;
        let fringe = '';
        for (let y = 204; y < 252; y += 7) fringe += `M50 ${y} l-16 ${2 + (y % 3)} M350 ${y} l16 ${2 + (y % 3)} `;
        return piece(body, hex, k, { clip: st }) +
            `<path d="${fringe}" stroke="${shade(hex, -0.3)}" stroke-width="3" stroke-linecap="round"/>
<g stroke="#111" stroke-width="2" fill="none"><path d="M384 200 L384 252 M378 200 L390 200 M378 252 L390 252"/></g>
<text x="384" y="282" text-anchor="middle" font-family="Inter, sans-serif" font-weight="700" font-size="15" fill="#111">3 см</text>
<text x="200" y="330" text-anchor="middle" font-family="Inter, sans-serif" font-size="13" fill="#888">фото без масштабирования (почти)</text>`;
    };

    G.coat = (hex, p, k) => {
        const line = lum(hex) > 0.45 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.22)';
        const sleeve = 'M122 82 L74 104 Q50 130 44 250 L36 380 L92 392 L104 270 Q108 200 118 150Z';
        const body = 'M140 62 L260 62 L318 98 Q300 190 304 300 L324 472 Q200 490 76 472 L96 300 Q100 190 82 98Z';
        const lapel = 'M142 62 L170 64 L206 208 L180 234 L138 150 L110 106Z';
        const btn = (x, y) => `<circle cx="${x}" cy="${y}" r="7" fill="${shade(hex, -0.45)}" stroke="${shade(hex, 0.25)}" stroke-width="1.5"/>`;
        return piece(sleeve, hex, k) + mir(piece(sleeve, hex, k)) + piece(body, hex, k) +
            `<path d="M158 64 L200 206 L242 64Z" fill="rgba(0,0,0,.3)"/>` +
            piece(lapel, shade(hex, 0.07), k) + mir(piece(lapel, shade(hex, 0.07), k)) +
            `<path d="M200 232 L200 480" stroke="${line}" stroke-width="2"/>
${btn(178, 262)}${btn(222, 262)}${btn(176, 296)}${btn(224, 296)}
<path d="M98 340 L302 340 L304 366 L96 366Z" fill="${shade(hex, -0.12)}" stroke="${shade(hex, -0.45)}" stroke-width="2"/>
<rect x="186" y="336" width="28" height="34" rx="4" fill="none" stroke="#c9b27a" stroke-width="4"/>
<path d="M112 420 L168 430 M288 420 L232 430" stroke="${line}" stroke-width="3" fill="none"/>
<path d="M44 360 L96 372 M356 360 L304 372" stroke="${line}" stroke-width="3"/>`;
    };

    G.sweater = (hex, p, k) => {
        const ink = (p && p.color) || (lum(hex) > 0.55 ? '#a31621' : '#f4efe6');
        const sleeve = 'M90 98 L70 110 Q44 150 38 300 L34 372 L90 384 Q96 280 98 190Z';
        const body = 'M146 70 Q200 96 254 70 L318 100 Q308 160 304 200 L306 432 Q200 446 94 432 L96 200 Q92 160 82 100Z';
        let zig = '';
        [196, 262].forEach((y, r) => {
            for (let x = 70 + (r ? 12 : 0); x < 340; x += 24) zig += `<path d="M${x} ${y + 30} L${x + 12} ${y} L${x + 24} ${y + 30}Z" fill="${ink}"/>`;
            zig += `<rect x="60" y="${y + 30}" width="290" height="5" fill="${ink}"/>`;
        });
        let rib = '';
        for (let x = 110; x < 300; x += 12) rib += `M${x} 414 L${x} 440 `;
        return piece(sleeve, hex, k, { clip: '' }) + mir(piece(sleeve, hex, k)) +
            piece(body, hex, k, { clip: zig }) +
            `<path d="M146 70 Q200 96 254 70 Q200 134 146 70Z" fill="rgba(0,0,0,.26)"/>
<path d="M146 70 Q200 130 254 70" fill="none" stroke="${shade(hex, -0.16)}" stroke-width="12" stroke-linecap="round"/>
<path d="M94 414 Q200 428 306 414 L306 432 Q200 446 94 432Z" fill="${shade(hex, -0.1)}"/>
<path d="${rib}" stroke="rgba(0,0,0,.14)" stroke-width="2"/>
<path d="M36 356 L92 368 M364 356 L308 368" stroke="rgba(0,0,0,.2)" stroke-width="3"/>`;
    };

    G.bag = (hex, p, k) => {
        const body = 'M96 180 L304 180 L318 450 L82 450Z';
        const hnd = shade(hex, -0.3);
        return `<path d="M140 184 Q140 86 200 86 Q260 86 260 184" fill="none" stroke="${shade(hex, -0.4)}" stroke-width="14" stroke-linecap="round"/>
<path d="M140 184 Q140 86 200 86 Q260 86 260 184" fill="none" stroke="${hnd}" stroke-width="9" stroke-linecap="round"/>` +
            piece(body, hex, k) +
            `<path d="M97 200 L303 200 M91 432 L309 432" stroke="rgba(0,0,0,.14)" stroke-width="2" stroke-dasharray="6 4"/>
${printSVG(p || { lines: ['ЕЩЁ', 'ОДНА', 'СУМКА'] }, hex, 200, 290, 160)}`;
    };

    G.sneakers = (hex, p, k) => {
        const upper = 'M52 372 L52 250 Q52 214 84 210 L130 206 Q150 204 164 190 L180 180 Q196 176 206 194 L218 228 Q260 276 316 288 Q374 298 376 340 L376 372Z';
        const sole = 'M44 370 L384 370 Q388 408 352 412 L80 412 Q44 412 44 370Z';
        return `<ellipse cx="214" cy="428" rx="190" ry="12" fill="rgba(0,0,0,.12)"/>` +
            piece(upper, hex, k) + piece(sole, '#f6f6f4', k, { stroke: '#b9b9b4' }) +
            `<path d="M84 210 L130 206 Q150 204 164 190 L170 214 Q120 232 84 224Z" fill="rgba(0,0,0,.32)"/>
<path d="M52 250 Q52 214 84 210 L84 300 L52 300Z" fill="rgba(0,0,0,.16)"/>
<path d="M300 286 Q374 298 376 340 L376 372 L316 372 Q330 330 300 286Z" fill="rgba(255,255,255,.18)"/>
<path d="M192 216 L224 204 M208 240 L242 226 M228 260 L264 246 M252 276 L286 263" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
<path d="M126 346 L148 304 L170 342 L192 304 L214 346" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M52 392 L376 392" stroke="#c9c9c4" stroke-width="2"/>`;
    };

    G.shorts = (hex, p, k) => {
        const body = 'M104 66 L296 66 L322 300 L214 312 L200 200 L186 312 L78 300Z';
        const line = lum(hex) > 0.45 ? 'rgba(0,0,0,.16)' : 'rgba(255,255,255,.22)';
        const sd = (p && p.stripe) || '#fff';
        return piece(body, hex, k) +
            `<path d="M104 66 L296 66 L297 98 L103 98Z" fill="${shade(hex, -0.12)}" stroke="${shade(hex, -0.4)}" stroke-width="2"/>
<path d="M188 98 L180 150 M212 98 L220 150" stroke="#eee" stroke-width="4" stroke-linecap="round"/>
<circle cx="180" cy="152" r="5" fill="#eee"/><circle cx="220" cy="152" r="5" fill="#eee"/>
<path d="M107 102 Q130 156 176 142 M293 102 Q270 156 224 142" fill="none" stroke="${line}" stroke-width="2.4"/>
<path d="M114 80 L114 290 M286 80 L286 290" stroke="${sd}" stroke-width="5" opacity=".0"/>
<path d="M80 286 L180 296 M320 286 L220 296" stroke="${line}" stroke-width="2" stroke-dasharray="6 4"/>`;
    };

    G.catsweater = (hex, p, k) => {
        const fur = '#e3a15a', furD = '#c27d3a';
        const body = 'M128 224 Q200 244 272 224 L292 430 Q200 450 108 430Z';
        const arm = 'M130 238 Q88 280 94 362 L134 368 Q142 304 152 272Z';
        const stripeC = (p && p.stripe) || '#fff';
        let st = '';
        for (let y = 290; y < 440; y += 34) st += `<rect x="90" y="${y}" width="230" height="12" fill="${stripeC}" opacity=".85"/>`;
        return `<path d="M284 410 Q372 392 352 292" fill="none" stroke="${furD}" stroke-width="26" stroke-linecap="round"/>
<path d="M284 410 Q372 392 352 292" fill="none" stroke="${fur}" stroke-width="20" stroke-linecap="round"/>
<path d="M132 118 L122 34 L190 84Z M268 118 L278 34 L210 84Z" fill="${fur}" stroke="${furD}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M136 100 L132 58 L168 86Z M264 100 L268 58 L232 86Z" fill="#f2b8b8"/>
<ellipse cx="200" cy="150" rx="82" ry="72" fill="${fur}" stroke="${furD}" stroke-width="2.5"/>
<path d="M200 80 L200 106 M178 84 L182 104 M222 84 L218 104" stroke="${furD}" stroke-width="5" stroke-linecap="round"/>
<ellipse cx="166" cy="150" rx="15" ry="12" fill="#f3e29c"/><ellipse cx="234" cy="150" rx="15" ry="12" fill="#f3e29c"/>
<ellipse cx="166" cy="152" rx="3.5" ry="9" fill="#222"/><ellipse cx="234" cy="152" rx="3.5" ry="9" fill="#222"/>
<path d="M148 142 L184 148 M252 142 L216 148" stroke="${furD}" stroke-width="6" stroke-linecap="round"/>
<path d="M192 172 L208 172 L200 182Z" fill="#e58f9a"/>
<path d="M200 182 Q192 196 180 190 M200 182 Q208 196 220 190" fill="none" stroke="#6b3d1a" stroke-width="2.5" stroke-linecap="round"/>
<path d="M150 176 L108 168 M150 184 L106 190 M250 176 L292 168 M250 184 L294 190" stroke="#fff" stroke-width="2" opacity=".9" stroke-linecap="round"/>` +
            piece(body, hex, k, { clip: st }) + piece(arm, hex, k, { clip: '' }) + mir(piece(arm, hex, k)) +
            `<path d="M128 226 Q200 252 272 226" fill="none" stroke="${shade(hex, -0.18)}" stroke-width="16" stroke-linecap="round"/>
<ellipse cx="114" cy="376" rx="24" ry="14" fill="${fur}" stroke="${furD}" stroke-width="2.5"/>
<ellipse cx="286" cy="376" rx="24" ry="14" fill="${fur}" stroke="${furD}" stroke-width="2.5"/>`;
    };

    // Вешалка: рисуется за вещью
    const HANGER = {
        tee: 1, dress: 1, coat: 1, sweater: 1, shorts: 1
    };
    function hanger(type) {
        if (!HANGER[type]) return '';
        const y = type === 'dress' ? 100 : type === 'shorts' ? 52 : 74;
        return `<path d="M200 ${y - 8} L200 ${y - 22} Q200 ${y - 38} 214 ${y - 40} Q232 ${y - 42} 230 ${y - 58} Q226 ${y - 76} 200 ${y - 74}" fill="none" stroke="#9a9a96" stroke-width="3.5" stroke-linecap="round"/>
<path d="M200 ${y - 8} L96 ${y + 14} Q92 ${y + 18} 104 ${y + 18} L296 ${y + 18} Q308 ${y + 18} 304 ${y + 14}Z" fill="none" stroke="#9a9a96" stroke-width="3.5" stroke-linejoin="round"/>`;
    }

    // «Деталь» — приближенный кадр
    const ZOOM = {
        tee: '90 50 220 250', hoodie: '100 70 200 240', jeans: '100 40 200 220', dress: '110 90 180 220',
        socks: '40 20 260 220', cap: '90 110 220 220', scarf: '30 140 340 200', coat: '90 40 220 260',
        sweater: '90 60 220 250', bag: '80 140 240 240', sneakers: '40 160 340 220',
        shorts: '90 40 220 220', catsweater: '90 60 220 260'
    };

    function garment(type, hex, opts = {}) {
        const fn = G[type] || G.tee;
        const k = ++uid;
        const mirror = opts.mirror ? ' transform="translate(400 0) scale(-1 1)"' : '';
        const vb = opts.zoom ? (ZOOM[type] || '90 50 220 250') : '0 0 400 500';
        const grad = `<linearGradient id="sh${k}" x1="0" y1="0" x2="1" y2="0.3">
<stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".14"/></linearGradient>`;
        const inner = hanger(type) + fn(hex, opts.print, k, opts.variant);
        return `<svg viewBox="${vb}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${opts.label || ''}" preserveAspectRatio="xMidYMid meet"><defs>${grad}</defs><g${mirror}>${inner}</g></svg>`;
    }

    window.MH_ART = { garment, shade, lum };
})();
