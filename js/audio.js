/* Sentra audio v4 — iOS: unlock sync in the gesture, keep a looping HTMLAudio session
   (silent switch mutes Web Audio), reuse one <audio> for clips. Android still uses Web Audio. */
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent || '') ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  let ctx = null, cur = null, mediaEl = null, silentEl = null, playTok = 0;
  const bufs = new Map(), pend = new Map();
  const url = n => new URL('audio/' + n + '.mp3', document.baseURI).href;
  /* short silent mp3 — looped so the iOS audio session stays in 'playback' (ringer switch) */
  const SILENT = 'data:audio/mpeg;base64,SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYxLjcuMTAzAAAAAAAAAAAAAAD/84TAAAAAAAAAAAAASW5mbwAAAA8AAAAHAAADYABVVVVVVVVVVVVVVVVVVXFxcXFxcXFxcXFxcXFxjo6Ojo6Ojo6Ojo6Ojo6qqqqqqqqqqqqqqqqqqqrHx8fHx8fHx8fHx8fHx+Pj4+Pj4+Pj4+Pj4+Pj//////////////////8AAAAATGF2YzYxLjE5AAAAAAAAAAAAAAAAJAJAAAAAAAAAA2CZUEkpAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/80TEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEUwAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEpgAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=';

  function setSession() {
    try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) {}
  }
  function tag(src, loop) {
    const el = document.createElement('audio');
    el.preload = 'auto';
    el.playsInline = true;
    el.setAttribute('playsinline', '');
    el.setAttribute('webkit-playsinline', '');
    el.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;left:0;bottom:0';
    if (loop) { el.loop = true; el.volume = 0.01; }
    if (src) el.src = src;
    (document.body || document.documentElement).appendChild(el);
    return el;
  }
  const ensure = () => {
    if (!ctx && AC) {
      try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { try { ctx = new AC(); } catch (e2) { ctx = null; } }
      if (ctx && ctx.addEventListener) ctx.addEventListener('statechange', () => { if (ctx && ctx.state !== 'running') tryResume(); });
    }
    return ctx;
  };
  /* Must run synchronously inside touchend/click — no await before resume + silent start. */
  function unlock() {
    setSession();
    const c = ensure();
    if (c && c.state !== 'running') { try { c.resume(); } catch (e) {} }
    if (c) {
      try {
        const n = Math.max(1, Math.floor((c.sampleRate || 22050) * 0.08));
        const b = c.createBuffer(1, n, c.sampleRate || 22050);
        const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
      } catch (e) {}
    }
    if (isIOS) {
      try {
        if (!silentEl) silentEl = tag(SILENT, true);
        silentEl.play().catch(() => {});
      } catch (e) {}
      try {
        if (!mediaEl) mediaEl = tag();
        if (!mediaEl.src) mediaEl.src = SILENT;
        /* prime this element in the same gesture so later src changes can play() */
        if (mediaEl.paused && !mediaEl.getAttribute('data-clip')) mediaEl.play().catch(() => {});
      } catch (e) {}
    }
  }
  function tryResume() {
    setSession();
    const c = ctx;
    if (c && c.state !== 'running') { try { c.resume(); } catch (e) {} }
    if (silentEl) silentEl.play().catch(() => {});
  }
  ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach(ev =>
    document.addEventListener(ev, unlock, { capture: true, passive: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') tryResume(); });
  window.addEventListener('pageshow', tryResume);
  setSession();

  function load(name) {
    if (bufs.has(name)) return Promise.resolve(bufs.get(name));
    if (pend.has(name)) return pend.get(name);
    const c = ensure();
    const get = () => fetch(url(name)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    const decode = ab => {
      if (!c) return null;
      return new Promise((ok, no) => {
        let settled = false;
        const win = b => { if (!settled) { settled = true; ok(b); } };
        const lose = e => { if (!settled) { settled = true; no(e || new Error('decode')); } };
        try {
          const p = c.decodeAudioData(ab.slice(0), win, lose);
          if (p && typeof p.then === 'function') p.then(win, lose);
        } catch (e) {
          try { c.decodeAudioData(ab.slice(0), win, lose); } catch (e2) { lose(e2); }
        }
      });
    };
    const p = get().catch(() => new Promise(ok => setTimeout(ok, 700)).then(get)).catch(() => new Promise(ok => setTimeout(ok, 1500)).then(get))
      .then(decode)
      .then(b => { bufs.set(name, b); pend.delete(name); return b; })
      .catch(e => { pend.delete(name); console.warn('audio', name, e); return null; });
    pend.set(name, p); return p;
  }
  function stopWeb() {
    if (cur) { const c = cur; cur = null; try { c.src.onended = null; c.src.stop(); } catch (e) {} c.done(false); }
  }
  function stop() {
    stopWeb();
    playTok++;
    if (mediaEl) {
      try { mediaEl.onended = null; mediaEl.onerror = null; mediaEl.onloadeddata = null; mediaEl.pause(); } catch (e) {}
    }
  }
  function playTag(src) {
    const el = mediaEl || (mediaEl = tag());
    const my = ++playTok;
    return new Promise(ok => {
      let done = false;
      const finish = v => {
        if (done || my !== playTok) return;
        done = true;
        el.onended = null; el.onerror = null; el.onloadeddata = null;
        ok(v);
      };
      try { el.pause(); } catch (e) {}
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      el.setAttribute('data-clip', '1');
      const start = () => {
        if (my !== playTok) return;
        const p = el.play();
        if (p && p.then) p.catch(() => finish(false));
      };
      if (el.src === src) {
        try { el.currentTime = 0; } catch (e) {}
        start();
      } else {
        el.src = src;
        try { el.load(); } catch (e) {}
        start();
      }
    });
  }
  function playWeb(b, c, name) {
    return new Promise(ok => {
      const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination);
      const me = { src, done: ok }; cur = me;
      src.onended = () => { if (cur === me) cur = null; ok(true); };
      try { src.start(0); } catch (e) { if (cur === me) cur = null; playTag(url(name)).then(ok); }
    });
  }
  let blobUrl = null;
  const forgetBlob = () => { if (blobUrl) { try { URL.revokeObjectURL(blobUrl); } catch (e) {} blobUrl = null; } };
  /* iOS: play a blob with type audio/mpeg so Safari does not depend on GitHub's audio/mp3 MIME or SW Range */
  async function playIOS(name) {
    const raw = url(name);
    const my = playTok;
    try {
      const r = await fetch(raw);
      if (!r.ok) throw new Error(r.status);
      const ab = await r.arrayBuffer();
      if (my !== playTok) return false;
      forgetBlob();
      blobUrl = URL.createObjectURL(new Blob([ab], { type: 'audio/mpeg' }));
      return await playTag(blobUrl);
    } catch (e) {
      if (my !== playTok) return false;
      return playTag(raw);
    }
  }
  /* play(name) → Promise<boolean>: true when the clip ended by itself, false when stopped or failed */
  async function play(name) {
    stop();
    unlock();
    const src = url(name);
    if (isIOS) return playIOS(name);
    const c = ensure();
    if (c && c.state !== 'running') { try { await c.resume(); } catch (e) {} }
    const b = await load(name);
    if (b && c && c.state === 'running') return playWeb(b, c, name);
    return playTag(src);
  }
  const dur = name => (bufs.get(name) || {}).duration || (mediaEl && mediaEl.getAttribute('data-clip') && mediaEl.duration) || 1.5;
  window.SentraAudio = { load, play, stop, dur, unlock, loaded: () => bufs.size, state: () => ctx && ctx.state, ios: isIOS };
})();
