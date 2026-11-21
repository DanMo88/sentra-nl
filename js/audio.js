/* Sentra audio: Web Audio buffers (files are silence-trimmed by tools/trim.py).
   Unlock on the first gesture (iOS/Android), then play even after awaits; HTMLAudio is the fallback. */
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, cur = null, curEl = null, unlockEl = null;
  const bufs = new Map(), pend = new Map();
  const url = n => new URL('audio/' + n + '.mp3', document.baseURI).href;
  /* tiny silent wav — played in the same gesture so later <audio> play() is allowed on iOS */
  const SILENT = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';
  const ensure = () => { if (!ctx && AC) { try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); } } return ctx; };
  function unlock() {
    const c = ensure();
    const resume = c && c.state !== 'running' ? c.resume() : Promise.resolve();
    const beep = () => {
      if (!c) return;
      try {
        const n = Math.max(1, Math.floor((c.sampleRate || 22050) * 0.05));
        const b = c.createBuffer(1, n, c.sampleRate || 22050);
        const s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0);
      } catch (e) {}
    };
    if (resume && resume.then) resume.then(beep).catch(() => {}); else beep();
    try {
      if (!unlockEl) { unlockEl = new Audio(SILENT); unlockEl.preload = 'auto'; unlockEl.setAttribute('playsinline', ''); unlockEl.volume = 0.01; }
      const p = unlockEl.play();
      if (p && p.then) p.then(() => { try { unlockEl.pause(); unlockEl.currentTime = 0; } catch (e) {} }).catch(() => {});
    } catch (e) {}
  }
  ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach(ev =>
    document.addEventListener(ev, unlock, { capture: true, passive: true }));
  function load(name) {
    if (bufs.has(name)) return Promise.resolve(bufs.get(name));
    if (pend.has(name)) return pend.get(name);
    const c = ensure();
    const get = () => fetch(url(name)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    const decode = ab => {
      if (!c) return null;
      try {
        const p = c.decodeAudioData(ab.slice(0));
        if (p && typeof p.then === 'function') return p;
      } catch (e) {}
      return new Promise((ok, no) => c.decodeAudioData(ab.slice(0), ok, no));
    };
    const p = get().catch(() => new Promise(ok => setTimeout(ok, 700)).then(get)).catch(() => new Promise(ok => setTimeout(ok, 1500)).then(get))
      .then(decode)
      .then(b => { bufs.set(name, b); pend.delete(name); return b; })
      .catch(e => { pend.delete(name); console.warn('audio', name, e); return null; });
    pend.set(name, p); return p;
  }
  function stop() {
    if (cur) { const c = cur; cur = null; try { c.src.onended = null; c.src.stop(); } catch (e) {} c.done(false); }
    if (curEl) { try { curEl.onended = null; curEl.onerror = null; curEl.pause(); } catch (e) {} curEl = null; }
  }
  function playTag(src) {
    return new Promise(ok => {
      const el = new Audio();
      el.preload = 'auto';
      el.setAttribute('playsinline', '');
      el.src = src;
      curEl = el;
      let done = false;
      const finish = v => { if (done) return; done = true; if (curEl === el) curEl = null; ok(v); };
      el.onended = () => finish(true);
      el.onerror = () => finish(false);
      const p = el.play();
      if (p && p.then) p.catch(() => finish(false));
    });
  }
  /* play(name) → Promise<boolean>: true when the clip ended by itself, false when stopped or failed */
  async function play(name) {
    stop();
    unlock();
    const c = ensure();
    if (c && c.state !== 'running') { try { await c.resume(); } catch (e) {} }
    const b = await load(name);
    if (b && c && c.state === 'running') {
      stop();
      return new Promise(ok => {
        const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination);
        const me = { src, done: ok }; cur = me;
        src.onended = () => { if (cur === me) cur = null; ok(true); };
        try { src.start(0); } catch (e) { if (cur === me) cur = null; playTag(url(name)).then(ok); }
      });
    }
    return playTag(url(name));
  }
  const dur = name => (bufs.get(name) || {}).duration || 1.5;
  window.SentraAudio = { load, play, stop, dur, unlock, loaded: () => bufs.size, state: () => ctx && ctx.state };
})();
