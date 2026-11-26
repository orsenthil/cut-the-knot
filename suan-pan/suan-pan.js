"use strict";

/*
 * The page for Suan Pan in Various Number Systems: drawing and input only;
 * the beads and the tidying are in suan-pan-core.js. An SVG shows the frame
 * with two heaven beads and r/2 earth beads on each wire and the value under
 * it. Click a bead to move it. When a wire has something to trade it is
 * highlighted and, after a pause, the trade happens: a timer ticks every
 * 200 ms while there is anything to do. Keyboard: arrows move between
 * beads, Enter or Space moves one.
 */

(function () {
  const Core = SuanPanCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const radixSel = document.getElementById("radixSel");
  const wiresSel = document.getElementById("wiresSel");
  const NS = "http://www.w3.org/2000/svg";
  const BH = 18, BW = 40, DX = 54, M = 16;

  let state = Core.start();
  let cursor = { wire: 0, bead: "h1" };
  let hadFocus = false;
  let timer = null;

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

  function order() {
    const half = state.radix / 2;
    return ["h1", "h0"].concat(Array.from({ length: half }, (_, k) => half - 1 - k)); // top to bottom
  }

  function render() {
    const n = state.wires.length, half = state.radix / 2;
    const W = M * 2 + n * DX, top = M, barY = top + 3 * BH + 22, earthBottom = barY + 8 + (half + 1) * BH + 8, H = earthBottom + M + 30;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.maxWidth = `${W * 1.1}px`;
    svg.style.minWidth = `${n * 3.2}rem`;
    svg.textContent = "";
    svg.appendChild(el("rect", { x: 3, y: 3, width: W - 6, height: earthBottom, rx: 10 }, "frame"));
    const read = Core.reading(state);
    state.wires.forEach((w, i) => {
      const cx = M + DX * i + DX / 2;
      if (w.alert > 0) svg.appendChild(el("rect", { x: cx - DX / 2 + 3, y: 8, width: DX - 6, height: earthBottom - 10, rx: 8 }, "busy"));
      svg.appendChild(el("line", { x1: cx, y1: top, x2: cx, y2: earthBottom }, "wire"));
      const beads = [
        ["h1", w.heaven[1] ? barY - 4 - 2 * BH : barY - 4 - 3 * BH - 6],
        ["h0", w.heaven[0] ? barY - 4 - BH : barY - 4 - 2 * BH - 6],
      ];
      w.earth.forEach((on, k) => beads.push([k, barY + 8 + (half - 1 - k) * BH + (on ? 0 : BH + 6)]));
      for (const [b, y] of beads) {
        const at = b === "h0" ? w.heaven[0] : b === "h1" ? w.heaven[1] : w.earth[b];
        const g = el("rect", { x: cx - BW / 2, y, width: BW, height: BH - 2, rx: 8 }, `bead${at ? " on" : ""}`);
        g.dataset.wire = String(i); g.dataset.bead = String(b);
        g.setAttribute("tabindex", cursor.wire === i && String(cursor.bead) === String(b) ? "0" : "-1");
        g.setAttribute("role", "button");
        g.setAttribute("aria-label", `Wire ${i + 1}, ${typeof b === "string" ? `heaven bead worth ${half}` : "earth bead"}, ${at ? "at the bar" : "away from the bar"}`);
        svg.appendChild(g);
      }
      svg.appendChild(el("text", { x: cx, y: earthBottom + 30 }, "digit", read.digits[i]));
    });
    svg.appendChild(el("rect", { x: M - 4, y: barY - 2, width: n * DX + 8, height: 6, rx: 3 }, "bar"));
    if (hadFocus) { const f = svg.querySelector('[tabindex="0"]'); if (f) f.focus(); }
    say(Core.busy(state) ? "Tidying up: watch the highlighted wire." : `In base ${state.radix}: ${read.digits.join("").replace(/[()]/g, "") || "0"}${state.radix !== 10 ? `, which is ${read.decimal} in base 10` : ""}.`);
    if (window.Track) window.Track.state({ radix: state.radix, values: state.wires.map((_, i) => Core.value(state, i)) });
  }

  function run() {
    if (timer !== null || !Core.busy(state)) return;
    timer = setInterval(() => {
      state = Core.tick(state);
      if (!Core.busy(state)) { clearInterval(timer); timer = null; }
      render();
    }, Core.TICK_MS);
  }

  function clickBead(i, b) {
    const s = Core.click(state, i, b === "h0" || b === "h1" ? b : Number(b));
    if (!s) return;
    state = s;
    cursor = { wire: i, bead: b === "h0" || b === "h1" ? b : Number(b) };
    render();
    run();
  }

  svg.addEventListener("click", (ev) => {
    const t = ev.target.closest(".bead");
    if (!t) return;
    hadFocus = !!(document.activeElement && document.activeElement.classList && document.activeElement.classList.contains("bead"));
    clickBead(Number(t.dataset.wire), t.dataset.bead);
  });
  svg.addEventListener("keydown", (ev) => {
    const o = order();
    let pos = o.findIndex((b) => String(b) === String(cursor.bead));
    if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); hadFocus = true; clickBead(cursor.wire, String(cursor.bead)); return; }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
    if (!d) return;
    ev.preventDefault();
    cursor.wire = Math.max(0, Math.min(state.wires.length - 1, cursor.wire + d[0]));
    cursor.bead = o[Math.max(0, Math.min(o.length - 1, pos + d[1]))];
    hadFocus = true;
    render();
  });
  function reset() {
    if (timer !== null) { clearInterval(timer); timer = null; }
    state = Core.start({ radix: Number(radixSel.value), wires: Number(wiresSel.value) });
    cursor = { wire: 0, bead: "h1" };
    hadFocus = false;
    render();
  }
  radixSel.addEventListener("change", reset);
  wiresSel.addEventListener("change", reset);
  document.getElementById("resetBtn").addEventListener("click", reset);

  render();
})();
