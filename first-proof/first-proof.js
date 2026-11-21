"use strict";

/*
 * The page for Heads and Tails: drawing and input only; the counting is in first-proof-core.js.
 * An SVG polygon of n pins, each with a blunt head (a round knob) and a pointed tail; press a pin
 * to turn it round. The counts of the three kinds of vertex (head to head, head to tail, tail to
 * tail) show when "Hint" is ticked. One pin is in the tab order; the arrow keys move round the
 * polygon and Enter or Space turns the pin.
 */

(function () {
  const Core = FirstProofCore;
  const svg = document.getElementById("pins");
  const statusEl = document.getElementById("status");
  const countsEl = document.getElementById("counts");
  const nIn = document.getElementById("nIn");
  const hintBox = document.getElementById("hintBox");
  const resetBtn = document.getElementById("resetBtn");
  const SVGNS = "http://www.w3.org/2000/svg";
  const CX = 200, CY = 190;

  let state = Core.start({});
  let cur = 0;
  let focusCur = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }
  const el = (name, attrs) => { const e = document.createElementNS(SVGNS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };

  function render() {
    const n = state.n;
    svg.textContent = "";
    const R = Math.min(150, 70 + 4000 / (n + 10)) ;
    const P = (i) => [CX + R * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), CY + R * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)];
    const verts = Core.vertices(state);
    const thick = Math.max(2.5, Math.min(7, 140 / n)), knob = thick * 1.3;
    for (let i = 0; i < n; i++) {
      const [x1, y1] = P(i), [x2, y2] = P((i + 1) % n);
      // the pin occupies the middle 80% of the side, as in the applet
      const sx = x1 + 0.1 * (x2 - x1), sy = y1 + 0.1 * (y2 - y1), ex = x2 + 0.1 * (x1 - x2), ey = y2 + 0.1 * (y1 - y2);
      const direct = state.direct[i];
      const [tx, ty, hx, hy] = direct ? [sx, sy, ex, ey] : [ex, ey, sx, sy]; // tail then head
      const len = Math.hypot(hx - tx, hy - ty), ux = (hx - tx) / len, uy = (hy - ty) / len, nx = -uy, ny = ux;
      const g = el("g", { class: "pin" + (i === cur ? " cur" : ""), tabindex: i === cur ? "0" : "-1", role: "button", "data-pin": i });
      g.setAttribute("aria-label", `Pin ${i + 1}: head at corner ${((direct ? i + 1 : i) % n) + 1}, tail at corner ${((direct ? i : i + 1) % n) + 1}. Press to turn it round.`);
      g.appendChild(el("line", { x1: tx, y1: ty, x2: hx, y2: hy, class: "hit" }));
      g.appendChild(el("line", { x1: tx, y1: ty, x2: hx, y2: hy, class: "shaft", "stroke-width": thick }));
      const tip = Math.min(len * 0.3, thick * 3);
      g.appendChild(el("polygon", { points: `${tx},${ty} ${tx + ux * tip + nx * thick * 0.9},${ty + uy * tip + ny * thick * 0.9} ${tx + ux * tip - nx * thick * 0.9},${ty + uy * tip - ny * thick * 0.9}`, class: "tail" }));
      g.appendChild(el("circle", { cx: hx, cy: hy, r: knob, class: "head" }));
      svg.appendChild(g);
    }
    // the corners, coloured by kind when the hint is on
    verts.forEach((v, i) => {
      const [x, y] = P((i + 1) % n);
      svg.appendChild(el("circle", { cx: x, cy: y, r: 4, class: "corner" + (state.hint ? " k" + v : "") }));
    });
    const c = Core.counts(state);
    countsEl.textContent = state.hint ? `HH = ${c.hh}   HT = ${c.ht}   TT = ${c.tt}   (HH + HT + TT = ${state.n})` : "Tick Hint to count the corners.";
    nIn.value = String(n); hintBox.checked = state.hint;
    if (focusCur) { const g = svg.querySelector(`g.pin[data-pin="${cur}"]`); if (g) g.focus(); focusCur = false; }
    if (window.Track) window.Track.state(state);
  }

  function announce() {
    const c = Core.counts(state);
    if (!state.hint) return "";
    if (state.n === 3) return c.ht === 3 ? "All three corners are the same: head to tail." : "All three corners are different: one of each.";
    return c.hh === c.tt ? `HH and TT are equal: ${c.hh} each.` : "";
  }

  function apply(m) { const next = Core.move(state, m); if (!next) return false; state = next; render(); say(announce()); return true; }

  svg.addEventListener("click", (e) => { const g = e.target.closest("g.pin"); if (!g) return; cur = Number(g.dataset.pin); focusCur = true; apply({ type: "flip", pin: cur }); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("g.pin"); if (!g) return;
    const i = Number(g.dataset.pin), n = state.n;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); cur = i; focusCur = true; apply({ type: "flip", pin: i }); }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cur = (i + 1) % n; focusCur = true; render(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cur = (i + n - 1) % n; focusCur = true; render(); }
  });
  nIn.addEventListener("change", () => { if (!apply({ type: "n", value: nIn.value })) { say(`The number of pins is a whole number from ${Core.MIN_N} to ${Core.MAX_N}.`); nIn.value = String(state.n); } else { cur = 0; say(`${state.n} pins.`); } });
  hintBox.addEventListener("change", () => { state = Core.move(state, { type: "hint", value: hintBox.checked }); render(); say(announce()); });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); cur = 0; render(); say("All pins point the same way again."); });
  window.addEventListener("themechange", render);

  render();
})();
