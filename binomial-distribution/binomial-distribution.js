"use strict";

/*
 * Binomial Distribution page: draw the bars and take input; all the maths is
 * in binomial-distribution-core.js. The play area is one canvas of bars,
 * b(k) for k = 0 .. n, with the selected bar picked out in the accent colour.
 * Two sliders set the applet's p and n scrolls; Reset restores the defaults,
 * "Most likely k" jumps to the peak, and the arrow keys walk the bars. The
 * canvas keeps focus while the bars move, so the keyboard works on phones
 * with a keyboard attached too.
 */

(function () {
  const Core = BinomialDistributionCore;
  const canvas = document.getElementById("chart");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const pSlider = document.getElementById("pSlider");
  const nSlider = document.getElementById("nSlider");
  const pValueEl = document.getElementById("pValue");
  const nValueEl = document.getElementById("nValue");
  const readoutEl = document.getElementById("readout");
  const newBtn = document.getElementById("newBtn");
  const modeBtn = document.getElementById("modeBtn");

  let state = Core.start({});

  /** Resolve a CSS custom property on the canvas element at draw time. */
  function token(name) {
    const probe = document.createElement("div");
    probe.style.color = name;
    canvas.appendChild(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  }

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Draw the distribution into the canvas, in device pixels. */
  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const w = Math.max(1, Math.floor(rect.width * dpr));
    const h = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }

    const stage = token("var(--stage)");
    const ink = token("var(--ink)");
    const muted = token("var(--muted)");
    const accent = token("var(--accent)");
    const bad = token("var(--bad)");
    const border = token("var(--border-strong)");

    ctx.fillStyle = stage;
    ctx.fillRect(0, 0, w, h);

    const padL = 42 * dpr;
    const padR = 14 * dpr;
    const padT = 22 * dpr;
    const padB = 40 * dpr;
    const left = padL;
    const right = Math.max(left + 1, w - padR);
    const top = padT;
    const bottom = Math.max(top + 1, h - padB);

    ctx.strokeStyle = border;
    ctx.lineWidth = dpr;
    ctx.beginPath();
    ctx.moveTo(left, bottom + 0.5);
    ctx.lineTo(right, bottom + 0.5);
    ctx.stroke();

    const d = Core.distribution(state.p, state.n);
    let maxV = 0;
    let minV = 0;
    for (const v of d) {
      if (v > maxV) maxV = v;
      if (v < minV) minV = v;
    }
    const span = (maxV - minV) || 1;
    const yOf = (v) => bottom - ((v - minV) / span) * (bottom - top);
    const base = yOf(0);
    const barW = (right - left) / state.n;
    const gap = Math.min(2 * dpr, barW * 0.15);

    for (let k = 0; k <= state.n; k++) {
      const x = left + k * barW + gap / 2;
      const bw = Math.max(1, barW - gap);
      const y = yOf(d[k]);
      ctx.fillStyle = k === state.k ? accent : (d[k] < 0 ? bad : muted);
      ctx.globalAlpha = k === state.k ? 1 : 0.72;
      ctx.fillRect(x, Math.min(y, base), bw, Math.max(1, Math.abs(y - base)));
    }
    ctx.globalAlpha = 1;

    // Labels. Kept in device pixels so they scale with the canvas.
    ctx.fillStyle = muted;
    ctx.font = `${11 * dpr}px system-ui, sans-serif`;
    ctx.textAlign = "right";
    ctx.fillText(maxV.toFixed(3), left - 5 * dpr, top + 4 * dpr);
    ctx.fillText("0", left - 5 * dpr, base + 4 * dpr);
    ctx.textAlign = "left";
    ctx.fillText(`0 successes`, left, bottom + 16 * dpr);
    ctx.textAlign = "right";
    ctx.fillText(`${state.n} successes`, right, bottom + 16 * dpr);
    ctx.textAlign = "center";
    ctx.fillStyle = ink;
    ctx.fillText("number of successes  k →", (left + right) / 2, h - 4 * dpr);

    // The selected bar's value, written out in words on the status line too.
    const selX = left + (state.k + 0.5) * barW;
    ctx.textAlign = "center";
    ctx.font = `${12 * dpr}px system-ui, sans-serif`;
    ctx.fillStyle = accent;
    ctx.fillText(`b(${state.k}) = ${d[state.k].toFixed(4)}`, selX, Math.max(12 * dpr, yOf(d[state.k]) - 6 * dpr));
  }

  function syncLabels() {
    pValueEl.textContent = Core.formatP(state.p);
    nValueEl.textContent = String(state.n);
    pSlider.value = String(Core.SCROLL.p.fromValue(state.p));
    nSlider.value = String(Core.SCROLL.n.fromValue(state.n));
    const d = Core.distribution(state.p, state.n);
    readoutEl.textContent =
      `p = ${Core.formatP(state.p)}, n = ${state.n}, most likely k = ${Core.mode(state.p, state.n)}` +
      ` — chance of ${state.k} successes = ${pct(d[state.k])}`;
  }

  function render() {
    syncLabels();
    draw();
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function onPSlider() {
    const before = state.p;
    state = Core.setP(state, Core.SCROLL.p.toValue(+pSlider.value));
    if (state.p === before) return;
    say(`Probability p is now ${Core.formatP(state.p)}. The most likely result is ${Core.mode(state.p, state.n)} successes.`, "done");
    render();
  }

  function onNSlider() {
    const before = state.n;
    state = Core.setN(state, Core.SCROLL.n.toValue(+nSlider.value));
    if (state.n === before) return;
    say(`Trials n is now ${state.n}. The most likely result is ${Core.mode(state.p, state.n)} successes.`, "done");
    render();
  }

  function pct(v) {
    const x = v * 100;
    return (Math.abs(x) < 0.05 ? 0 : x).toFixed(1) + "%";
  }

  function select(k, verb) {
    const before = state.k;
    state = Core.selectK(state, k);
    if (state.k === before) return;
    const chance = Core.pmf(state.p, state.n, state.k);
    say(`${verb} ${state.k} successes — the chance is ${pct(chance)}.`, "done");
    render();
  }

  function onPointer(event) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const px = (event.clientX - rect.left) * sx;
    const dpr = window.devicePixelRatio || 1;
    const padL = 42 * dpr;
    const padR = 14 * dpr;
    const plotW = Math.max(1, canvas.width - padL - padR);
    const barW = plotW / state.n;
    select(Math.round((px - padL) / barW - 0.5), "You selected");
  }

  newBtn.addEventListener("click", () => {
    state = Core.start({});
    say(`Reset to p = ${Core.formatP(state.p)} and n = ${state.n}. The most likely result is ${Core.mode(state.p, state.n)} successes.`, "done");
    render();
  });

  modeBtn.addEventListener("click", () => {
    const k = Core.mode(state.p, state.n);
    const before = state.k;
    state = Core.selectK(state, k);
    say(`Jumped to the most likely result, ${k} successes — the tallest bar.`, "done");
    if (state.k !== before) render();
  });

  pSlider.addEventListener("input", onPSlider);
  nSlider.addEventListener("input", onNSlider);
  canvas.addEventListener("pointerdown", onPointer);
  canvas.addEventListener("keydown", (event) => {
    let delta = 0;
    if (event.key === "ArrowLeft" || event.key === "ArrowDown") delta = -1;
    else if (event.key === "ArrowRight" || event.key === "ArrowUp") delta = 1;
    else if (event.key === "Home") delta = -state.n;
    else if (event.key === "End") delta = state.n;
    else return;
    event.preventDefault();
    select(state.k + delta, "You moved to");
  });

  window.addEventListener("themechange", render);
  window.addEventListener("resize", render);

  syncLabels();
  say("Move the p or n slider, or use the arrow keys on the chart, to explore the distribution.");
  render();
})();
