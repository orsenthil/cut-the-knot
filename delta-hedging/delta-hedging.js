"use strict";

/*
 * The page for Delta Hedging: drawing and input only; the books are in
 * delta-hedging-core.js. The SVG draws the stock's path so far, with the
 * shares held each day as bars below. The panel shows the option you owe
 * (its value today), your shares, your cash, and the gap between your
 * portfolio and the option: a perfect hedge keeps the gap near zero.
 */

(function () {
  const Core = DeltaHedgingCore;
  const svg = document.getElementById("chart");
  const panel = document.getElementById("panel");
  const statusEl = document.getElementById("status");
  const sharesIn = document.getElementById("sharesIn");
  const hintBox = document.getElementById("hintBox");
  const nextBtn = document.getElementById("nextBtn");
  const NS = "http://www.w3.org/2000/svg";

  let state = Core.start({ seed: 1 + Math.floor(Math.random() * 100000) });
  const money = (v) => `${v < -0.005 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;
  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const p = Core.path(state.seed), k = state.holdings.length, done = k === Core.DAYS;
    const W = 400, H = 220, L = 40, top = 150;
    const lo = Math.min(85, ...p.slice(0, k + 1)) - 2, hi = Math.max(115, ...p.slice(0, k + 1)) + 2;
    const X = (i) => L + (i / Core.DAYS) * (W - L - 10), Y = (v) => 10 + ((hi - v) / (hi - lo)) * (top - 20);
    svg.textContent = "";
    svg.appendChild(el("line", { x1: L, y1: Y(Core.K), x2: W - 10, y2: Y(Core.K) }, "strike"));
    svg.appendChild(el("text", { x: L - 4, y: Y(Core.K) + 4 }, "axis", "$100"));
    svg.appendChild(el("polyline", { points: p.slice(0, k + 1).map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ") }, "price"));
    svg.appendChild(el("circle", { cx: X(k), cy: Y(p[k]), r: 4.5 }, "now"));
    const barY = (v) => H - 12 - Math.max(0, Math.min(1.2, v)) * 45;
    svg.appendChild(el("line", { x1: L, y1: H - 12, x2: W - 10, y2: H - 12 }, "grid"));
    svg.appendChild(el("text", { x: L - 4, y: H - 12 - 45 + 4 }, "axis", "1 share"));
    const comp = Core.deltaHoldings(p);
    state.holdings.forEach((h, i) => {
      const w = (W - L - 10) / Core.DAYS - 2;
      svg.appendChild(el("rect", { x: X(i) + 1, y: barY(h), width: w, height: H - 12 - barY(h) }, "bar"));
      if (done) svg.appendChild(el("line", { x1: X(i) + 1, y1: barY(comp[i]), x2: X(i) + 1 + w, y2: barY(comp[i]) }, "comp"));
    });

    const b = Core.books(p, state.holdings);
    const tau = Core.T - (k * Core.T) / Core.DAYS;
    const last = b.rows[k - 1];
    const cash = last ? last.cash : Core.call(p[0], Core.T), held = last ? last.shares : 0;
    const owe = Core.call(p[k], tau), port = cash + held * p[k];
    panel.innerHTML = `<tr><th>Day</th><td>${k} of ${Core.DAYS}</td></tr>` +
      `<tr><th>Stock</th><td>${money(p[k])}</td></tr>` +
      `<tr><th>The call you sold is worth</th><td>${money(owe)}</td></tr>` +
      `<tr><th>Your shares</th><td>${held.toFixed(2)}</td></tr><tr><th>Your cash</th><td>${money(cash)}</td></tr>` +
      `<tr><th>Shares + cash − call</th><td><b>${money(port - owe)}</b></td></tr>` +
      (hintBox.checked && !done ? `<tr><th>Delta today</th><td>${Core.delta(p[k], tau).toFixed(2)}</td></tr>` : "");
    sharesIn.value = state.shares.toFixed(2);
    nextBtn.disabled = done;
    nextBtn.textContent = k === Core.DAYS - 1 ? "Last day" : "Next day";
    const sc = Core.scores(state);
    if (sc) {
      const words = `You ended with ${money(sc.you)}. The computer, holding exactly delta every day, ended with ${money(sc.computer)}; with no hedge at all it would be ${money(sc.none)}.`;
      const unhedged = state.holdings.every((h) => Math.abs(h) < 0.05);
      const verdict = Core.result(state) === "win"
        ? (unhedged ? " Close to even, but only by luck: the stock did not rise much. Without shares, a big rise would have cost you dearly." : " Well hedged!")
        : " Your hedge drifted too far.";
      say(words + verdict, Core.result(state));
    } else say(k === 0 ? `You sold a one-month call for ${money(Core.call(p[0], Core.T))}. Buy some shares to protect yourself, then press Next day.` : "Adjust your shares for the new price, then press Next day.");
    if (window.Track) window.Track.state({ seed: state.seed, holdings: state.holdings, shares: state.shares });
  }

  sharesIn.addEventListener("change", () => { state = Core.setShares(state, sharesIn.value) || state; render(); });
  document.querySelectorAll("[data-step]").forEach((bt) => bt.addEventListener("click", () => { state = Core.setShares(state, state.shares + Number(bt.dataset.step)) || state; render(); }));
  nextBtn.addEventListener("click", () => { state = Core.setShares(state, sharesIn.value) || state; state = Core.nextDay(state) || state; render(); });
  document.getElementById("newBtn").addEventListener("click", () => { state = Core.newGame(state); render(); });
  hintBox.addEventListener("change", render);

  render();
})();
