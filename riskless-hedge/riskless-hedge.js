"use strict";

/*
 * The page for The Riskless Hedge: drawing and input only; the sums are in
 * riskless-hedge-core.js. A two-branch tree shows today's stock and its two
 * possible prices tomorrow with the option's payoff. A slider sets how many
 * shares to hold per option sold; the table shows the portfolio in both
 * states. Once it is the same in both, type the option's price.
 */

(function () {
  const Core = RisklessHedgeCore;
  const statusEl = document.getElementById("status");
  const treeEl = document.getElementById("tree");
  const tableEl = document.getElementById("table");
  const puzzleIn = document.getElementById("puzzleIn");
  const deltaIn = document.getElementById("deltaIn");
  const deltaOut = document.getElementById("deltaOut");
  const chanceIn = document.getElementById("chanceIn");
  const chanceOut = document.getElementById("chanceOut");
  const guessIn = document.getElementById("guessIn");
  const NS = "http://www.w3.org/2000/svg";

  for (const P of Core.PUZZLES) { const o = document.createElement("option"); o.value = P.id; o.textContent = P.name; puzzleIn.appendChild(o); }
  let state = Core.start();
  const money = (v) => `${v < -1e-9 ? "−" : ""}$${Math.abs(v).toFixed(2)}`;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const el = (name, attrs, cls, text) => {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  };

  function render() {
    const P = Core.puzzle(state.puzzle), t = Core.tomorrow(P, state.delta);
    treeEl.textContent = "";
    const box = (x, y, top, bottom) => {
      treeEl.appendChild(el("rect", { x: x - 70, y: y - 30, width: 140, height: 60, rx: 10 }, "node"));
      treeEl.appendChild(el("text", { x, y: y - 6 }, "big", top));
      treeEl.appendChild(el("text", { x, y: y + 17 }, "small", bottom));
    };
    treeEl.appendChild(el("line", { x1: 120, y1: 110, x2: 290, y2: 50 }, "branch"));
    treeEl.appendChild(el("line", { x1: 120, y1: 110, x2: 290, y2: 170 }, "branch"));
    box(85, 110, `stock $${P.S}`, `${P.type} at $${P.K}: ?`);
    box(330, 50, `stock $${P.up}`, `${P.type} pays $${Core.payoff(P, P.up)}`);
    box(330, 170, `stock $${P.down}`, `${P.type} pays $${Core.payoff(P, P.down)}`);
    treeEl.appendChild(el("text", { x: 200, y: 215 }, "small", P.r ? `the bank pays ${(P.r * 100).toFixed(0)}% for the step` : "no interest"));

    const row = (name, s) => `<tr><th>${name}</th><td>${money(state.delta * s)}</td><td>${money(-Core.payoff(P, s))}</td><td><b>${money(state.delta * s - Core.payoff(P, s))}</b></td></tr>`;
    tableEl.innerHTML = `<tr><th></th><th>shares worth</th><th>option owed</th><th>you hold</th></tr>${row("if it goes up", P.up)}${row("if it goes down", P.down)}`;
    deltaIn.value = String(state.delta);
    deltaOut.textContent = `${state.delta.toFixed(2)} share${Math.abs(state.delta) === 1 ? "" : "s"}${state.delta < 0 ? " (sold short)" : ""}`;
    chanceIn.value = String(state.p);
    const price = Core.price(P);
    chanceOut.textContent = `If the stock goes up with chance ${Math.round(state.p * 100)}%, the option pays ${money(Core.expected(P, state.p))} on average (in today's money). Does the price depend on this?`;

    if (Core.result(state) === "win") say(`Riskless, and priced: ${money(price)}. Charge more and you profit for sure; charge less and the buyer does. The chance of going up never mattered.`, "win");
    else if (Core.riskless(state)) say(state.guess === null ? `Riskless: you hold ${money(t.up)} either way. So what must the option cost today?` : `Riskless, but ${money(state.guess)} is not the price. Shares cost ${money(state.delta * P.S)} today; the ${money(t.up)} you will surely hold is worth ${money(t.up / (1 + P.r))} today.`);
    else say(`Not riskless yet: ${money(t.up)} if up, ${money(t.down)} if down. Change the number of shares until both are the same.`);
    if (window.Track) window.Track.state({ puzzle: state.puzzle, delta: state.delta, p: state.p, guess: state.guess });
  }

  deltaIn.addEventListener("input", () => { state = Core.setDelta(state, deltaIn.value) || state; render(); });
  document.getElementById("lessBtn").addEventListener("click", () => { state = Core.setDelta(state, state.delta - 0.05) || state; render(); });
  document.getElementById("moreBtn").addEventListener("click", () => { state = Core.setDelta(state, state.delta + 0.05) || state; render(); });
  chanceIn.addEventListener("input", () => { state = Core.setChance(state, chanceIn.value) || state; render(); });
  document.getElementById("guessBtn").addEventListener("click", () => { if (guessIn.value.trim() !== "") { state = Core.setGuess(state, guessIn.value) || state; render(); } });
  guessIn.addEventListener("keydown", (e) => { if (e.key === "Enter") document.getElementById("guessBtn").click(); });
  puzzleIn.addEventListener("change", () => { state = Core.start({ puzzle: puzzleIn.value }); guessIn.value = ""; render(); });

  render();
})();
