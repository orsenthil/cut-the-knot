"use strict";

/*
 * The page for the Pythagorean Triples Calculator: drawing and input only;
 * the formulas are in pyth-triple-calculator-core.js. Three number boxes set
 * N, M and k; an SVG draws the right triangle to scale with its sides
 * labelled (if "Show lengths" is on), as the applet does, and a line under it
 * checks a² + b² = c² and says whether the triple is primitive.
 */

(function () {
  const Core = PythTripleCalculatorCore;
  const NS = "http://www.w3.org/2000/svg";
  const pic = document.getElementById("pic");
  const sumEl = document.getElementById("sum");
  const primEl = document.getElementById("prim");
  const inputs = { n: document.getElementById("nIn"), m: document.getElementById("mIn"), k: document.getElementById("kIn") };
  const lengthsBox = document.getElementById("lengthsBox");
  let state = Core.start({});

  const el = (name, attrs, text) => { const e = document.createElementNS(NS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const fmt = (x) => x.toLocaleString("en-US");

  function render() {
    for (const k in inputs) if (Number(inputs[k].value) !== state[k]) inputs[k].value = String(state[k]);
    lengthsBox.checked = state.showLengths;
    pic.replaceChildren();
    const t = Core.triple(state);
    if (!t) {
      sumEl.textContent = "N and M are equal: a = 0, so there is no triangle. Make N bigger than M.";
      primEl.textContent = "";
      pic.setAttribute("aria-label", "No triangle");
    } else {
      // The applet's Reset: fit the legs in the box with a 20-unit margin, right angle at the bottom right.
      const W = 400, H = 300, pad = 40;
      const scale = Math.min((W - 2 * pad) / t.a, (H - 2 * pad) / t.b);
      const A = t.a * scale, B = t.b * scale;
      const x0 = (W - A) / 2, y0 = (H + B) / 2;
      const P = [x0, y0], Q = [x0 + A, y0], R = [x0 + A, y0 - B];
      pic.append(el("polygon", { points: [P, Q, R].map((p) => p.join(",")).join(" "), class: "tri" }));
      const s = Math.min(14, A / 4, B / 4);
      pic.append(el("path", { d: `M${Q[0] - s} ${Q[1]} v${-s} h${s}`, class: "right" }));
      if (state.showLengths) {
        pic.append(el("text", { x: (P[0] + Q[0]) / 2, y: P[1] + 24, class: "len" }, fmt(t.a)));
        pic.append(el("text", { x: Q[0] + 10, y: (Q[1] + R[1]) / 2, class: "len start" }, fmt(t.b)));
        pic.append(el("text", { x: (P[0] + R[0]) / 2 - 10, y: (P[1] + R[1]) / 2 - 8, class: "len hyp" }, fmt(t.c)));
      }
      // Squares can pass 2^53, so square exactly with BigInt.
      const sq = (x) => BigInt(x) * BigInt(x);
      sumEl.textContent = `${fmt(t.a)}² + ${fmt(t.b)}² = ${fmt(sq(t.a))} + ${fmt(sq(t.b))} = ${fmt(sq(t.a) + sq(t.b))} = ${fmt(t.c)}²`;
      primEl.textContent = t.primitive ? "Primitive: a, b and c have no common factor." : `Not primitive: ${fmt(t.gcd)} divides a, b and c.`;
      primEl.classList.toggle("yes", t.primitive);
      pic.setAttribute("aria-label", `A right triangle with legs ${t.a} and ${t.b} and hypotenuse ${t.c}`);
    }
    if (window.Track) window.Track.state(state);
  }

  for (const k in inputs) inputs[k].addEventListener("change", () => {
    const next = Core.set(state, k, Number(inputs[k].value));
    if (next) state = next;
    render();
  });
  lengthsBox.addEventListener("change", () => { state = { ...state, showLengths: lengthsBox.checked }; render(); });
  render();
})();
