"use strict";

/*
 * The page for Social Choice: drawing and input only; the counting is in
 * social-choice-core.js. The ballots table has one column per ballot: the
 * number of voters on top (with - and + buttons) and the choices in order of
 * preference, each with a button that moves it one place up. The results
 * table lists every choice with its score under each ticked method; the
 * top score is marked.
 */

(function () {
  const Core = SocialChoiceCore;
  const ballotsEl = document.getElementById("ballots");
  const resultsEl = document.getElementById("results");
  const statusEl = document.getElementById("status");
  const ncOut = document.getElementById("ncOut");
  const nsOut = document.getElementById("nsOut");
  const backBtn = document.getElementById("backBtn");

  let state = Core.start();
  let refocus = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const btn = (text, label, data) => {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = text; b.setAttribute("aria-label", label);
    Object.assign(b.dataset, data);
    return b;
  };

  function render() {
    const n = state.ballots[0].length;
    // ballots
    const t = document.createElement("table");
    const head = t.createTHead().insertRow();
    const th0 = document.createElement("th"); th0.textContent = "Voters"; th0.scope = "row"; head.appendChild(th0);
    state.counts.forEach((c, i) => {
      const th = document.createElement("th");
      const wrap = document.createElement("div"); wrap.className = "count";
      const v = document.createElement("span"); v.textContent = String(c);
      wrap.append(btn("−", `Ballot ${i + 1}: one voter fewer`, { count: i, d: -1 }), v, btn("+", `Ballot ${i + 1}: one voter more`, { count: i, d: 1 }));
      th.appendChild(wrap); head.appendChild(th);
    });
    const body = t.createTBody();
    for (let k = 0; k < n; k++) {
      const r = body.insertRow();
      const th = document.createElement("th"); th.scope = "row"; th.textContent = `${k + 1}${["st", "nd", "rd"][k] || "th"}`; r.appendChild(th);
      state.ballots.forEach((b, i) => {
        const td = r.insertCell();
        const cell = document.createElement("div"); cell.className = "choice";
        const l = document.createElement("span"); l.textContent = b[k]; l.className = "letter";
        cell.appendChild(l);
        if (k > 0) cell.appendChild(btn("↑", `Ballot ${i + 1}: move ${b[k]} above ${b[k - 1]}`, { ballot: i, index: k }));
        td.appendChild(cell);
      });
    }
    ballotsEl.replaceChildren(t);
    // results
    if (!state.methods.length) {
      const p = document.createElement("p"); p.className = "hint"; p.textContent = "Tick a method below to count the votes.";
      resultsEl.replaceChildren(p);
    } else {
      const rt = document.createElement("table");
      const h = rt.createTHead().insertRow();
      const c0 = document.createElement("th"); c0.textContent = "Choice"; h.appendChild(c0);
      for (const m of state.methods) { const th = document.createElement("th"); th.textContent = `${Core.METHODS[m]} (${m})`; h.appendChild(th); }
      const sc = state.methods.map((m) => Core.scores(state, m));
      const tops = sc.map((v) => Math.max(...v));
      const rb = rt.createTBody();
      for (let k = 0; k < n; k++) {
        const r = rb.insertRow();
        const th = document.createElement("th"); th.scope = "row"; th.textContent = Core.LETTERS[k]; r.appendChild(th);
        sc.forEach((v, j) => { const td = r.insertCell(); td.textContent = String(v[k]); if (v[k] === tops[j] && tops[j] > 0) { td.className = "top"; td.setAttribute("aria-label", `${v[k]}, the top score`); } });
      }
      resultsEl.replaceChildren(rt);
    }
    ncOut.textContent = String(n);
    nsOut.textContent = String(state.ballots.length);
    backBtn.disabled = state.stack.length === 0;
    if (state.methods.length) {
      const w = state.methods.map((m) => `${Core.METHODS[m]}: ${Core.winners(state, m).join(" and ")}`);
      say(`${Core.voters(state)} voters. Top score — ${w.join("; ")}.`);
    } else say(`${Core.voters(state)} voters. Tick the methods to compare.`);
    if (refocus) { const el = document.querySelector(refocus); if (el && !el.disabled) el.focus(); refocus = null; }
    if (window.Track) window.Track.state({ ballots: state.ballots, counts: state.counts, methods: state.methods });
  }

  ballotsEl.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.count !== undefined) {
      const i = Number(b.dataset.count);
      state = Core.setCount(state, i, state.counts[i] + Number(b.dataset.d));
      refocus = `[data-count="${i}"][data-d="${b.dataset.d}"]`;
    } else {
      const i = Number(b.dataset.ballot), k = Number(b.dataset.index);
      state = Core.swapUp(state, i, k);
      refocus = `[data-ballot="${i}"][data-index="${k}"]`;
    }
    render();
  });
  document.getElementById("ncLess").addEventListener("click", () => { state = Core.setChoices(state, state.ballots[0].length - 1); render(); });
  document.getElementById("ncMore").addEventListener("click", () => { state = Core.setChoices(state, state.ballots[0].length + 1); render(); });
  document.getElementById("nsLess").addEventListener("click", () => { state = Core.setBallots(state, state.ballots.length - 1); render(); });
  document.getElementById("nsMore").addEventListener("click", () => { state = Core.setBallots(state, state.ballots.length + 1); render(); });
  backBtn.addEventListener("click", () => { const s = Core.reverseSwap(state); if (s) { state = s; render(); } });
  document.querySelectorAll("input[data-method]").forEach((box) => box.addEventListener("change", () => {
    state = Core.setMethod(state, Number(box.dataset.method), box.checked); render();
  }));
  document.getElementById("resetBtn").addEventListener("click", () => { state = { ...Core.start(), methods: state.methods }; render(); });
  document.getElementById("exampleBtn").addEventListener("click", () => {
    state = { ...Core.start({ ballots: [["A", "B", "C", "D", "E"], ["C", "B", "D", "E", "A"], ["D", "C", "B", "E", "A"], ["B", "D", "C", "E", "A"], ["E", "C", "D", "B", "A"]], counts: [14, 10, 8, 4, 1] }), methods: state.methods };
    render();
  });

  render();
})();
