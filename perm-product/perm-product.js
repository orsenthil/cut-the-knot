"use strict";

/*
 * The page for Product of Permutations: drawing and input only. Three circles
 * of numbers: f, g and their product fg (f first). Pressing two numbers in f
 * or g swaps them; the product is redrawn. The maths is in perm-product-core.js.
 */

(function () {
  const Core = PermProductCore;
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), newBtn = document.getElementById("newBtn");
  const NS = "http://www.w3.org/2000/svg";
  const C = 150, R = 110;
  const panes = { f: ["svgF", "cycF"], g: ["svgG", "cycG"], p: ["svgP", "cycP"] };

  let state = Core.start({ n: Core.DEFAULT_N });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(parent, name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    parent.appendChild(e);
    return e;
  }

  function draw(which, perm, live) {
    const svg = document.getElementById(panes[which][0]);
    svg.textContent = "";
    const root = el(svg, "g", live ? { class: "live" } : {});
    const n = state.n, r = Math.max(9, Math.min(16, 100 / n + 5));
    const at = (k) => {
      const a = (2 * Math.PI * (k - 1)) / n - Math.PI / 2;
      return { x: C + R * Math.cos(a), y: C + R * Math.sin(a) };
    };
    Core.arrows(perm).forEach(([i, j]) => {
      const p = at(i), q = at(j), dx = q.x - p.x, dy = q.y - p.y, len = Math.hypot(dx, dy) || 1;
      el(root, "line", { x1: (p.x + (dx / len) * r).toFixed(1), y1: (p.y + (dy / len) * r).toFixed(1), x2: (q.x - (dx / len) * (r + 4)).toFixed(1), y2: (q.y - (dy / len) * (r + 4)).toFixed(1), class: "arrow" });
    });
    for (let k = 1; k <= n; k++) {
      const p = at(k), g = el(root, "g", {});
      const sel = live && state.pick && state.pick.which === which && state.pick.x === k;
      const attrs = { cx: p.x.toFixed(1), cy: p.y.toFixed(1), r, class: "node" + (sel ? " sel" : "") };
      if (live) Object.assign(attrs, { tabindex: "0", role: "button", "aria-pressed": sel ? "true" : "false", "aria-label": `${which}: number ${k}, sent to ${perm[k - 1]}` });
      const c = el(g, "circle", attrs);
      el(g, "text", { x: p.x.toFixed(1), y: p.y.toFixed(1) }).textContent = String(k);
      if (live) {
        const choose = () => { state = Core.press(state, which, k); render(); };
        c.addEventListener("click", choose);
        c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(); } });
      }
    }
    document.getElementById(panes[which][1]).textContent = Core.cycleText(perm) + (Core.isEven(perm) ? " (even)" : " (odd)");
  }

  function render() {
    draw("f", state.f, true);
    draw("g", state.g, true);
    const fg = Core.product(state.f, state.g);
    draw("p", fg, false);
    say(state.pick ? `Now press the number to swap with ${state.pick.x} in ${state.pick.which}.` : "Press two numbers in f or g to swap them.");
    nIn.value = String(state.n);
    if (window.Track) window.Track.state({ n: state.n, f: state.f, g: state.g });
  }

  function fresh() { state = Core.start({ n: nIn.value }); render(); }
  newBtn.addEventListener("click", fresh);
  nIn.addEventListener("change", fresh);
  render();
})();
