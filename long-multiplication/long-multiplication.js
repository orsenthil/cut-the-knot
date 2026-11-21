"use strict";

/* Browser UI: lay out the partial products of long multiplication. */
(() => {
  const C = LongMultiplicationCore;
  const layout = document.getElementById("layout");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const aInput = document.getElementById("aInput");
  const bInput = document.getElementById("bInput");
  const compactCheck = document.getElementById("compactCheck");
  let state = null;

  function render() {
    const r = C.analyze(state);
    layout.replaceChildren();

    const addRow = (text, cls) => {
      const row = document.createElement("div");
      row.className = "lm-row " + cls;
      row.textContent = text;
      layout.appendChild(row);
    };
    addRow(String(r.a), "factor");
    addRow(`× ${r.b}`, "factor");
    addRow("", "rule");
    r.rows.forEach((row) => {
      const shown = r.compact ? String(row.value) : String(row.full);
      addRow(shown, "partial");
    });
    addRow("", "rule");
    addRow(String(r.sum), "result");

    aInput.value = String(state.a);
    bInput.value = String(state.b);
    compactCheck.checked = state.compact;
    readout.textContent = `${r.a} × ${r.b} = ${r.sum} via ${r.rows.length} partial products`;
    status.textContent = r.correct
      ? `Each row is ${r.a} times one digit of ${r.b}, shifted by its place value. Their sum is ${r.sum}.`
      : "The partial products did not add up.";
    status.className = r.correct ? "win" : "lose";
    if (window.Track) window.Track.state({
      a: r.a, b: r.b, compact: r.compact,
      partials: r.rows.map((row) => row.value), sum: r.sum,
    });
  }

  aInput.addEventListener("change", () => { state = C.setA(state, Number(aInput.value)); render(); });
  bInput.addEventListener("change", () => { state = C.setB(state, Number(bInput.value)); render(); });
  compactCheck.addEventListener("change", () => { state = C.setCompact(state, compactCheck.checked); render(); });
  state = C.start();
  render();
})();
