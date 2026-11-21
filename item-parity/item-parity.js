"use strict";

/* Browser UI: two rows of coloured cells; click two in a row to swap them. */
(() => {
  const C = ItemParityCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const colsInput = document.getElementById("colsInput");
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
          "aria-label": `Row ${ri + 1}, column ${i + 1}: ${color === "R" ? "red" : "blue"}. Click two cells in this row to swap them.`,
        });
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
        rect.dataset.key = key;
        rect.addEventListener("click", choose);
        rect.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); choose(); }
        });
        svg.appendChild(rect);
      });
    });

    for (const i of r.redJoints) {
      svg.appendChild(el("line", {
        x1: xAt(i) + cellW / 2, y1: 60, x2: xAt(i) + cellW / 2, y2: 96,
        class: "joint red-line",
      }));
    }
    for (const i of r.blueJoints) {
      svg.appendChild(el("line", {
        x1: xAt(i) + cellW / 2, y1: 60, x2: xAt(i) + cellW / 2, y2: 96,
        class: "joint blue-line",
      }));
    }

    colsInput.value = String(state.cols);
    readout.textContent = `${state.cols} columns · red joints ${r.red} · blue joints ${r.blue}`;
    status.textContent = r.equal
      ? `The counts match: ${r.red} red joints and ${r.blue} blue joints — whatever order the colours are in.`
      : "The counts do not match.";
    status.className = r.equal ? "win" : "lose";
    if (window.Track) window.Track.state({
      cols: state.cols, rows: state.rows.map((row) => row.slice()),
      redJoints: r.redJoints, blueJoints: r.blueJoints, red: r.red, blue: r.blue, moves: state.moves,
    });
  }

  colsInput.addEventListener("input", () => {
    state = C.setCols(state, Number(colsInput.value));
    selected = null;
    render();
  });
  randomBtn.addEventListener("click", () => { state = C.randomize(state); selected = null; render(); });

  state = C.start();
  render();
})();
