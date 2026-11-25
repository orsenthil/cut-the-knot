"use strict";

/*
 * The page for The Means: drawing and input only. The bars are plain elements
 * (role "slider") so they can be dragged and moved with the arrow keys; the
 * first, dashed bar is the mean, and a dashed line crosses all the bars at its
 * height. The rules are in means-core.js.
 */

(function () {
  const Core = MeansCore;
  const plot = document.getElementById("plot");
  const labels = document.getElementById("labels");
  const readout = document.getElementById("readout");
  const statusEl = document.getElementById("status");
  const rEl = document.getElementById("r"), rOut = document.getElementById("rOut");
  const nEl = document.getElementById("n"), nOut = document.getElementById("nOut");

  let state = Core.start();
  let cols = [], avgFill = null, avgLabel = null, line = null, drag = -1;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function build() {
    plot.textContent = ""; labels.textContent = ""; cols = [];
    const avg = document.createElement("div");
    avg.className = "col avg"; avg.setAttribute("role", "img");
    avgFill = document.createElement("div"); avgFill.className = "fill"; avg.appendChild(avgFill);
    plot.appendChild(avg);
    avgLabel = document.createElement("span"); labels.appendChild(avgLabel);
    state.values.forEach((_, i) => {
      const c = document.createElement("div");
      c.className = "col"; c.tabIndex = 0; c.setAttribute("role", "slider");
      c.setAttribute("aria-valuemin", Core.MIN_VALUE); c.setAttribute("aria-valuemax", Core.MAX_VALUE);
      c.setAttribute("aria-label", `Number ${i + 1}`);
      const f = document.createElement("div"); f.className = "fill"; c.appendChild(f);
      c._fill = f;
      c.addEventListener("pointerdown", (e) => { drag = i; c.setPointerCapture(e.pointerId); set(i, fromY(e, c)); e.preventDefault(); });
      c.addEventListener("pointermove", (e) => { if (drag === i) set(i, fromY(e, c)); });
      c.addEventListener("pointerup", () => { drag = -1; });
      c.addEventListener("pointercancel", () => { drag = -1; });
      c.addEventListener("keydown", (e) => {
        const step = e.shiftKey ? 10 : 1;
        const v = { ArrowUp: state.values[i] + step, ArrowRight: state.values[i] + step, ArrowDown: state.values[i] - step, ArrowLeft: state.values[i] - step, Home: Core.MIN_VALUE, End: Core.MAX_VALUE }[e.key];
        if (v === undefined) return;
        e.preventDefault(); set(i, v);
      });
      plot.appendChild(c); cols.push(c);
      const l = document.createElement("span"); labels.appendChild(l);
    });
    line = document.createElement("div"); line.id = "meanline"; plot.appendChild(line);
  }

  function fromY(e, el) {
    const r = el.getBoundingClientRect();
    return Core.MIN_VALUE + ((r.bottom - e.clientY) / r.height) * (Core.MAX_VALUE - Core.MIN_VALUE);
  }

  function set(i, v) { const next = Core.setValue(state, i, v); if (next) { state = next; update(); } }

  const pct = (v) => (100 * v) / Core.MAX_VALUE + "%";

  function update() {
    const m = Core.mean(state.values, state.r);
    nOut.textContent = state.values.length; rOut.textContent = state.r;
    cols.forEach((c, i) => { c._fill.style.height = pct(state.values[i]); c.setAttribute("aria-valuenow", state.values[i]); labels.children[i + 1].textContent = state.values[i]; });
    avgFill.style.height = pct(m); line.style.bottom = `calc(${pct(m)} + 0.2rem)`;
    avgLabel.textContent = Math.round(m * 10) / 10;
    const name = Core.nameOf(state.r);
    readout.textContent = `The mean is approximately ${Core.formatMean(m)}` + (name ? ` (the ${name}, exponent ${state.r})` : ` (exponent ${state.r})`);
    say("The green bar and the dashed line mark the mean: " + Core.formatMean(m) + ".", "done");
    if (window.Track) window.Track.state({ values: state.values, r: state.r, mean: m });
  }

  rEl.addEventListener("input", () => { const s = Core.setExponent(state, rEl.value); if (s) { state = s; update(); } });
  nEl.addEventListener("input", () => { state = Core.resize(state, nEl.value); build(); update(); });
  document.getElementById("newBtn").addEventListener("click", () => { state = { ...Core.start({ n: state.values.length }), r: state.r }; update(); });
  build(); update();
})();
