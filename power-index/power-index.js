"use strict";

/*
 * The page for Weighted Voting and Power Indices: drawing and input only; the
 * counting is in power-index-core.js. As in the applet, the system is written
 * [q: w1, w2, ...] with every number a box you can change. With "Compute
 * indices" ticked, a table gives each player's Banzhaf and Shapley-Shubik
 * index as a fraction (the applet's way) and a percentage.
 */

(function () {
  const Core = PowerIndexCore;
  const systemEl = document.getElementById("system");
  const summaryEl = document.getElementById("summary");
  const tableBody = document.querySelector("#table tbody");
  const table = document.getElementById("table");
  const noteEl = document.getElementById("note");
  const nIn = document.getElementById("nIn");
  const computeBox = document.getElementById("computeBox");
  let state = Core.start({});

  function box(value, min, max, label, onChange) {
    const input = document.createElement("input");
    input.type = "number"; input.min = String(min); input.max = String(max); input.step = "1";
    input.value = String(value); input.setAttribute("aria-label", label);
    input.addEventListener("change", () => { const v = Number(input.value); if (Number.isFinite(v)) onChange(v); else render(); });
    return input;
  }
  const text = (t) => { const s = document.createElement("span"); s.textContent = t; return s; };

  function buildSystem() {
    // Rebuilt only when the number of players changes, so a box keeps its focus.
    systemEl.replaceChildren(text("["), box(state.quota, Core.QUOTA_MIN, Core.QUOTA_MAX, "Quota", (v) => { state = Core.move(state, { type: "quota", value: v }); render(); }), text(":"));
    // Each box keeps its comma (or the closing bracket), so a line never starts with one.
    state.votes.forEach((w, i) => {
      const g = document.createElement("span"); g.className = "vote";
      g.append(box(w, 0, Core.VOTES_MAX, `Votes of player ${i + 1}`, (v) => { state = Core.move(state, { type: "votes", index: i, value: v }); render(); }), text(i < state.votes.length - 1 ? "," : "]"));
      systemEl.append(g);
    });
  }

  const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");

  function render() {
    if (systemEl.querySelectorAll("input").length !== state.votes.length + 1) buildSystem();
    const boxes = systemEl.querySelectorAll("input");
    [state.quota, ...state.votes].forEach((v, i) => { if (Number(boxes[i].value) !== v) boxes[i].value = String(v); });
    nIn.value = String(state.votes.length);
    computeBox.checked = state.compute;
    const total = Core.total(state);
    summaryEl.textContent = `${state.votes.length} voters with the total of ${total} votes; a coalition needs ${state.quota} to win.`;

    tableBody.replaceChildren();
    const r = state.compute ? Core.indices(state) : null;
    table.hidden = !state.compute || !r;
    if (!state.compute) noteEl.textContent = "Tick “Compute indices” to see each player's power.";
    else if (!r) noteEl.textContent = `No coalition can reach the quota ${state.quota}: all the votes together make only ${total}. With no winning coalition, nobody has any power to measure.`;
    else {
      state.votes.forEach((w, i) => {
        const tr = document.createElement("tr");
        const cells = [[`${i + 1}`], [`${w}`],
          [`${r.banzhaf.counts[i]}/${r.banzhaf.total}`, pct(r.banzhaf.counts[i], r.banzhaf.total)],
          [`${r.shapley.counts[i]}/${r.shapley.total}`, pct(r.shapley.counts[i], r.shapley.total)]];
        cells.forEach(([main, sub], k) => {
          const td = document.createElement(k === 0 ? "th" : "td");
          if (k === 0) td.scope = "row";
          const m = document.createElement("span"); m.className = "frac"; m.textContent = main; td.append(m);
          if (sub) { const p = document.createElement("span"); p.className = "pct"; p.textContent = sub; td.append(p); }
          tr.append(td);
        });
        if (r.dummies.includes(i)) tr.classList.add("dummy");
        tableBody.append(tr);
      });
      const names = (list) => list.map((i) => i + 1).join(", ");
      const notes = [];
      if (r.dictators.length) notes.push(`Player ${names(r.dictators)} can pass anything alone: a dictator.`);
      if (r.dummies.length) notes.push(`Player${r.dummies.length > 1 ? "s" : ""} ${names(r.dummies)} ${r.dummies.length > 1 ? "have" : "has"} votes but no power at all: ${r.dummies.length > 1 ? "dummies" : "a dummy"}.`);
      noteEl.textContent = notes.join(" ");
    }
    if (window.Track) window.Track.state(state);
  }

  nIn.addEventListener("change", () => {
    const v = Number(nIn.value);
    if (Number.isFinite(v)) state = Core.move(state, { type: "players", value: v });
    render();
  });
  computeBox.addEventListener("change", () => { state = Core.move(state, { type: "compute", value: computeBox.checked }); render(); });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start({ compute: state.compute }); state = { ...state, compute: computeBox.checked }; render(); });
  render();
})();
