"use strict";

/*
 * The page for Group Multiplication of Permutations: drawing and input only.
 * A list of six lines (f, g, fg, gf and the two conjugates), each as a list of
 * values or as a product of cycles. The maths is in perm-group-core.js.
 */

(function () {
  const Core = PermGroupCore;
  const rows = document.getElementById("rows");
  const statusEl = document.getElementById("status");
  const cycIn = document.getElementById("cycIn"), nIn = document.getElementById("nIn"), newBtn = document.getElementById("newBtn");

  let state = Core.start({ n: Core.DEFAULT_N });

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function add(label, value, tag) {
    const dt = document.createElement("dt");
    dt.textContent = label;
    const dd = document.createElement("dd");
    dd.textContent = state.cycles ? Core.cycleText(value) : Core.listText(value);
    rows.append(dt, dd);
  }

  function render() {
    rows.textContent = "";
    const e = Core.everything(state.f, state.g);
    add("f =", e.f); add("g =", e.g);
    const sep = () => { const s = document.createElement("div"); s.className = "sep"; rows.appendChild(s); };
    sep();
    add("fg =", e.fg); add("gf =", e.gf);
    sep();
    add("f⁻¹gf =", e.fgf); add("g⁻¹fg =", e.gfg);
    cycIn.checked = state.cycles;
    nIn.value = String(state.n);
    const shapeG = Core.shape(state.g).join("+"), shapeC = Core.shape(e.fgf).join("+");
    say(`g has cycles of lengths ${shapeG}; so does f⁻¹gf (${shapeC}).`, "done");
    if (window.Track) window.Track.state({ n: state.n, f: state.f, g: state.g, cycles: state.cycles });
  }

  function fresh() { state = Core.start({ n: nIn.value, cycles: cycIn.checked }); render(); }
  newBtn.addEventListener("click", fresh);
  nIn.addEventListener("change", fresh);
  cycIn.addEventListener("change", () => { state = Object.assign({}, state, { cycles: cycIn.checked }); render(); });
  render();
})();
