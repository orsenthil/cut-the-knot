"use strict";

/*
 * The page for Compare Fractions: drawing and input only; the rules are in
 * compare-fractions-core.js. The stage shows the two fractions side by side,
 * each with a row of digit buttons per number (click the upper half of a digit
 * to raise it, the lower half to lower it; or focus it and press the Up/Down
 * arrow keys) above an SVG of boxes: a row is D boxes wide and N of them are
 * filled, as many rows as ceil(N/D). The two buttons are the applet's.
 */

(function () {
  const Core = CompareFractionsCore;
  const stageEl = document.getElementById("fractions");
  const picsEl = document.getElementById("pictures");
  const statusEl = document.getElementById("status");
  const commonBtn = document.getElementById("commonBtn");
  const simplifyBtn = document.getElementById("simplifyBtn");
  const newBtn = document.getElementById("newBtn");
  const NS = "http://www.w3.org/2000/svg";
  const NAMES = { n1: "first numerator", d1: "first denominator", n2: "second numerator", d2: "second denominator" };

  let state = null;
  let focusKey = null; // which digit has the focus, so a redraw can give it back

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs, text) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (text !== undefined) node.textContent = text;
    return node;
  }

  /** One number as a row of digit buttons. */
  function numberEl(field) {
    const wrap = document.createElement("span");
    wrap.className = "num";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", NAMES[field] + " " + state[field]);
    const text = String(state[field]);
    for (let i = 0; i < text.length; i++) {
      const k = text.length - 1 - i;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "digit";
      b.dataset.field = field;
      b.dataset.k = String(k);
      b.textContent = text[i];
      b.setAttribute("aria-label", NAMES[field] + ", digit " + text[i] + ", place " + Math.pow(10, k) + ". Up and down arrows change it.");
      b.addEventListener("click", (e) => {
        const r = b.getBoundingClientRect();
        change(field, k, e.clientY < r.top + r.height / 2 ? 1 : -1);
      });
      b.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "+") { e.preventDefault(); change(field, k, 1); }
        else if (e.key === "ArrowDown" || e.key === "-") { e.preventDefault(); change(field, k, -1); }
      });
      wrap.appendChild(b);
    }
    return wrap;
  }

  function fractionEl(n, d, label) {
    const box = document.createElement("div");
    box.className = "fraction";
    box.setAttribute("aria-label", label);
    box.append(numberEl(n), Object.assign(document.createElement("span"), { className: "bar" }), numberEl(d));
    return box;
  }

  /** The boxes of both fractions, drawn with the same box width so they compare. */
  function drawPictures() {
    picsEl.textContent = "";
    if (Core.areBig(state)) {
      picsEl.appendChild(Object.assign(document.createElement("p"), { className: "toobig", textContent: "Please Simplify!" }));
      return;
    }
    const cell = 12;
    [["n1", "d1", "pic1"], ["n2", "d2", "pic2"]].forEach(([n, d, cls]) => {
      const rows = Core.rows(state[n], state[d]);
      const w = state[d] * cell;
      const svg = el("svg", { viewBox: `0 0 ${w + 2} ${rows.length * cell + 2}`, class: "pic " + cls, role: "img", "aria-label": `${state[n]} of ${state[d]} boxes in ${rows.length} row${rows.length === 1 ? "" : "s"}` });
      svg.style.width = Math.min(100, Math.max(22, (w + 2) * 1.2)) + "%";
      rows.forEach((r, ri) => {
        for (let c = 0; c < r.width; c++) svg.appendChild(el("rect", { x: 1 + c * cell, y: 1 + ri * cell, width: cell, height: cell, class: c < r.filled ? "box on" : "box" }));
      });
      picsEl.appendChild(svg);
    });
  }

  function sentence() {
    const f = (n, d) => n + "/" + d;
    const c = Core.compare(state);
    const rel = c > 0 ? "is greater than" : c < 0 ? "is less than" : "equals";
    return `${f(state.n1, state.d1)} ${rel} ${f(state.n2, state.d2)}: ${state.n1}×${state.d2} = ${state.n1 * state.d2} ${c > 0 ? ">" : c < 0 ? "<" : "="} ${state.n2}×${state.d1} = ${state.n2 * state.d1}.`;
  }

  function render() {
    stageEl.textContent = "";
    stageEl.append(fractionEl("n1", "d1", "first fraction"), fractionEl("n2", "d2", "second fraction"));
    drawPictures();
    commonBtn.disabled = Core.areBig(state);
    if (focusKey) {
      const b = stageEl.querySelector(`.digit[data-field="${focusKey.field}"][data-k="${focusKey.k}"]`) || stageEl.querySelector(`.digit[data-field="${focusKey.field}"]`);
      if (b) b.focus();
    }
    if (window.Track) window.Track.state(state);
  }

  function after(note) {
    render();
    say(Core.areBig(state) ? "Please Simplify! " + note : sentence() + (note ? " " + note : ""), Core.result(state));
  }

  function change(field, k, dir) {
    const next = Core.move(state, { type: "digit", field, k, dir });
    if (!next) return;
    // The number may have gained or lost a digit: keep the focus on the same place if it exists.
    focusKey = { field, k: Math.min(k, Core.digits(next[field]) - 1) };
    state = next;
    after("");
  }

  function button(type, note) {
    focusKey = null;
    const next = Core.move(state, { type });
    if (!next) return;
    state = next;
    after(note(next));
    (type === "common" ? commonBtn : simplifyBtn).focus();
  }

  commonBtn.addEventListener("click", () => button("common", (s) => `Both denominators are now ${s.d1}.`));
  simplifyBtn.addEventListener("click", () => button("simplify", () => "Each fraction is in lowest terms."));

  function newGame() {
    focusKey = null;
    const r = () => 1 + Math.floor(Math.random() * 9); // the applet starts with four digits from 1 to 9
    state = Core.start({ n1: r(), d1: r(), n2: r(), d2: r() });
    render();
    say(sentence());
  }

  newBtn.addEventListener("click", newGame);
  newGame();
})();
