"use strict";

/* Browser UI: generalized two-row parity with uneven colour totals. */
(() => {
  const C = ItemParityGeneralizedCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const colsInput = document.getElementById("colsInput");
  const redsInput = document.getElementById("redsInput");
  const randomBtn = document.getElementById("randomBtn");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;
  let selected = null;

  const el = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  function render() {
    svg.replaceChildren();
    const r = C.analyze(state);
    const gap = 6;
    const cellW = (340 - (state.cols - 1) * gap) / state.cols;
    const xAt = (i) => 10 + i * (cellW + gap);

    state.rows.forEach((row, ri) => {
      const y = ri === 0 ? 18 : 96;
      row.forEach((color, i) => {
        const key = `${ri},${i}`;
        const rect = el("rect", {
          x: xAt(i), y, width: cellW, height: 42, rx: 7,
          class: "cell " + (color === "R" ? "red" : "blue") + (selected === key ? " selected" : ""),
          tabindex: "0", role: "button",
          "aria-label": `Row ${ri + 1}, column ${i + 1}: ${color === "R" ? "red" : "blue"}. Click two cells in this row to swap.`,
        });
        rect.dataset.key = key;
        const choose = () => {
          if (selected === null) selected = key;
          else if (selected === key) selected = null;
          else {
            const [sr, sc] = selected.split(",").map(Number);
            if (sr === ri) state = C.swap(state, ri, sc, i);
            selected = null;
          }
          render();
          const again = svg.querySelector(`[data-key="${key}"]`);
          if (again) again.focus();
        };
        rect.addEventListener("click", choose);
        rect.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); choose(); }
        });
        svg.appendChild(rect);
      });
    });

    for (const i of r.redJoints) {
      svg.appendChild(el("line", { x1: xAt(i) + cellW / 2, y1: 60, x2: xAt(i) + cellW / 2, y2: 96, class: "joint red-line" }));
    }
    for (const i of r.blueJoints) {
      svg.appendChild(el("line", { x1: xAt(i) + cellW / 2, y1: 60, x2: xAt(i) + cellW / 2, y2: 96, class: "joint blue-line" }));
    }

    colsInput.value = String(state.cols);
    colsInput.max = String(C.MAX_COLS);
    redsInput.max = String(state.cols);
    redsInput.value = String(r.redTop);
    readout.textContent = `${state.cols} columns · top ${r.redTop}R/${r.blueTop}B · bottom ${r.redBottom}R/${r.blueBottom}B · joints ${r.red}R / ${r.blue}B`;
    status.textContent = !r.setupValid
      ? "The rows do not meet the condition: reds above must equal blues below, and blues above must equal reds below."
      : r.equal
        ? `Still equal: ${r.red} red joints and ${r.blue} blue joints. Unmatched reds above (${r.unmatchedRedTop}) match unmatched blues below (${r.unmatchedBlueBottom}).`
        : "The counts differ.";
    status.className = r.setupValid && r.equal ? "win" : "lose";
    if (window.Track) window.Track.state({
      cols: state.cols, rows: state.rows.map((row) => row.slice()),
      redJoints: r.redJoints, blueJoints: r.blueJoints, red: r.red, blue: r.blue,
      redTop: r.redTop, setupValid: r.setupValid, moves: state.moves,
    });
  }

  colsInput.addEventListener("input", () => {
    state = C.setCols(state, Number(colsInput.value));
    selected = null;
    render();
  });
  redsInput.addEventListener("input", () => {
    state = C.setRedTop(state, Number(redsInput.value));
    selected = null;
    render();
  });
  randomBtn.addEventListener("click", () => { state = C.randomize(state); selected = null; render(); });

  state = C.start();
  render();
})();
