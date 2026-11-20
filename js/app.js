/* Sentra NL v1 (Dutch for Persian speakers, A1–C2) — hash router, six modes, placement test, bookmarks, localStorage progress */
(function () {
  'use strict';
  const A = window.SentraAudio, LESSONS = window.SENTRA_LESSONS || [];
  const $app = document.getElementById('app');
  const KEY = 'sentra-nl-progress-v1';
  const S = Object.assign({ seen: {}, practiced: {}, spoken: {}, dict: {}, bm: [], place: null, pos: {} }, (() => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } })());
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} };
  const fd = n => String(n).replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[d]);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(4, '0');
  /* fold diacritics: é→e, ë→e, ĳ/ÿ→ij (must match fold/slug/bare in tools/build.py) */
  const fold = w => w.replace(/ĳ/g, 'ij').replace(/Ĳ/g, 'IJ').replace(/ÿ/g, 'ij').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  /* leading-apostrophe short forms ('t, 's, 'n, 'k, 'm) keep their apostrophe and get their own sound file (w-apos-t …) */
  const APOS = /^'[a-z]{1,2}$/i;
  const wslug = w => fold(w).toLowerCase().replace(/^'/, 'apos-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80).replace(/-+$/, '');
  const bareW = w => { const b = w.replace(/[\u2019\u2018`]/g, "'").replace(/[^\p{L}\p{M}'\-]/gu, ''); if (APOS.test(b)) return b;
    return b.replace(/^[-']+|[-']+$/g, '') || w.replace(/[^\p{L}\p{M}]/gu, ''); };
  LESSONS.forEach(l => {
    l.fa = l.title; l.en = 'Les ' + l.num;
    l.s = l.s.map(([en, fa, rd], k) => { const n = l.n0 + k, ws = en.split(/\s+/), rs = rd.split(/\s+/);
      return { id: 's' + pad(n), n, en, fa, rd, v: n % 2 ? 'f' : 'm', lesson: l.id, t: ws.map((w, j) => ({ w, r: rs[j] || '', a: 'w-' + wslug(bareW(w)) })) }; });
  });
  const ALL = LESSONS.flatMap(l => l.s);
  const byId = id => ALL.find(s => s.id === id);
  const lessonById = id => LESSONS.find(l => l.id === id);
  const LEVELS = [
    { code: 'A1', en: 'Beginner', fa: 'مبتدی', c: 'c1', n: 24 },
    { code: 'A2', en: 'Basis', fa: 'مقدماتی', c: 'c2', n: 24 },
    { code: 'B1', en: 'Gemiddeld', fa: 'متوسط', c: 'c3', n: 26 },
    { code: 'B2', en: 'Bovengemiddeld', fa: 'بالاتر از متوسط', c: 'c4', n: 26 },
    { code: 'C1', en: 'Gevorderd', fa: 'پیشرفته', c: 'c5', n: 22 },
    { code: 'C2', en: 'Vaardig', fa: 'تسلط کامل', c: 'c6', n: 20 }];
  LEVELS.forEach(L => { const c = LESSONS.filter(l => l.level === L.code).length; if (c) L.n = c; });
  const MODES = [
    { id: 'practice', ic: '🧩', fa: 'تمرین کن', c: 'c1' },
    { id: 'speak', ic: '🎤', fa: 'بگو', c: 'c6' },
    { id: 'listen', ic: '🎧', fa: 'گوش کن', c: 'c4' },
    { id: 'review', ic: '🔁', fa: 'مرور خودکار', c: 'c3' },
    { id: 'dictation', ic: '✍️', fa: 'دیکته بنویس', c: 'c5' },
    { id: 'shadow', ic: '🗣️', fa: 'گوش کن و بگو', c: 'c2' }];

  /* ---------- run control: every screen gets a token; navigation cancels loops + audio ---------- */
  let tok = 0, wake = null, cleanup = [];
  const alive = t => t === tok;
  const sleep = (ms, t) => new Promise(ok => setTimeout(() => ok(alive(t)), ms));
  async function say(name, t) { if (!alive(t)) return false; await A.play(name); return alive(t); }
  async function keepAwake() { try { if ('wakeLock' in navigator && !wake) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) {} }
  function reset() { tok++; A.stop(); cleanup.forEach(f => { try { f(); } catch (e) {} }); cleanup = []; if (wake) { wake.release().catch(() => {}); wake = null; } }
  function toast(msg) { const t = document.getElementById('toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 2200); }
  const go = h => { location.hash = h; };

  /* ---------- shared pieces ---------- */
  const rule = '<div class="rule"><i></i><i></i><i></i><i></i></div>';
  const flags = '<div class="flags"><img class="flag" src="images/nl.svg" alt="Nederland" /><img class="flag" src="images/shir-o-khorshid.svg" alt="ایران" /></div>';
  function header(title, opts = {}) {
    return `<header class="page-h"><div class="row">${opts.back ? `<button class="back" data-back aria-label="بازگشت">→</button>` : ''}<h1>${title}</h1>${opts.pill || ''}${opts.right || ''}</div>${rule}${opts.sub ? `<p class="subt">${opts.sub}</p>` : ''}</header>`;
  }
  function bindBack(to) { $app.querySelectorAll('[data-back]').forEach(b => b.onclick = () => { if (history.length > 1 && bindBack.prev) history.back(); else go(to); }); }
  const progBar = (i, n) => `<div class="prog"><span>${fd(i + 1)} از ${fd(n)}</span><span class="bar"><i style="width:${Math.round((i + 1) / n * 100)}%"></i></span></div>`;
  const levelSeen = code => { const ss = ALL.filter(s => s.lesson.startsWith(code.toLowerCase())); return ss.length ? ss.filter(s => S.seen[s.id]).length / ss.length : 0; };
  function isBm(id) { return S.bm.includes(id); }
  function toggleBm(id) { if (isBm(id)) S.bm = S.bm.filter(x => x !== id); else S.bm.push(id); save(); toast(isBm(id) ? 'به نشان‌شده‌ها اضافه شد ★' : 'از نشان‌شده‌ها برداشته شد'); return isBm(id); }
  function preload(list) { return Promise.all(list.flatMap(s => [A.load(s.id)].concat((s.t || []).map(t => A.load(t.a))))); }
  const sizeCls = s => s.en.length > 26 ? 'sen mid' : 'sen';

  /* ---------- home (scrolls) ---------- */
  function home() {
    const nbm = S.bm.length;
    $app.innerHTML = header('<span class="brand en">Sentra NL</span>', { right: flags, sub: 'هلندی · جمله به جمله' }) +
      `<main class="body scroll">
        <div class="card intro">هر روز چند <b>جملهٔ واقعی</b> با صدای طبیعی مرد و زن بشنو، معنی و <b>خوانش فارسی</b> هر جمله را ببین، و با شش تمرین آن را بساز، بگو و بنویس.</div>
        <button class="ptest" data-test><span class="ic">🎯</span><span><b>تعیین سطح رایگان</b><span>۲۰ سؤال کوتاه · سطح مناسبت را پیشنهاد می‌کنیم</span></span><span class="go">←</span></button>
        <h2 class="sec">سطح‌ها</h2>
        <div class="levels">${LEVELS.map(L => {
          const has = LESSONS.some(l => l.level === L.code), p = levelSeen(L.code);
          return `<button class="lvl ${L.c} ${has ? '' : 'soon'}" data-level="${L.code}">${S.place === L.code ? '<span class="rec">پیشنهاد تو</span>' : ''}
            <span class="code">${L.code}</span><span class="ent">${L.en}</span><span class="fat">${L.fa}</span>
            <span class="meta">${fd(L.n)} درس · ${has ? `${fd(Math.round(p * 100))}٪` : 'به‌زودی'}</span><span class="bar"><i style="width:${Math.round(p * 100)}%"></i></span></button>`;
        }).join('')}</div>
        <button class="card row-btn" data-bms><span class="ic">★</span><b>جمله‌های نشان‌شده</b><span class="n">${fd(nbm)}</span></button>
        <button class="btn btn-line btn-block" data-install>📲 نصب اپ</button>
        <p class="credit">ساخته شده توسط <b class="en">Daniel Mozafari</b></p>
      </main>`;
    $app.querySelector('[data-test]').onclick = () => go('#/test');
    $app.querySelector('[data-bms]').onclick = () => go('#/bookmarks');
    $app.querySelectorAll('[data-level]').forEach(b => b.onclick = () => {
      const code = b.dataset.level;
      if (LESSONS.some(l => l.level === code)) go('#/level/' + code); else toast(`سطح ${code} به‌زودی آماده می‌شود`);
    });
  }

  /* ---------- level: lesson list (scrolls) ---------- */
  function level(code) {
    const L = LEVELS.find(x => x.code === code) || LEVELS[0];
    const ls = LESSONS.filter(l => l.level === L.code);
    $app.innerHTML = header(`<span class="en">${L.code}</span> <span class="dot">●</span> ${L.fa}`, { back: true, pill: `<span class="pill gray en">${L.en}</span>` }) +
      `<main class="body scroll">${ls.map(l => {
        const n = l.s.filter(s => S.seen[s.id]).length, done = n === l.s.length;
        return `<button class="card lrow ${L.c} ${done ? 'done' : ''}" data-lesson="${l.id}"><span class="num">${fd(l.num)}</span><span class="t"><b>درس ${fd(l.num)} · ${esc(l.fa)}</b><span class="d"><span class="en">${l.en}</span> · ${fd(l.s.length)} جمله</span><span class="bar"><i style="width:${Math.round(n / l.s.length * 100)}%"></i></span></span><span class="st">${done ? '✓ تمام' : n ? fd(n) + ' از ' + fd(l.s.length) : 'شروع'}</span></button>`;
      }).join('')}
      ${Array.from({ length: L.n - ls.length }, (_, i) => `<div class="card lrow soon ${L.c}"><span class="num">${fd(ls.length + i + 1)}</span><span class="t"><b>درس ${fd(ls.length + i + 1)}</b><span class="d">در نسخهٔ کامل</span></span><span class="st">به‌زودی</span></div>`).join('')}</main>`;
    bindBack('#/');
    $app.querySelectorAll('[data-lesson]').forEach(b => b.onclick = () => go('#/lesson/' + b.dataset.lesson));
    const nx = $app.querySelector('.lrow:not(.done)[data-lesson]');
    if (nx && nx !== $app.querySelector('.lrow[data-lesson]')) nx.scrollIntoView({ block: 'center' });
  }

  /* ---------- lesson: big sentence, autoplay + auto-advance, six modes ---------- */
  function lesson(id) {
    const l = lessonById(id) || LESSONS[0], N = l.s.length, t = tok;
    let i = Math.min(S.pos[l.id] || 0, N - 1), playing = true, finished = false;
    const nextL = LESSONS[LESSONS.indexOf(l) + 1];
    $app.innerHTML = header(`درس ${fd(l.num)} <span class="dot">●</span> <span class="blue">${esc(l.fa)}</span>`, { back: true, pill: `<span class="pill en">${l.level}</span>` }) +
      `<main class="body"><div id="pg"></div><section class="card scard" id="sc"></section>
        <div class="ctrls"><button class="btn btn-line" data-prev>→ قبلی</button><button class="btn btn-coral main" data-pp>⏸ توقف</button><button class="btn btn-line" data-next>بعدی ←</button></div>
        <div class="modes">${MODES.map(m => `<button class="mode ${m.c}" data-mode="${m.id}"><span class="ic">${m.ic}</span><b>${m.fa}</b></button>`).join('')}</div></main>`;
    bindBack('#/level/' + l.level);
    const sc = $app.querySelector('#sc'), pg = $app.querySelector('#pg'), pp = $app.querySelector('[data-pp]');
    function paint() {
      const s = l.s[i];
      pg.innerHTML = progBar(i, N);
      if (finished) { sc.innerHTML = `<div class="done-box"><span class="big">🎉</span><b>درس تمام شد!</b><p>هر ${fd(N)} جمله را شنیدی. حالا با «تمرین کن» جمله‌ها را خودت بساز.</p><div class="btnrow">${nextL ? '<button class="btn btn-coral" data-nextl>درس بعد ←</button>' : ''}<button class="btn btn-line" data-again>↺ دوباره</button></div></div>`;
        sc.querySelector('[data-again]').onclick = () => { finished = false; i = 0; playing = true; run(); };
        const nb = sc.querySelector('[data-nextl]'); if (nb) nb.onclick = () => go('#/lesson/' + nextL.id); return; }
      sc.innerHTML = `<div class="top"><span class="gnum en">#${s.n}</span><span class="voice">${s.v === 'm' ? '👨 صدای مرد' : '👩 صدای زن'}</span><button class="bm ${isBm(s.id) ? 'on' : ''}" data-bm aria-label="نشان کردن">${isBm(s.id) ? '★' : '☆'}</button></div>
        <div class="smain fadein"><p class="${sizeCls(s)}" id="sen">${esc(s.en)}</p><p class="sfa">${esc(s.fa)}</p><p class="srd">${esc(s.rd)}</p></div>`;
      sc.querySelector('[data-bm]').onclick = e => { const on = toggleBm(s.id); e.currentTarget.classList.toggle('on', on); e.currentTarget.textContent = on ? '★' : '☆'; };
      pp.innerHTML = playing ? '⏸ توقف' : '▶ پخش';
    }
    let run = async function () {
      const my = ++run.k; A.stop(); paint();
      if (!playing || finished) return;
      keepAwake();
      while (alive(t) && my === run.k && playing) {
        const s = l.s[i]; paint();
        const el = sc.querySelector('#sen'); el && el.classList.add('playing');
        const ok = await say(s.id, t);
        el && el.classList.remove('playing');
        if (!ok || my !== run.k || !playing) return;
        S.seen[s.id] = 1; S.pos[l.id] = i; save();
        if (!(await sleep(2000, t)) || my !== run.k || !playing) return;
        if (i >= N - 1) { finished = true; S.pos[l.id] = 0; save(); paint(); return; }
        i++;
      }
    };
    run.k = 0;
    pp.onclick = () => { playing = !playing; if (!playing) { run.k++; A.stop(); paint(); } else run(); };
    $app.querySelector('[data-prev]').onclick = () => { finished = false; i = Math.max(0, i - 1); S.pos[l.id] = i; save(); run(); };
    $app.querySelector('[data-next]').onclick = () => { finished = false; i = Math.min(N - 1, i + 1); S.pos[l.id] = i; save(); run(); };
    $app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => go(`#/mode/${l.id}/${b.dataset.mode}`));
    paint();
    preload(l.s.slice(i, i + 3)).then(() => { if (alive(t)) run(); preload(l.s); });
  }

  /* ---------- mode frame ---------- */
  function frame(l, m, list, extra = '') {
    $app.innerHTML = header(`${m.ic} ${m.fa}`, { back: true, pill: `<span class="pill en">${l ? l.level + ' · L' + l.num : '★'}</span>` }) + `<main class="body" id="mb">${extra}<div id="pg"></div><div id="mx" style="display:contents"></div></main>`;
    bindBack(l ? '#/lesson/' + l.id : '#/bookmarks');
    return { pg: $app.querySelector('#pg'), mx: $app.querySelector('#mx') };
  }
  function doneScreen(mx, pg, msg, again) {
    pg.innerHTML = '';
    mx.innerHTML = `<section class="card scard"><div class="done-box"><span class="big">🎉</span><b>آفرین!</b><p>${msg}</p><div class="btnrow"><button class="btn btn-coral" data-again>↺ دوباره</button><button class="btn btn-line" data-back2>بازگشت به درس</button></div></div></section>`;
    mx.querySelector('[data-again]').onclick = again;
    mx.querySelector('[data-back2]').onclick = () => $app.querySelector('[data-back]').click();
  }
  const cleanW = w => fold(w.toLowerCase().replace(/[’‘`´]/g, "'")).replace(/y/g, 'ij').replace(/[^a-z0-9'\-]/g, '');
  const NUMS = { 0: 'nul', 1: 'een', 2: 'twee', 3: 'drie', 4: 'vier', 5: 'vijf', 6: 'zes', 7: 'zeven', 8: 'acht', 9: 'negen', 10: 'tien', 11: 'elf', 12: 'twaalf', 13: 'dertien', 14: 'veertien', 15: 'vijftien', 16: 'zestien', 17: 'zeventien', 18: 'achttien', 19: 'negentien', 20: 'twintig', 30: 'dertig', 40: 'veertig', 50: 'vijftig', 60: 'zestig', 70: 'zeventig', 80: 'tachtig', 90: 'negentig', 100: 'honderd' };
  /* Dutch spoken/written short forms → full words, so 't = het, m'n = mijn, dankjewel = dank je wel … */
  const CONTR = { "'t": 'het', "'n": 'een', "'k": 'ik', "'m": 'hem', "'ns": 'eens', "m'n": 'mijn', "z'n": 'zijn', "zo'n": 'zo een', "da's": 'dat is', "hoe's": 'hoe is',
    'dankjewel': 'dank je wel', 'dankuwel': 'dank u wel', 'dankje': 'dank je', 'oke': 'ok', 'okee': 'ok', 'okay': 'ok', 'goedenmorgen': 'goedemorgen', 'goedenmiddag': 'goedemiddag', 'goedeavond': 'goedenavond' };
  function norm(text) {
    return text.split(/\s+/).map(cleanW).filter(Boolean).flatMap(w => (CONTR[w] || NUMS[w] || w).split(/[\s\-]+/)).filter(Boolean);
  }
  function lev(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
  const near = (a, b) => a === b ? 2 : (a.length >= 4 && lev(a, b) <= (a.length >= 7 ? 2 : 1)) ? 1 : 0;
  /* align target words with typed/heard words (LCS on fuzzy match) → per target-word grade 2 exact / 1 near / 0 missing */
  function grade(target, got) {
    const T = norm(target), G = norm(got), n = T.length, m = G.length;
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) { const s = near(T[i], G[j]); dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1], s ? dp[i + 1][j + 1] + s : 0); }
    const res = []; let i = 0, j = 0;
    while (i < n) { const s = j < m ? near(T[i], G[j]) : 0;
      if (j < m && s && dp[i][j] === dp[i + 1][j + 1] + s) { res.push(s); i++; j++; } else if (j < m && dp[i][j] === dp[i][j + 1]) j++; else { res.push(0); i++; } }
    return { T, res, score: res.reduce((a, b) => a + (b ? 1 : 0), 0) / Math.max(1, n), exact: res.every(x => x === 2) };
  }
  /* show the original sentence words coloured by grade (contractions expand to several target words: worst grade wins) */
  function colourWords(en, g) {
    let k = 0;
    return en.split(/\s+/).map(w => { const parts = norm(w).length; const gs = g.res.slice(k, k + parts); k += parts; const v = Math.min(...gs); return `<span class="${v === 2 ? 'ok' : v === 1 ? 'near' : 'miss'}">${esc(w)}</span>`; }).join(' ');
  }

  function listFor(lid) { if (lid === 'bm') return S.bm.map(byId).filter(Boolean); return (lessonById(lid) || LESSONS[0]).s; }

  /* ---------- 1) practice: build the sentence from tiles ---------- */
  function practice(l, list, start) {
    const m = MODES[0], { pg, mx } = frame(l, m, list), t = tok, N = list.length; let i = Math.min(start || 0, Math.max(0, list.length - 1));
    function show() {
      if (!alive(t)) return;
      if (i >= N) return doneScreen(mx, pg, `همهٔ ${fd(N)} جمله را خودت ساختی.`, () => { i = 0; show(); });
      const s = list[i], toks = s.t.map((x, k) => Object.assign({ k, b: bareW(x.w) }, x));
      const order = toks.slice().sort(() => Math.random() - .5); let pos = 0, busy = false, miss = 0;
      pg.innerHTML = progBar(i, N);
      mx.innerHTML = `<section class="card scard ${toks.length >= 9 ? 'dense' : ''}" style="gap:var(--g);justify-content:space-between"><div class="top"><span class="gnum en">#${s.n}</span><span class="voice">کلمه‌ها را به ترتیب بزن</span><button class="bm ${isBm(s.id) ? 'on' : ''}" data-bm>${isBm(s.id) ? '★' : '☆'}</button></div>
        <div class="goal"><p class="fa">${esc(s.fa)}</p></div><div class="slots" id="slots"></div><div class="tiles" id="tiles">${order.map(x => `<button class="tile" data-k="${x.k}"><b>${esc(x.b)}</b><small>${esc(x.r.replace(/[،.!؟?]/g, ''))}</small></button>`).join('')}</div>
        <div class="reveal" id="rv"></div><span></span></section>
        <div class="ctrls"><button class="btn btn-line" data-help>💡 کمک</button><button class="btn btn-line" data-listen>🔊 جمله</button><button class="btn btn-line" data-skip>رد شو ←</button></div>`;
      const slots = mx.querySelector('#slots');
      mx.querySelector('[data-bm]').onclick = e => { const on = toggleBm(s.id); e.currentTarget.classList.toggle('on', on); e.currentTarget.textContent = on ? '★' : '☆'; };
      mx.querySelector('[data-help]').onclick = () => { const want = toks[pos]; if (!want) return; mx.querySelectorAll('.tile.hint').forEach(x => x.classList.remove('hint')); const el = [...mx.querySelectorAll('#tiles .tile:not(.used)')].find(x => toks[+x.dataset.k].b.toLowerCase() === want.b.toLowerCase()); el && el.classList.add('hint'); };
      mx.querySelector('[data-listen]').onclick = () => A.play(s.id);
      mx.querySelector('[data-skip]').onclick = () => { i++; show(); };
      mx.querySelectorAll('#tiles .tile').forEach(b => b.onclick = async () => {
        if (busy) return; const x = toks[+b.dataset.k], want = toks[pos];
        const p = A.play(x.a);
        if (x.b.toLowerCase() !== want.b.toLowerCase()) { miss++; b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad'); return; }
        b.classList.add('used'); b.classList.remove('hint');
        slots.insertAdjacentHTML('beforeend', `<span class="tile"><b>${esc(want.w)}</b><small>${esc(want.r)}</small></span>`);
        pos++;
        if (pos === toks.length) {
          busy = true; slots.classList.add('ok'); S.practiced[s.id] = 1; S.seen[s.id] = 1; save();
          await p; if (!(await sleep(1000, t))) return;
          mx.querySelector('#rv').innerHTML = `<p class="srd fadein">${esc(s.rd)}</p>`;
          if (!(await say(s.id, t))) return;
          if (!(await sleep(2000, t))) return;
          i++; show();
        }
      });
    }
    show(); preload(list);
  }

  /* ---------- 2) speak: speech recognition with word-level match ---------- */
  function speak(l, list, start) {
    const m = MODES[1], { pg, mx } = frame(l, m, list), t = tok, N = list.length; let i = Math.min(start || 0, Math.max(0, list.length - 1)), rec = null, granted = false;
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    cleanup.push(() => { if (rec) try { rec.abort(); } catch (e) {} });
    function show() {
      if (!alive(t)) return;
      if (i >= N) return doneScreen(mx, pg, `همهٔ ${fd(N)} جمله را گفتی.`, () => { i = 0; show(); });
      const s = list[i]; pg.innerHTML = progBar(i, N);
      mx.innerHTML = `<section class="card scard"><div class="top"><span class="gnum en">#${s.n}</span><span class="voice">${SR ? 'بشنو، بعد میکروفون را بزن و بگو' : 'بشنو و بلند تکرار کن'}</span><button class="bm ${isBm(s.id) ? 'on' : ''}" data-bm>${isBm(s.id) ? '★' : '☆'}</button></div>
        <div class="smain"><p class="words" id="w">${esc(s.en)}</p><p class="srd">${esc(s.rd)}</p><p class="sfa">${esc(s.fa)}</p></div>
        <p class="heard" id="hd"></p><p class="score" id="sc"></p></section>
        ${SR ? `<button class="mic" id="mic" aria-label="بگو">🎤</button>` : `<p class="note">مرورگر تو تشخیص گفتار ندارد (Chrome اندروید یا Safari آیفون را امتحان کن). جمله را بلند بگو و خودت تأیید کن.</p>`}
        <div class="ctrls"><button class="btn btn-line" data-listen>🔊 بشنو</button>${SR ? '' : '<button class="btn btn-green" data-self>✓ گفتم</button>'}<button class="btn btn-line" data-skip>بعدی ←</button></div>`;
      mx.querySelector('[data-bm]').onclick = e => { const on = toggleBm(s.id); e.currentTarget.classList.toggle('on', on); e.currentTarget.textContent = on ? '★' : '☆'; };
      mx.querySelector('[data-listen]').onclick = () => A.play(s.id);
      mx.querySelector('[data-skip]').onclick = () => { stopRec(); i++; show(); };
      const self = mx.querySelector('[data-self]'); if (self) self.onclick = () => { S.spoken[s.id] = 1; save(); i++; show(); };
      const mic = mx.querySelector('#mic'); if (mic) mic.onclick = () => (rec ? stopRec() : listen(s));
      (async () => { if (await say(s.id, t) && granted && SR && list[i] === s) listen(s); })();
    }
    function stopRec() { if (rec) { try { rec.abort(); } catch (e) {} rec = null; } const mic = mx.querySelector('#mic'); mic && mic.classList.remove('on'); }
    function listen(s) {
      A.stop(); stopRec();
      const r = new SR(); rec = r; r.lang = 'nl-NL'; r.interimResults = true; r.maxAlternatives = 3; r.continuous = false;
      const mic = mx.querySelector('#mic'), hd = mx.querySelector('#hd'), sc = mx.querySelector('#sc');
      mic && mic.classList.add('on'); hd.innerHTML = 'دارم گوش می‌دهم… 👂'; sc.textContent = ''; sc.className = 'score';
      let best = null;
      r.onresult = e => {
        granted = true;
        const res = e.results[e.results.length - 1];
        const alts = [...res].map(a => a.transcript);
        const g = alts.map(a => ({ a, g: grade(s.en, a) })).sort((x, y) => y.g.score - x.g.score)[0];
        best = g; hd.innerHTML = 'شنیدم: <span class="en">' + esc(g.a) + '</span>';
        mx.querySelector('#w').innerHTML = colourWords(s.en, g.g);
        if (res.isFinal) finish();
      };
      r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { hd.textContent = 'اجازهٔ میکروفون داده نشد. از تنظیمات مرورگر اجازه بده.'; } else if (e.error === 'no-speech') hd.textContent = 'صدایی نشنیدم؛ دوباره میکروفون را بزن.'; else if (e.error !== 'aborted') hd.textContent = 'خطا در تشخیص گفتار: ' + e.error; };
      r.onend = () => { if (rec === r) { rec = null; mic && mic.classList.remove('on'); if (best) finish(); } };
      let fin = false;
      async function finish() {
        if (fin || !best) return; fin = true; stopRec();
        const p = Math.round(best.g.score * 100);
        sc.textContent = p >= 80 ? `عالی! ${fd(p)}٪ درست 🎉` : p >= 50 ? `خوب بود · ${fd(p)}٪ · یک بار دیگر بگو` : `${fd(p)}٪ · دوباره گوش کن و بگو`;
        sc.className = 'score ' + (p >= 80 ? 'good' : p >= 50 ? 'mid' : 'low');
        if (p >= 80) { S.spoken[s.id] = 1; save(); if (await sleep(1800, t) && list[i] === s) { i++; show(); } }
      }
      try { r.start(); } catch (e) { hd.textContent = 'میکروفون شروع نشد.'; rec = null; mic && mic.classList.remove('on'); }
    }
    show(); preload(list);
  }

  /* ---------- 3) listen: hands-free Dutch-only stream ---------- */
  function listenMode(l, list, start) {
    const m = MODES[2], { pg, mx } = frame(l, m, list), t = tok, N = list.length; let i = Math.min(start || 0, Math.max(0, list.length - 1)), playing = true, showFa = false;
    let k = 0;
    function paint() {
      const s = list[i]; pg.innerHTML = progBar(i, N);
      mx.innerHTML = `<section class="card scard"><div class="top"><span class="gnum en">#${s.n}</span><span class="voice">${s.v === 'm' ? '👨' : '👩'} فقط گوش بده</span><button class="bm ${isBm(s.id) ? 'on' : ''}" data-bm>${isBm(s.id) ? '★' : '☆'}</button></div>
        <div class="smain fadein"><p class="${sizeCls(s)}" id="sen">${esc(s.en)}</p><p class="sfa ${showFa ? '' : 'hide'}">${esc(s.fa)}</p><p class="srd ${showFa ? '' : 'hide'}">${esc(s.rd)}</p></div></section>
        <div class="seg"><button class="${showFa ? '' : 'on'}" data-fa="0">فقط هلندی</button><button class="${showFa ? 'on' : ''}" data-fa="1">با معنی و خوانش</button></div>
        <div class="ctrls"><button class="btn btn-line" data-prev>→ قبلی</button><button class="btn btn-blue main" data-pp>${playing ? '⏸ توقف' : '▶ پخش'}</button><button class="btn btn-line" data-next>بعدی ←</button></div>`;
      mx.querySelector('[data-bm]').onclick = e => { const on = toggleBm(s.id); e.currentTarget.classList.toggle('on', on); e.currentTarget.textContent = on ? '★' : '☆'; };
      mx.querySelectorAll('[data-fa]').forEach(b => b.onclick = () => { showFa = b.dataset.fa === '1'; mx.querySelectorAll('.sfa,.srd').forEach(x => x.classList.toggle('hide', !showFa)); mx.querySelectorAll('[data-fa]').forEach(x => x.classList.toggle('on', x === b)); });
      mx.querySelector('[data-pp]').onclick = () => { playing = !playing; if (playing) loop(); else { k++; A.stop(); paint(); } };
      mx.querySelector('[data-prev]').onclick = () => { i = Math.max(0, i - 1); loop(); };
      mx.querySelector('[data-next]').onclick = () => { i = Math.min(N - 1, i + 1); loop(); };
    }
    async function loop() {
      const my = ++k; A.stop(); paint(); if (!playing) return; keepAwake();
      while (alive(t) && my === k) {
        paint(); const el = mx.querySelector('#sen'); el.classList.add('playing');
        if (!(await say(list[i].id, t)) || my !== k) return; el.classList.remove('playing');
        S.seen[list[i].id] = 1; save();
        if (!(await sleep(1200, t)) || my !== k) return;
        if (i >= N - 1) return doneScreen(mx, pg, `هر ${fd(N)} جمله را گوش دادی.`, () => { i = 0; playing = true; loop(); });
        i++;
      }
    }
    preload(list).then(() => alive(t) && loop()); paint();
  }

  /* ---------- 4) auto review: Dutch → pause → Persian meaning → Dutch again → next ---------- */
  function review(l, list, start) {
    const m = MODES[3], { pg, mx } = frame(l, m, list), t = tok, N = list.length; let i = Math.min(start || 0, Math.max(0, list.length - 1)), playing = true, k = 0;
    if (!N) { mx.innerHTML = '<p class="empty">هنوز جمله‌ای نشان نکرده‌ای. در درس روی ☆ بزن.</p>'; return; }
    const STEPS = ['هلندی', 'مکث', 'معنی', 'تکرار'];
    function paint(step) {
      const s = list[i]; pg.innerHTML = progBar(i, N);
      const reveal = step >= 2;
      mx.innerHTML = `<div class="steps">${STEPS.map((x, j) => `<span class="${j === step ? 'on' : ''}">${x}</span>`).join('')}</div>
        <section class="card scard"><div class="top"><span class="gnum en">#${s.n}</span><span class="voice">بدون دست زدن · مثل پادکست</span><button class="bm ${isBm(s.id) ? 'on' : ''}" data-bm>${isBm(s.id) ? '★' : '☆'}</button></div>
        <div class="smain"><p class="${sizeCls(s)} ${step === 0 || step === 3 ? 'playing' : ''}">${esc(s.en)}</p><p class="sfa ${reveal ? 'fadein' : 'hide'}">${esc(s.fa)}</p><p class="srd ${reveal ? 'fadein' : 'hide'}">${esc(s.rd)}</p></div></section>
        <div class="ctrls"><button class="btn btn-line" data-prev>→ قبلی</button><button class="btn btn-green main" data-pp>${playing ? '⏸ توقف' : '▶ پخش'}</button><button class="btn btn-line" data-next>بعدی ←</button></div>`;
      mx.querySelector('[data-bm]').onclick = e => { const on = toggleBm(s.id); e.currentTarget.classList.toggle('on', on); e.currentTarget.textContent = on ? '★' : '☆'; };
      mx.querySelector('[data-pp]').onclick = () => { playing = !playing; if (playing) loop(); else { k++; A.stop(); paint(-1); } };
      mx.querySelector('[data-prev]').onclick = () => { i = Math.max(0, i - 1); loop(); };
      mx.querySelector('[data-next]').onclick = () => { i = Math.min(N - 1, i + 1); loop(); };
    }
    async function loop() {
      const my = ++k; A.stop(); if (!playing) return paint(-1); keepAwake();
      const ok = () => alive(t) && my === k;
      while (ok()) {
        const s = list[i];
        paint(0); if (!(await say(s.id, t)) || !ok()) return;
        paint(1); if (!(await sleep(1500, t)) || !ok()) return;
        paint(2); if (!(await sleep(2600, t)) || !ok()) return;
        paint(3); if (!(await say(s.id, t)) || !ok()) return;
        S.seen[s.id] = 1; save();
        if (!(await sleep(1500, t)) || !ok()) return;
        if (i >= N - 1) return doneScreen(mx, pg, `مرور ${fd(N)} جمله تمام شد.`, () => { i = 0; playing = true; loop(); });
        i++;
      }
    }
    preload(list).then(() => alive(t) && loop()); paint(-1);
  }

  /* ---------- 5) dictation: hear, type, forgiving check ---------- */
  function dictation(l, list, start) {
    const m = MODES[4], { pg, mx } = frame(l, m, list), t = tok, N = list.length; let i = Math.min(start || 0, Math.max(0, list.length - 1));
    function show() {
      if (!alive(t)) return;
      if (i >= N) return doneScreen(mx, pg, `دیکتهٔ ${fd(N)} جمله تمام شد.`, () => { i = 0; show(); });
      const s = list[i]; pg.innerHTML = progBar(i, N); let shown = false;
      mx.innerHTML = `<section class="card scard" style="gap:var(--g)"><div class="top"><span class="gnum en">#${s.n}</span><span class="voice">بشنو و بنویس</span><button class="bm ${isBm(s.id) ? 'on' : ''}" data-bm>${isBm(s.id) ? '★' : '☆'}</button></div>
        <div class="smain"><p class="sfa">${esc(s.fa)}</p><p class="words" id="w"></p><p class="score" id="sc"></p></div></section>
        <input class="dict" id="in" type="text" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="done" placeholder="Type what you hear…" />
        <div class="ctrls"><button class="btn btn-line" data-listen>🔊 دوباره</button><button class="btn btn-coral main" data-check>✓ بررسی</button><button class="btn btn-line" data-show>👁 جواب</button></div>`;
      const inp = mx.querySelector('#in'), w = mx.querySelector('#w'), sc = mx.querySelector('#sc');
      mx.querySelector('[data-bm]').onclick = e => { const on = toggleBm(s.id); e.currentTarget.classList.toggle('on', on); e.currentTarget.textContent = on ? '★' : '☆'; };
      mx.querySelector('[data-listen]').onclick = () => A.play(s.id);
      mx.querySelector('[data-show]').onclick = () => { if (shown) { i++; show(); return; } shown = true; w.innerHTML = esc(s.en); sc.className = 'score mid'; sc.textContent = 'جواب درست · برای جملهٔ بعد دوباره بزن'; mx.querySelector('[data-show]').textContent = 'بعدی ←'; A.play(s.id); };
      async function check() {
        const g = grade(s.en, inp.value); w.innerHTML = colourWords(s.en, g);
        const p = Math.round(g.score * 100);
        if (g.res.every(Boolean)) {
          S.dict[s.id] = 1; S.seen[s.id] = 1; save(); inp.blur();
          sc.className = 'score good'; sc.textContent = g.exact ? 'کاملاً درست! 🎉' : 'درست! (زردها املای نزدیک بودند)';
          if (!(await say(s.id, t))) return; if (await sleep(1800, t) && list[i] === s) { i++; show(); }
        } else { sc.className = 'score ' + (p >= 50 ? 'mid' : 'low'); sc.textContent = `${fd(p)}٪ درست · قرمزها را دوباره گوش کن`; }
      }
      mx.querySelector('[data-check]').onclick = check;
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); check(); } });
      say(s.id, t);
    }
    show(); preload(list);
  }

  /* ---------- 6) shadowing: play, then your turn (same length + margin), optionally twice ---------- */
  function shadow(l, list, start) {
    const m = MODES[5], { pg, mx } = frame(l, m, list), t = tok, N = list.length; let i = Math.min(start || 0, Math.max(0, list.length - 1)), playing = true, reps = 2, k = 0;
    function paint(phase, rep) {
      const s = list[i]; pg.innerHTML = progBar(i, N);
      mx.innerHTML = `<section class="card scard"><div class="top"><span class="gnum en">#${s.n}</span><span class="voice">${rep ? `دور ${fd(rep)} از ${fd(reps)}` : 'آماده'}</span><button class="bm ${isBm(s.id) ? 'on' : ''}" data-bm>${isBm(s.id) ? '★' : '☆'}</button></div>
        <div class="smain"><p class="${sizeCls(s)} ${phase === 'play' ? 'playing' : ''}">${esc(s.en)}</p><p class="srd">${esc(s.rd)}</p><p class="sfa">${esc(s.fa)}</p></div>
        <p class="turn ${phase === 'you' ? 'you' : ''}">${phase === 'play' ? '👂 گوش کن…' : phase === 'you' ? '🗣️ حالا تو بگو!' : ''}</p><div class="ring"><i id="ring"></i></div></section>
        <div class="seg"><button class="${reps === 1 ? 'on' : ''}" data-r="1">هر جمله ۱ بار</button><button class="${reps === 2 ? 'on' : ''}" data-r="2">هر جمله ۲ بار</button></div>
        <div class="ctrls"><button class="btn btn-line" data-prev>→ قبلی</button><button class="btn btn-gold main" data-pp>${playing ? '⏸ توقف' : '▶ پخش'}</button><button class="btn btn-line" data-next>بعدی ←</button></div>`;
      mx.querySelector('[data-bm]').onclick = e => { const on = toggleBm(s.id); e.currentTarget.classList.toggle('on', on); e.currentTarget.textContent = on ? '★' : '☆'; };
      mx.querySelectorAll('[data-r]').forEach(b => b.onclick = () => { reps = +b.dataset.r; mx.querySelectorAll('[data-r]').forEach(x => x.classList.toggle('on', x === b)); });
      mx.querySelector('[data-pp]').onclick = () => { playing = !playing; if (playing) loop(); else { k++; A.stop(); paint(); } };
      mx.querySelector('[data-prev]').onclick = () => { i = Math.max(0, i - 1); loop(); };
      mx.querySelector('[data-next]').onclick = () => { i = Math.min(N - 1, i + 1); loop(); };
    }
    async function loop() {
      const my = ++k; A.stop(); if (!playing) return paint(); keepAwake();
      const ok = () => alive(t) && my === k;
      while (ok()) {
        const s = list[i];
        for (let r = 1; r <= reps; r++) {
          paint('play', r); if (!(await say(s.id, t)) || !ok()) return;
          paint('you', r); const ms = Math.round(A.dur(s.id) * 1000 * 1.25 + 600);
          const ring = mx.querySelector('#ring'); ring.style.transition = 'none'; ring.style.width = '0'; void ring.offsetWidth; ring.style.transition = `width ${ms}ms linear`; ring.style.width = '100%';
          if (!(await sleep(ms, t)) || !ok()) return;
        }
        S.seen[s.id] = 1; save();
        if (i >= N - 1) return doneScreen(mx, pg, `همهٔ ${fd(N)} جمله را همراه گوینده گفتی.`, () => { i = 0; playing = true; loop(); });
        i++; if (!(await sleep(500, t)) || !ok()) return;
      }
    }
    preload(list).then(() => alive(t) && loop()); paint();
  }

  /* ---------- placement test (20 questions, A1 → C2, Dutch) ---------- */
  const TEST = [
    { lv: 0, q: 'جای خالی را پر کن', s: 'Ik ___ uit Iran.', o: ['kom', 'komt', 'komen', 'kwamen'], a: 0 },
    { lv: 0, q: 'معنی درست کدام است؟', s: 'Waar woon je?', o: ['کجا زندگی می‌کنی؟', 'کجا کار می‌کنی؟', 'اسمت چیه؟', 'کی میای؟'], a: 0, fa: true },
    { lv: 0, q: 'جای خالی را پر کن', s: 'Zij ___ twee broers.', o: ['heeft', 'hebt', 'hebben', 'is'], a: 0 },
    { lv: 0, q: 'جای خالی را پر کن', s: 'Hoe ___ je? — Ik heet Sara.', o: ['heet', 'heten', 'heetst', 'is'], a: 0 },
    { lv: 1, q: 'جای خالی را پر کن', s: 'Gisteren ___ wij naar de film.', o: ['gingen', 'gaan', 'gaat', 'gegaan'], a: 0 },
    { lv: 1, q: 'جای خالی را پر کن', s: 'Mijn broer is ___ dan ik.', o: ['groter', 'meer groot', 'grootst', 'het grootst'], a: 0 },
    { lv: 1, q: 'جای خالی را پر کن', s: 'Ik ___ vorig jaar naar Spanje gegaan.', o: ['ben', 'heb', 'word', 'was'], a: 0 },
    { lv: 1, q: 'جای خالی را پر کن', s: 'Ik ___ gisteren de hele dag gewerkt.', o: ['heb', 'ben', 'word', 'werd'], a: 0 },
    { lv: 2, q: 'جای خالی را پر کن', s: 'Ik blijf vandaag thuis, omdat ___.', o: ['ik ziek ben', 'ben ik ziek', 'ik ben ziek', 'ziek ik ben'], a: 0 },
    { lv: 2, q: 'جای خالی را پر کن', s: 'Als ik meer tijd ___, zou ik meer lezen.', o: ['had', 'heb', 'zal hebben', 'gehad'], a: 0 },
    { lv: 2, q: 'جای خالی را پر کن', s: 'Dit huis ___ in 1950 gebouwd.', o: ['werd', 'wordt', 'heeft', 'had'], a: 0 },
    { lv: 3, q: 'جای خالی را پر کن', s: 'Het boek ___ je me gaf, heb ik al gelezen.', o: ['dat', 'die', 'wat', 'wie'], a: 0 },
    { lv: 3, q: 'جای خالی را پر کن', s: 'Als ik het geweten had, ___ ik je gebeld.', o: ['had', 'heb', 'zal', 'werd'], a: 0 },
    { lv: 3, q: 'معنی درست کدام است؟', s: 'Dat is niet mijn pakkie-an.', o: ['این کار من نیست و به من ربطی ندارد', 'این بستهٔ من نیست', 'از این خوشم نمی‌آید', 'این را نمی‌فهمم'], a: 0, fa: true },
    { lv: 4, q: 'جای خالی را پر کن', s: 'Hoewel hij hard ___, haalde hij het examen niet.', o: ['had gestudeerd', 'studeert', 'zal studeren', 'studeren'], a: 0 },
    { lv: 4, q: 'معنی درست کدام است؟', s: 'Hij heeft een gat in zijn hand.', o: ['خیلی ولخرج است', 'دستش زخمی شده', 'خیلی خسیس است', 'کارش را خوب بلد است'], a: 0, fa: true },
    { lv: 4, q: 'نزدیک‌ترین معنی', s: 'Zij werkt heel nauwgezet.', o: ['zorgvuldig', 'lui', 'vriendelijk', 'haastig'], a: 0 },
    { lv: 5, q: 'نزدیک‌ترین معنی', s: 'Zijn uitleg was nogal omslachtig.', o: ['lang en ingewikkeld', 'kort en duidelijk', 'erg grappig', 'helemaal onjuist'], a: 0 },
    { lv: 5, q: 'معنی درست کدام است؟', s: 'Daar zit een luchtje aan.', o: ['یک چیزی این وسط مشکوک است', 'بوی خوبی می‌دهد', 'هوا آن‌جا خنک است', 'کار خیلی ساده‌ای است'], a: 0, fa: true },
    { lv: 5, q: 'معنی درست کدام است؟', s: 'Ze hebben het besluit op de lange baan geschoven.', o: ['تصمیم را به تعویق انداختند', 'خیلی زود تصمیم گرفتند', 'تصمیم را کاملاً لغو کردند', 'تصمیم را به کس دیگری سپردند'], a: 0, fa: true }];
  /* level = first band (A1→C2) where fewer than 60% of that band's questions were right */
  function placeLevel(right) {
    for (let lv = 0; lv < 6; lv++) { const qs = TEST.map((q, j) => j).filter(j => TEST[j].lv === lv); const ok = qs.filter(j => right[j]).length; if (ok < Math.ceil(qs.length * .6)) return lv; }
    return 5;
  }
  function placement() {
    $app.innerHTML = header('🎯 تعیین سطح', { back: true, pill: '<span class="pill gold">رایگان</span>' }) + '<main class="body" id="tb"></main>';
    bindBack('#/');
    const b = $app.querySelector('#tb'), t = tok; let i = 0, score = 0, right = [];
    function show() {
      if (!alive(t)) return;
      if (i >= TEST.length) {
        const L = LEVELS[placeLevel(right)];
        S.place = L.code; save();
        b.innerHTML = `<section class="card scard"><div class="done-box"><span class="big">🎯</span><p>${fd(score)} از ${fd(TEST.length)} پاسخ درست</p><b>سطح پیشنهادی: <span class="en">${L.code}</span></b><p class="en" style="font-weight:700">${L.en}</p><p>${L.fa}</p>
          <div class="btnrow"><button class="btn btn-coral" data-go>برو به سطح <span class="en">${L.code}</span></button><button class="btn btn-line" data-again>↺ دوباره</button></div><p class="note">این آزمون کوتاه است و فقط یک پیشنهاد می‌دهد.</p></div></section>`;
        b.querySelector('[data-go]').onclick = () => LESSONS.some(l => l.level === L.code) ? go('#/level/' + L.code) : (toast(`سطح ${L.code} به‌زودی آماده می‌شود`), go('#/level/A1'));
        b.querySelector('[data-again]').onclick = () => { i = 0; score = 0; right = []; show(); };
        return;
      }
      const q = TEST[i], ord = q.o.map((_, j) => j).sort(() => Math.random() - .5);
      b.innerHTML = `<div class="qprog">${TEST.map((_, j) => `<i class="${j < i ? 'on' : j === i ? 'cur' : ''}"></i>`).join('')}</div>
        <section class="card qtext"><p class="q">سؤال ${fd(i + 1)} از ${fd(TEST.length)} · ${q.q}</p><p class="stem">${esc(q.s)}</p></section>
        <div class="opts">${ord.map(j => `<button class="opt ${q.fa ? '' : 'en'}" data-o="${j}">${esc(q.o[j])}</button>`).join('')}</div>
        <button class="btn btn-line" data-skip>نمی‌دانم</button>`;
      let lock = false;
      const next = async () => { if (await sleep(900, t)) { i++; show(); } };
      b.querySelectorAll('[data-o]').forEach(o => o.onclick = () => {
        if (lock) return; lock = true; const j = +o.dataset.o;
        b.querySelector(`[data-o="${q.a}"]`).classList.add('ok');
        if (j === q.a) { score++; right[i] = true; } else o.classList.add('bad');
        next();
      });
      b.querySelector('[data-skip]').onclick = () => { if (lock) return; lock = true; b.querySelector(`[data-o="${q.a}"]`).classList.add('ok'); next(); };
    }
    show();
  }

  /* ---------- bookmarks list (scrolls) ---------- */
  function bookmarks() {
    const list = S.bm.map(byId).filter(Boolean);
    $app.innerHTML = header('★ نشان‌شده‌ها', { back: true, pill: `<span class="pill gold">${fd(list.length)}</span>` }) +
      `<main class="body scroll">${list.length ? `<button class="btn btn-green btn-block" data-rev>🔁 مرور خودکار نشان‌شده‌ها</button>` + list.map(s => `<div class="card bmrow"><button class="icb" data-play="${s.id}">🔊</button><div class="t"><p class="e">${esc(s.en)}</p><p class="f">${esc(s.fa)}</p></div><button class="icb" data-del="${s.id}" aria-label="حذف">✕</button></div>`).join('')
        : '<p class="empty">هنوز جمله‌ای نشان نکرده‌ای.<br>در درس روی ☆ بالای جمله بزن.</p>'}</main>`;
    bindBack('#/');
    const r = $app.querySelector('[data-rev]'); if (r) r.onclick = () => go('#/mode/bm/review');
    $app.querySelectorAll('[data-play]').forEach(b => b.onclick = () => A.play(b.dataset.play));
    $app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { toggleBm(b.dataset.del); bookmarks(); });
  }

  /* ---------- router ---------- */
  const MODE_FN = { practice, speak, listen: listenMode, review, dictation, shadow };
  let first = true;
  function route() {
    reset();
    bindBack.prev = !first; first = false;
    const h = (location.hash || '#/').slice(2).split('/');
    if (h[0] === 'level') level(h[1]);
    else if (h[0] === 'lesson') lesson(h[1]);
    else if (h[0] === 'mode' && MODE_FN[h[2]]) { const l = h[1] === 'bm' ? null : (lessonById(h[1]) || LESSONS[0]); MODE_FN[h[2]](l, listFor(h[1]), +h[3] || 0); }
    else if (h[0] === 'test') placement();
    else if (h[0] === 'bookmarks') bookmarks();
    else home();
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && wake === null && tok) {} });
  window.__sentra = { S, grade, norm, bareW };
  route();
})();
