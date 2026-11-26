"use strict";

/*
 * The page for Fast Power Indices: drawing and input only; the counting is in
 * power-indices-core.js. A data set from the applet's page (or Custom), a
 * quota, and a table with one row per player: the weight (a box to change),
 * and the Banzhaf and Shapley-Shubik shares, recomputed on every change.
 */

(function () {
  const Core = PowerIndicesCore;
  const setSel = document.getElementById("setSel");
  const quotaIn = document.getElementById("quotaIn");
  const summaryEl = document.getElementById("summary");
  const tbody = document.querySelector("#table tbody");
  const noteEl = document.getElementById("note");
  let state = Core.start({});

  for (const name of [...Core.DATA.map((d) => d.name), "Custom"]) {
    const o = document.createElement("option"); o.value = name; o.textContent = name; setSel.append(o);
  }

  const pct = (x) => `${(100 * x).toFixed(2)}%`;
  const big = (n) => (n < 1e6 ? String(n) : n.toExponential(3).replace("e+", " × 10^"));

  function row(p, i, r, total) {
    const tr = document.createElement("tr");
    const name = document.createElement("th"); name.scope = "row";
    const label = document.createElement("span"); label.textContent = p[0];
    name.append(label);
    const wTd = document.createElement("td");
    const w = document.createElement("input");
    w.type = "number"; w.min = "0"; w.max = String(Core.MAX_WEIGHT); w.step = "1"; w.value = String(p[1]);
    w.setAttribute("aria-label", `Weight of ${p[0]}`);
    w.addEventListener("change", () => { const v = Number(w.value); if (Number.isFinite(v)) { state = Core.move(state, { type: "weight", index: i, value: v }); render(`Weight of ${p[0]}`); } });
    const share = document.createElement("span"); share.className = "sub"; share.textContent = total ? `${pct(p[1] / total)} of votes` : "";
    wTd.append(w, share);
    const bTd = document.createElement("td"), sTd = document.createElement("td");
    if (r) {
      bTd.append(Object.assign(document.createElement("span"), { textContent: pct(r.banzhafShare[i]) }), Object.assign(document.createElement("span"), { className: "sub", textContent: `${big(r.banzhaf[i])} swings` }));
      sTd.textContent = pct(r.shapley[i]);
      if (r.banzhaf[i] === 0) tr.classList.add("dummy");
    } else { bTd.textContent = "–"; sTd.textContent = "–"; }
    const x = document.createElement("button");
    x.type = "button"; x.className = "remove"; x.textContent = "×"; x.setAttribute("aria-label", `Remove ${p[0]}`);
    x.disabled = state.players.length <= 1;
    x.addEventListener("click", () => { state = Core.move(state, { type: "remove", index: i }) || state; render(); });
    name.append(x);
    tr.append(name, wTd, bTd, sTd);
    return tr;
  }

  function render(refocus) {
    setSel.value = state.set;
    quotaIn.value = String(state.quota);
    const total = Core.total(state);
    const r = Core.compute(state);
    summaryEl.textContent = `${state.players.length} players with ${total} votes in all; the quota is ${state.quota} (${total ? pct(state.quota / total) : "–"}).`;
    tbody.replaceChildren(...state.players.map((p, i) => row(p, i, r, total)));
    if (!r) noteEl.textContent = `No coalition can reach the quota ${state.quota}: all the votes together make only ${total}.`;
    else {
      const dummies = state.players.filter((_, i) => r.banzhaf[i] === 0).map((p) => p[0]);
      noteEl.textContent = dummies.length ? `No power at all (a dummy): ${dummies.join(", ")}.` : `Banzhaf: ${big(Number(r.banzhafTotal))} swings in all.`;
    }
    if (refocus) { const el = tbody.querySelector(`[aria-label="${refocus}"]`); if (el) el.focus(); }
    if (window.Track) window.Track.state(state);
  }

  setSel.addEventListener("change", () => { state = Core.move(state, { type: "set", name: setSel.value }) || state; render(); });
  quotaIn.addEventListener("change", () => { const v = Number(quotaIn.value); if (Number.isFinite(v)) state = Core.move(state, { type: "quota", value: v }); render(); });
  document.getElementById("addBtn").addEventListener("click", () => { state = Core.move(state, { type: "add" }) || state; render(); });
  render();
})();
