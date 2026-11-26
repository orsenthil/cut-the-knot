"use strict";

/*
 * The page for The Spigot Algorithm for Pi: drawing and input only; the
 * algorithm is in spigot-for-pi-core.js. Compute starts a run for the number
 * of digits asked for; the digits appear as they drip out, in chunks, in the
 * box. The work is done a slice at a time between frames, so Stop and
 * Continue respond at once, as the applet's thread did.
 */

(function () {
  const Core = SpigotForPiCore;
  const out = document.getElementById("out");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const chunkIn = document.getElementById("chunkIn");
  const fontIn = document.getElementById("fontIn");
  const computeBtn = document.getElementById("computeBtn");
  const stopBtn = document.getElementById("stopBtn");
  const contBtn = document.getElementById("contBtn");

  let run = null;
  let raf = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function show() {
    const digits = run ? run.digits : "";
    out.textContent = Core.chunks(digits, chunkIn.value).join(" ");
    out.style.fontSize = `${Core.clamp(fontIn.value, Core.FONT) / 15}rem`;
    if (run) {
      const left = run.done ? "" : ` of ${run.n}`;
      say(run.done ? `Done: the first ${run.n} digits of pi.` : `${run.digits.length}${left} digits…`, run.done ? "done" : undefined);
    }
    stopBtn.disabled = raf === null;
    contBtn.disabled = raf !== null || !run || run.done;
    if (window.Track) window.Track.state({ n: run ? run.n : Number(nIn.value), chunk: Number(chunkIn.value), font: Number(fontIn.value), digitsSoFar: run ? run.digits.length : 0, done: !!(run && run.done) });
  }

  function loop() {
    const t0 = performance.now();
    while (!run.done && performance.now() - t0 < 12) Core.iterate(run);
    if (run.done) { raf = null; show(); return; }
    show();
    raf = requestAnimationFrame(loop);
  }

  computeBtn.addEventListener("click", () => {
    if (raf !== null) cancelAnimationFrame(raf);
    nIn.value = String(Core.clamp(nIn.value, Core.DIGITS));
    run = Core.start(nIn.value);
    raf = requestAnimationFrame(loop);
    show();
  });
  stopBtn.addEventListener("click", () => {
    if (raf !== null) cancelAnimationFrame(raf);
    raf = null;
    show();
    say(`Stopped after ${run.digits.length} digits.`);
    contBtn.focus();
  });
  contBtn.addEventListener("click", () => {
    if (!run || run.done || raf !== null) return;
    raf = requestAnimationFrame(loop);
    show();
    stopBtn.focus();
  });
  chunkIn.addEventListener("change", () => { chunkIn.value = String(Core.clamp(chunkIn.value, Core.CHUNK)); show(); });
  fontIn.addEventListener("change", () => { fontIn.value = String(Core.clamp(fontIn.value, Core.FONT)); show(); });

  show();
  say("Press Compute to let the digits of pi drip out.");
})();
