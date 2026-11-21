"use strict";

/*
 * The page for EAN-13: drawing and input only; the rules are in ean13-core.js.
 * The thirteen digits are a row of buttons (the first twelve raise by 1 when
 * pressed or take a typed digit; the thirteenth is computed) over a drawing of
 * the 95 bars, with the left odd/even parity pattern the first digit chooses
 * written over the bars.
 */

(function () {
  const Core = Ean13Core;
  const digitsEl = document.getElementById("digits");
  const bars = document.getElementById("bars");
  const statusEl = document.getElementById("status");
  const sumEl = document.getElementById("sum");
  const resetBtn = document.getElementById("resetBtn");
  const SVGNS = "http://www.w3.org/2000/svg";
  let state = Core.start({});
  let focusAt = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }

  const el = (name, attrs, text) => { const e = document.createElementNS(SVGNS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text) e.textContent = text; return e; };

  function drawBars() {
    bars.textContent = "";
    bars.appendChild(el("rect", { x: 0, y: 0, width: 105, height: 64, class: "paper" }));
    let x = 5;
    for (const p of Core.parts(state)) {
      p.bits.forEach((b, k) => { if (b) bars.appendChild(el("rect", { x: x + k, y: 8, width: 1, height: p.kind === "guard" || p.kind === "middle" ? 50 : 44, class: "bar" })); });
      if (p.kind === "left" || p.kind === "right") bars.appendChild(el("text", { x: x + 3.5, y: 6, class: "par", "text-anchor": "middle" }, p.kind === "right" ? "R" : p.odd ? "L" : "G"));
      x += p.bits.length;
    }
  }

  function render() {
    drawBars();
    digitsEl.textContent = "";
    state.digits.forEach((v, i) => {
      if (i < 12) {
        const b = document.createElement("button");
        b.type = "button"; b.className = "digit"; b.textContent = String(v); b.dataset.i = i;
        b.setAttribute("aria-label", `Digit ${i + 1}: ${v}. Press to raise it by one, or type a digit.`);
        digitsEl.appendChild(b);
      } else {
        const s = document.createElement("span");
        s.className = "digit check"; s.textContent = String(v);
        s.setAttribute("aria-label", `Check digit: ${v}, computed.`);
        digitsEl.appendChild(s);
      }
    });
    const terms = state.digits.map((d, i) => (i % 2 === 0 ? "" : "3×") + d);
    const total = state.digits.reduce((s, d, i) => s + (i % 2 === 0 ? d : 3 * d), 0);
    sumEl.textContent = terms.join(" + ") + " = " + total;
    if (focusAt !== null) { const b = digitsEl.querySelector(`button[data-i="${focusAt}"]`); if (b) b.focus(); focusAt = null; }
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render(); say(note); return true;
  }

  digitsEl.addEventListener("click", (e) => {
    const b = e.target.closest("button.digit"); if (!b) return;
    focusAt = Number(b.dataset.i);
    apply({ type: "step", i: focusAt }, `Digit ${focusAt + 1} raised by 1; the check digit is now ${state.digits[12]}.`);
  });
  digitsEl.addEventListener("keydown", (e) => {
    const b = e.target.closest("button.digit"); if (!b) return;
    const i = Number(b.dataset.i);
    if (/^[0-9]$/.test(e.key)) { e.preventDefault(); focusAt = i; apply({ type: "set", i, value: Number(e.key) }, `Digit ${i + 1} set to ${e.key}; the check digit is now ${state.digits[12]}.`); }
    else if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); const nb = digitsEl.querySelector(`button[data-i="${Math.max(0, Math.min(11, i + (e.key === "ArrowRight" ? 1 : -1)))}"]`); if (nb) nb.focus(); }
  });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); render(); say("Back to 0123456789012."); });

  render();
})();
