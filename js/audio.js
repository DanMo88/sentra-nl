/* Sentra audio: Web Audio buffers decoded up front (files are silence-trimmed by tools/trim.py), so playback starts at once. */
(function () {
  const AC = window.AudioContext || window.webkitAudioContext;
  let ctx = null, cur = null, curEl = null;
  const bufs = new Map(), pend = new Map();
  const ensure = () => { if (!ctx && AC) { try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); } } return ctx; };
  function unlock() {
    const c = ensure(); if (!c) return;
    if (c.state === 'suspended') c.resume().catch(() => {});
    try { const b = c.createBuffer(1, 1, 22050), s = c.createBufferSource(); s.buffer = b; s.connect(c.destination); s.start(0); } catch (e) {}
  }
  ['pointerdown', 'touchend', 'keydown', 'click'].forEach(ev => document.addEventListener(ev, unlock, { capture: true, passive: true }));
  const url = n => 'audio/' + n + '.mp3';
  function load(name) {
    if (bufs.has(name)) return Promise.resolve(bufs.get(name));
    if (pend.has(name)) return pend.get(name);
    const c = ensure();
    const get = () => fetch(url(name)).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); });
    const p = get().catch(() => new Promise(ok => setTimeout(ok, 700)).then(get)).catch(() => new Promise(ok => setTimeout(ok, 1500)).then(get))
      .then(ab => c ? new Promise((ok, no) => c.decodeAudioData(ab, ok, no)) : null)
      .then(b => { bufs.set(name, b); pend.delete(name); return b; })
      .catch(e => { pend.delete(name); console.warn('audio', name, e); return null; });
    pend.set(name, p); return p;
  }
  function stop() {
    if (cur) { const c = cur; cur = null; try { c.src.onended = null; c.src.stop(); } catch (e) {} c.done(false); }
    if (curEl) { try { curEl.pause(); } catch (e) {} curEl = null; }
  }
  /* play(name) → Promise<boolean>: true when the clip ended by itself, false when stopped */
  async function play(name) {
    stop();
    const c = ensure();
    if (c && c.state === 'suspended') { try { await c.resume(); } catch (e) {} }
    const b = await load(name);
    if (!b || !c) return new Promise(ok => { const el = new Audio(url(name)); curEl = el; el.onended = () => ok(true); el.onerror = () => ok(true); el.play().catch(() => ok(true)); });
    stop();
    return new Promise(ok => {
      const src = c.createBufferSource(); src.buffer = b; src.connect(c.destination);
      const me = { src, done: ok }; cur = me;
      src.onended = () => { if (cur === me) cur = null; ok(true); };
      src.start(0);
    });
  }
  const dur = name => (bufs.get(name) || {}).duration || 1.5;
  window.SentraAudio = { load, play, stop, dur, unlock, loaded: () => bufs.size, state: () => ctx && ctx.state };
})();
