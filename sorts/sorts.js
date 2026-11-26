"use strict";

/*
 * The page for Sorting Algorithms: drawing and input only; the algorithms
 * are in sorts-core.js. A canvas shows the array as sticks or circles, with
 * the two places being compared marked. Run steps every 20 ms as the applet
 * did; One step makes a single comparison. Changing the method, the kind of
 * array or its size starts afresh; Same array reuses the last starting array
 * so the methods can be compared on equal terms.
 */

(function () {
  const Core = SortsCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const countsEl = document.getElementById("counts");
  const methodSel = document.getElementById("methodSel");
  const orderSel = document.getElementById("orderSel");
  const sizeIn = document.getElementById("sizeIn");
  const sameBox = document.getElementById("sameBox");
  const runBtn = document.getElementById("runBtn");
  const stepBtn = document.getElementById("stepBtn");

  Core.METHODS.forEach((m, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = m; methodSel.appendChild(o); });
  Core.ORDERS.forEach((m, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = m; orderSel.appendChild(o); });

  let state = Core.start();
  let timer = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const sticks = () => document.querySelector('input[name="look"]:checked').value === "sticks";

  function draw() {
    const W = canvas.width, H = canvas.height, M = 20;
    ctx.fillStyle = css("--surface");
    ctx.fillRect(0, 0, W, H);
    const a = state.array, n = a.length, dx = (W - 2 * M) / n;
    const g = state.alg, mark = new Set();
    if (g && !g.finished) {
      if (state.method === 4) { mark.add(g.firstPass ? g.I : 0); if (!g.firstPass) mark.add(g.I); }
      else if (state.method === 3) { mark.add(g.J); mark.add(g.J - g.H); }
      else if (state.method === 0) { mark.add(g.J); mark.add(g.J - 1); }
      else if (state.method === 1) { mark.add(g.I); mark.add(g.J); }
      else { mark.add(g.J); mark.add(g.J + 1); }
    }
    for (let i = 0; i < n; i++) {
      const x = M + (i + 0.5) * dx, y = H - M - a[i] * (H - 2 * M);
      const col = mark.has(i) ? css("--bad") : css("--accent");
      if (sticks()) {
        ctx.strokeStyle = col; ctx.lineWidth = Math.max(1.5, Math.min(10, dx * 0.55));
        ctx.beginPath(); ctx.moveTo(x, H - M); ctx.lineTo(x, Math.min(y, H - M - 1)); ctx.stroke();
      } else {
        ctx.fillStyle = col;
        ctx.beginPath(); ctx.arc(x, y, Math.max(2.5, Math.min(8, dx * 0.35)), 0, 2 * Math.PI); ctx.fill();
      }
    }
    ctx.strokeStyle = css("--border-strong"); ctx.lineWidth = 1;
    ctx.strokeRect(M - 4, M - 4, W - 2 * M + 8, H - 2 * M + 8);
  }

  function render() {
    draw();
    const g = state.alg;
    countsEl.textContent = g ? `${Core.METHODS[state.method]}: ${g.steps} steps, ${g.swaps} swaps` : `${state.n} numbers, ${Core.ORDERS[state.order].toLowerCase()}`;
    if (g && g.finished) say(`Sorted: ${Core.METHODS[state.method]} took ${g.steps} steps and ${g.swaps} swaps.`, "done");
    else if (!g) say("Press Run or One step to start sorting.");
    else say(timer ? "Sorting…" : "Paused. Press Run or One step.");
    orderSel.disabled = sameBox.checked;
    if (window.Track) window.Track.state({ method: state.method, order: state.order, n: state.n, same: state.same, steps: g ? g.steps : 0, swaps: g ? g.swaps : 0, finished: !!(g && g.finished) });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    runBtn.textContent = "Run";
    stepBtn.disabled = false;
    [methodSel, sizeIn, sameBox].forEach((e) => (e.disabled = false));
  }
  function freshIfDone() { if (state.alg && state.alg.finished) state = { ...state, alg: null }; }

  runBtn.addEventListener("click", () => {
    if (timer) { stop(); render(); return; }
    freshIfDone();
    runBtn.textContent = "Stop";
    stepBtn.disabled = true;
    [methodSel, sizeIn, sameBox].forEach((e) => (e.disabled = true));
    orderSel.disabled = true;
    timer = setInterval(() => {
      state = Core.step(state);
      if (state.alg.finished) stop();
      render();
    }, Core.INTERVAL_MS);
    render();
  });
  stepBtn.addEventListener("click", () => { freshIfDone(); state = Core.step(state); render(); });

  methodSel.addEventListener("change", () => { state = Core.set(state, { method: Number(methodSel.value) }); render(); });
  orderSel.addEventListener("change", () => { state = Core.set(state, { order: Number(orderSel.value) }); render(); });
  sizeIn.addEventListener("change", () => {
    state = Core.set({ ...state, same: false }, { n: sizeIn.value });
    state.same = sameBox.checked = false; // as in the applet, a new size unticks Same array
    sizeIn.value = String(state.n);
    render();
  });
  sameBox.addEventListener("change", () => { state = { ...state, same: sameBox.checked }; render(); });
  document.querySelectorAll('input[name="look"]').forEach((r) => r.addEventListener("change", draw));
  window.addEventListener("themechange", draw);
  document.addEventListener("visibilitychange", () => { if (document.hidden && timer) { stop(); render(); } });

  render();
})();
