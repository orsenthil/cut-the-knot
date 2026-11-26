"use strict";

/*
 * The page for Build an Arithmetic Circuit: drawing and input only; the
 * polynomials are in arithmetic-circuits-core.js. Pick two wires and an
 * operation and add a gate; the list shows what every wire computes, and
 * the SVG draws the circuit, inputs at the bottom, each gate one level
 * above the higher of its two inputs.
 */

(function () {
  const Core = ArithmeticCircuitsCore;
  const svg = document.getElementById("diagram");
  const listEl = document.getElementById("wires");
  const statusEl = document.getElementById("status");
  const targetEl = document.getElementById("target");
  const puzzleIn = document.getElementById("puzzleIn");
  const aIn = document.getElementById("aIn"), bIn = document.getElementById("bIn"), opIn = document.getElementById("opIn");
  const NS = "http://www.w3.org/2000/svg";
  const OPS = { "+": "+", "-": "−", "*": "×" };

  for (const P of Core.PUZZLES) { const o = document.createElement("option"); o.value = P.id; o.textContent = P.name; puzzleIn.appendChild(o); }
  let state = Core.start();

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

  function names() {
    const P = Core.puzzle(state.puzzle);
    return ["1", ...P.vars, ...state.gates.map((_, i) => `g${i + 1}`)];
  }

  function draw(w, hit) {
    const P = Core.puzzle(state.puzzle), k0 = 1 + P.vars.length, nm = names();
    const depth = w.map((_, i) => 0);
    state.gates.forEach(([, a, b], g) => { depth[k0 + g] = 1 + Math.max(depth[a], depth[b]); });
    const maxD = Math.max(0, ...depth), rows = Array.from({ length: maxD + 1 }, () => []);
    depth.forEach((d, i) => rows[d].push(i));
    const W = 400, H = 70 + maxD * 70, pos = [];
    rows.forEach((r, d) => r.forEach((i, k) => { pos[i] = [((k + 1) * W) / (r.length + 1), H - 30 - d * 70]; }));
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.textContent = "";
    state.gates.forEach(([, a, b], g) => {
      const i = k0 + g;
      for (const j of [a, b]) svg.appendChild(el("line", { x1: pos[j][0], y1: pos[j][1], x2: pos[i][0], y2: pos[i][1] }, "wire"));
    });
    w.forEach((_, i) => {
      const gate = i >= k0, [x, y] = pos[i];
      const g = el("g", { transform: `translate(${x.toFixed(1)},${y.toFixed(1)})` }, `node${gate ? " gate" : " input"}${i === hit ? " hit" : ""}`);
      g.appendChild(el(gate ? "circle" : "rect", gate ? { r: 17 } : { x: -17, y: -14, width: 34, height: 28, rx: 6 }));
      g.appendChild(el("text", { y: 6 }, "", gate ? OPS[state.gates[i - k0][0]] : nm[i]));
      if (gate) g.appendChild(el("text", { x: 22, y: -12 }, "tag", nm[i]));
      svg.appendChild(g);
    });
  }

  function render() {
    const P = Core.puzzle(state.puzzle), w = Core.wires(P.vars, state.gates), nm = names(), k0 = 1 + P.vars.length;
    puzzleIn.value = state.puzzle;
    targetEl.textContent = `Target: ${Core.format(Core.target(state.puzzle), P.vars)}`;
    for (const sel of [aIn, bIn]) {
      const keep = sel.value;
      sel.textContent = "";
      nm.forEach((n, i) => { const o = document.createElement("option"); o.value = String(i); o.textContent = i < k0 ? n : `${n} = ${Core.format(w[i], P.vars)}`.slice(0, 28); sel.appendChild(o); });
      sel.value = keep && Number(keep) < nm.length ? keep : String(Math.min(1, nm.length - 1));
    }
    const r = Core.reached(state), hit = r >= 0 ? k0 + r : -1;
    listEl.innerHTML = state.gates.map(([op, a, b], g) => `<li class="${k0 + g === hit ? "hit" : ""}"><b>g${g + 1}</b> = ${nm[a]} ${OPS[op]} ${nm[b]} = ${Core.format(w[k0 + g], P.vars)} <span class="deg">(degree ${Core.degree(w[k0 + g])})</span></li>`).join("");
    draw(w, hit);
    const par = Core.par(state.puzzle);
    if (Core.result(state) === "win") say(`g${r + 1} is the target, with ${state.gates.length} gate${state.gates.length === 1 ? "" : "s"}: that is par, the fewest possible.`, "win");
    else if (r >= 0) say(`g${r + 1} is the target, using ${state.gates.length} gates. Par is ${par}: can you do it with fewer?`);
    else say(`${state.gates.length} gate${state.gates.length === 1 ? "" : "s"} so far. Par for this target is ${par}.`);
    document.getElementById("undoBtn").disabled = !state.gates.length;
    if (window.Track) window.Track.state({ puzzle: state.puzzle, gates: state.gates });
  }

  document.getElementById("addBtn").addEventListener("click", () => {
    const s = Core.addGate(state, opIn.value, Number(aIn.value), Number(bIn.value));
    if (s) { state = s; render(); } else say(`At most ${Core.MAX_GATES} gates: undo some, or reset.`);
  });
  document.getElementById("undoBtn").addEventListener("click", () => { state = Core.undo(state) || state; render(); });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start({ puzzle: state.puzzle }); render(); });
  puzzleIn.addEventListener("change", () => { state = Core.start({ puzzle: puzzleIn.value }); render(); });

  render();
})();
