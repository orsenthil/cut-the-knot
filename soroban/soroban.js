"use strict";

/*
 * The page for Soroban in Various Number Systems: drawing and input only;
 * the beads' rules are in soroban-core.js. An SVG shows the frame, the bar,
 * one heaven bead above it and r/2 - 1 earth beads below it on every wire,
 * and the digit under each wire. Click a bead to move it (and the beads it
 * pushes). Keyboard: the arrow keys move between beads, Enter or Space
 * clicks one.
 */

(function () {
  const Core = SorobanCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const radixSel = document.getElementById("radixSel");
  const wiresSel = document.getElementById("wiresSel");
  const NS = "http://www.w3.org/2000/svg";
  const BH = 18, BW = 40, DX = 54, M = 16; // bead height and width, wire spacing, frame margin

  let state = Core.start();
  let cursor = { wire: 0, bead: "heaven" };
  let hadFocus = false;

  for (const r of Core.RADICES) { const o = document.createElement("option"); o.value = o.textContent = String(r); radixSel.appendChild(o); }
  for (let w = Core.WIRES.min; w <= Core.WIRES.max; w++) { const o = document.createElement("option"); o.value = o.textContent = String(w); wiresSel.appendChild(o); }
  radixSel.value = "10"; wiresSel.value = "7";

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  function el(name, attrs, cls, text) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (cls) e.setAttribute("class", cls);
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function render() {
    const n = state.wires.length, e = state.radix / 2 - 1;
    const W = M * 2 + n * DX, top = M, barY = top + 3 * BH + 6, earthBottom = barY + 8 + (e + 1) * BH + 6, H = earthBottom + M + 30;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.maxWidth = `${W * 1.1}px`;
    svg.style.minWidth = `${n * 3.2}rem`; // a bead stays a fingertip wide; a wide frame slides sideways
    svg.textContent = "";
    svg.appendChild(el("rect", { x: 3, y: 3, width: W - 6, height: earthBottom - 3 + 6, rx: 10 }, "frame"));
    const read = Core.reading(state);
    state.wires.forEach((w, i) => {
      const cx = M + DX * i + DX / 2;
      svg.appendChild(el("line", { x1: cx, y1: top, x2: cx, y2: earthBottom }, "wire"));
      const beads = [["heaven", w.heaven ? barY - 4 - BH : barY - 4 - 2 * BH - 4]];
      w.earth.forEach((on, k) => beads.push([k, barY + 8 + (e - 1 - k) * BH + (on ? 0 : BH + 4)]));
      for (const [b, y] of beads) {
        const at = b === "heaven" ? w.heaven : w.earth[b];
        const g = el("rect", { x: cx - BW / 2, y, width: BW, height: BH - 2, rx: 8 }, `bead${at ? " on" : ""}${b === "heaven" ? " heaven" : ""}`);
        g.dataset.wire = String(i); g.dataset.bead = String(b);
        const isCursor = cursor.wire === i && String(cursor.bead) === String(b);
        g.setAttribute("tabindex", isCursor ? "0" : "-1");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", `Wire ${i + 1}, ${b === "heaven" ? `heaven bead worth ${state.radix / 2}` : "earth bead"}, ${at ? "at the bar" : "away from the bar"}`);
        svg.appendChild(g);
      }
      svg.appendChild(el("text", { x: cx, y: earthBottom + 30 }, "digit", read.digits[i]));
    });
    svg.appendChild(el("rect", { x: M - 4, y: barY - 2, width: n * DX + 8, height: 6, rx: 3 }, "bar"));
    if (hadFocus) { const f = svg.querySelector('[tabindex="0"]'); if (f) f.focus(); }
    say(`In base ${state.radix}: ${read.inRadix}${state.radix !== 10 ? `, which is ${read.decimal} in base 10` : ""}.`);
    if (window.Track) window.Track.state({ radix: state.radix, digits: state.wires.map((_, i) => Core.value(state, i)) });
  }

  function clickBead(i, b) {
    const s = Core.click(state, i, b === "heaven" ? "heaven" : Number(b));
    if (!s) return;
    state = s;
    cursor = { wire: i, bead: b === "heaven" ? "heaven" : Number(b) };
    render();
  }

  svg.addEventListener("click", (ev) => {
    const t = ev.target.closest(".bead");
    if (!t) return;
    hadFocus = document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("bead");
    clickBead(Number(t.dataset.wire), t.dataset.bead);
  });
  svg.addEventListener("keydown", (ev) => {
    const e = state.radix / 2 - 1;
    const order = ["heaven"].concat(Array.from({ length: e }, (_, k) => e - 1 - k)); // top to bottom
    let pos = order.findIndex((b) => String(b) === String(cursor.bead));
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); hadFocus = true; clickBead(cursor.wire, String(cursor.bead)); return; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    cursor.wire = Math.max(0, Math.min(state.wires.length - 1, cursor.wire + d[0]));
    pos = Math.max(0, Math.min(order.length - 1, pos + d[1]));
    cursor.bead = order[pos];
    hadFocus = true;
    render();
  });
  function reset() {
    state = Core.start({ radix: Number(radixSel.value), wires: Number(wiresSel.value) });
    cursor = { wire: 0, bead: "heaven" };
    hadFocus = false;
    render();
  }
  radixSel.addEventListener("change", reset);
  wiresSel.addEventListener("change", reset);
  document.getElementById("resetBtn").addEventListener("click", reset);

  render();
})();
