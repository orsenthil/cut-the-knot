"use strict";

/*
 * The page for Recombining Permutations: drawing and input only. The numbers
 * stand round a circle; arrows join i to f(i); pressing two numbers swaps them
 * (the core does the maths and says whether a cycle split or two joined).
 */

(function () {
  const Core = PermCircleCore;
  const layer = document.getElementById("layer");
  const facts = document.getElementById("facts");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), newBtn = document.getElementById("newBtn");
  const NS = "http://www.w3.org/2000/svg";
  const C = 200, R = 150;

  let state = Core.start({ n: Core.DEFAULT_N });
  let note = "";

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, parent) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    (parent || layer).appendChild(e);
    return e;
  }

  function render() {
    layer.textContent = "";
    const n = state.n, r = Math.max(10, Math.min(18, 140 / n + 4));
    const at = (k) => {
      const a = (2 * Math.PI * (k - 1)) / n - Math.PI / 2;
      return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
    };
    // arrows end at the rim of the target circle
    Core.arrows(state.f).forEach(([i, j]) => {
      const p = at(i), q = at(j), dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
      const sx = p.x + (dx / len) * r, sy = p.y + (dy / len) * r, ex = q.x - (dx / len) * (r + 4), ey = q.y - (dy / len) * (r + 4);
      el("line", { x1: sx.toFixed(1), y1: sy.toFixed(1), x2: ex.toFixed(1), y2: ey.toFixed(1), class: "arrow" });
    });
    for (let k = 1; k <= n; k++) {
      const p = at(k), g = el("g", {});
      const c = el("circle", { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r, class: "node" + (state.first === k ? " sel" : ""), tabindex: "0", role: "button", "aria-pressed": state.first === k ? "true" : "false", "aria-label": `Number ${k}, sent to ${state.f[k - 1]}` }, g);
      el("text", { x: p.x.toFixed(1), y: p.y.toFixed(1) }, g).textContent = String(k);
      const choose = () => {
        const before = state;
        state = Core.press(state, k);
        if (state.last && state !== before && state.moves !== before.moves) {
          const cs = Core.cycles(state.f).length;
          note = state.last.effect === "split"
            ? `Swapped ${state.last.a} and ${state.last.b}: they were in one loop, which split into two. Now ${cs} loops.`
            : `Swapped ${state.last.a} and ${state.last.b}: they were in different loops, which joined into one. Now ${cs} loops.`;
        } else note = "";
        render();
      };
      c.addEventListener("click", choose);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
    }
    const cs = Core.cycles(state.f);
    facts.textContent = `Loops: ${Core.cycleText(state.f)}  (${cs.length} of them, so the permutation is ${Core.isEven(state.f) ? "even" : "odd"}). Swaps so far: ${state.moves}.`;
    say(note || (state.first ? `Now press the number to swap with ${state.first}.` : "Press a number."));
    nIn.value = String(n);
    if (window.Track) window.Track.state({ n, f: state.f, moves: state.moves });
  }

  function fresh() { note = ""; state = Core.start({ n: nIn.value }); render(); }
  newBtn.addEventListener("click", fresh);
  nIn.addEventListener("change", fresh);
  render();
})();
