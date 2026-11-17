"use strict";

/*
 * Trigg Tromino — the page.
 *
 * The board's rules live in trigg-tromino-core.js; this file draws it. As in
 * the applet, a piece takes three clicks and the middle one is the corner;
 * "Wire" shows each piece as a bent line, "Blocks" fills it; "Remove last"
 * takes back the last piece. The centre four squares are the hole. When the
 * board is covered, fault lines (grid lines no tromino crosses) turn red and
 * the status reports how many there are.
 */

(() => {
  const T = TriggTrominoCore;
  const SVG = "http://www.w3.org/2000/svg";
  const CELL = 40;
  const COLOURS = ["#d0463b", "#3d74c4", "#dda01b", "#3d9a5c", "#8a5cc2", "#d0773b", "#2f9aa3", "#c2508a"];

  const svg = document.getElementById("board");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");

  let s = null;
  let focus = [0, 0];
  let cells = [];

  const el = (name, attrs) => {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };
  const say = (text, kind) => {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  };
  const view = () => document.querySelector('input[name="view"]:checked').value;
  const centre = ([r, c]) => [c * CELL + CELL / 2 + 2, r * CELL + CELL / 2 + 2];

  function firstFree() {
    for (let r = 0; r < T.SIZE; r++) {
      for (let c = 0; c < T.SIZE; c++) {
        if (T.free(s, r, c)) return [r, c];
      }
    }
    return [0, 0];
  }

  function build() {
    svg.setAttribute("viewBox", `0 0 ${T.SIZE * CELL + 4} ${T.SIZE * CELL + 4}`);
    svg.replaceChildren();
    cells = [];
    for (let r = 0; r < T.SIZE; r++) {
      const row = el("g", { role: "row" });
      const line = [];
      for (let c = 0; c < T.SIZE; c++) {
        if (T.isHole(r, c)) {
          const hole = el("rect", {
            x: c * CELL + 2,
            y: r * CELL + 2,
            width: CELL,
            height: CELL,
            class: "sq hole",
            role: "gridcell",
            "aria-label": `row ${r + 1}, column ${c + 1}: hole`,
          });
          row.appendChild(hole);
          line.push(null);
        } else {
          const sq = el("rect", {
            x: c * CELL + 2,
            y: r * CELL + 2,
            width: CELL,
            height: CELL,
            class: "sq",
            role: "gridcell",
            tabindex: "-1",
          });
          sq.addEventListener("click", () => pick(r, c));
          sq.addEventListener("keydown", (e) => key(e, r, c));
          row.appendChild(sq);
          line.push(sq);
        }
      }
      svg.appendChild(row);
      cells.push(line);
    }
    svg.appendChild(el("g", { id: "art" }));
    svg.appendChild(el("g", { id: "faults" }));
  }

  /** First colour that no earlier neighbouring piece uses. */
  function colourOf(i) {
    const used = new Set();
    for (const [r, c] of s.pieces[i]) {
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const o = s.owner[r + dr] && s.owner[r + dr][c + dc];
        if (o !== undefined && o >= 0 && o < i) used.add(colourOf(o));
      }
    }
    let k = 0;
    while (used.has(k)) k++;
    return k % COLOURS.length;
  }

  function render() {
    for (let r = 0; r < T.SIZE; r++) {
      for (let c = 0; c < T.SIZE; c++) {
        const sq = cells[r][c];
        if (!sq) continue;
        const taken = s.owner[r][c] >= 0;
        const picked = s.building.some(([x, y]) => x === r && y === c);
        sq.setAttribute("class", "sq" + (taken ? " taken" : "") + (picked ? " picked" : ""));
        sq.setAttribute("tabindex", r === focus[0] && c === focus[1] ? "0" : "-1");
        sq.setAttribute(
          "aria-label",
          `row ${r + 1}, column ${c + 1}: ${taken ? "covered" : picked ? "picked" : "empty"}`
        );
      }
    }
    const art = document.getElementById("art");
    art.replaceChildren();
    s.pieces.forEach((p, i) => {
      if (view() === "blocks") {
        for (const [r, c] of p) {
          art.appendChild(
            el("rect", {
              x: c * CELL + 4,
              y: r * CELL + 4,
              width: CELL - 4,
              height: CELL - 4,
              rx: 4,
              class: "block",
              fill: COLOURS[colourOf(i)],
            })
          );
        }
      } else {
        art.appendChild(
          el("polyline", {
            points: p.map((q) => centre(q).join(",")).join(" "),
            class: "wire",
          })
        );
        for (const q of [p[0], p[2]]) {
          const [x, y] = centre(q);
          art.appendChild(el("circle", { cx: x, cy: y, r: 5, class: "wire-dot" }));
        }
      }
    });

    const faultLayer = document.getElementById("faults");
    faultLayer.replaceChildren();
    if (T.finished(s)) {
      const f = T.faults(s);
      const n = f.horizontal.length + f.vertical.length;
      const W = T.SIZE * CELL + 4;
      for (const h of f.horizontal) {
        const y = h * CELL + 2;
        faultLayer.appendChild(
          el("line", { x1: 2, y1: y, x2: W - 2, y2: y, class: "fault" })
        );
      }
      for (const v of f.vertical) {
        const x = v * CELL + 2;
        faultLayer.appendChild(
          el("line", { x1: x, y1: 2, x2: x, y2: W - 2, class: "fault" })
        );
      }
      const word = n === 1 ? "fault line" : "fault lines";
      say(`Covered! ${n} ${word}.`, "win");
    }

    undoBtn.disabled = s.pieces.length === 0;
    if (window.Track) window.Track.state(s);
  }

  function pick(r, c) {
    focus = [r, c];
    const res = T.click(s, r, c);
    if (res === "refused") say("That square is already covered or is the hole.", "");
    else if (!T.finished(s)) {
      say(
        res === "added" && s.building.length === 2
          ? "Now a square next to it, turning the corner."
          : "",
        ""
      );
    }
    render();
  }

  function key(e, r, c) {
    const step = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    }[e.key];
    if (step) {
      e.preventDefault();
      let nr = r;
      let nc = c;
      for (;;) {
        const nextR = nr + step[0];
        const nextC = nc + step[1];
        if (nextR < 0 || nextR >= T.SIZE || nextC < 0 || nextC >= T.SIZE) break;
        nr = nextR;
        nc = nextC;
        if (!T.isHole(nr, nc)) break;
      }
      if (!T.isHole(nr, nc)) focus = [nr, nc];
      render();
      const sq = cells[focus[0]][focus[1]];
      if (sq) sq.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(r, c);
    }
  }

  function reset() {
    s = T.start();
    focus = firstFree();
    build();
    say("", "");
    render();
  }

  for (const r of document.querySelectorAll('input[name="view"]')) {
    r.addEventListener("change", () => {
      if (!T.finished(s)) say("", "");
      render();
    });
  }
  undoBtn.addEventListener("click", () => {
    if (T.removeLast(s)) {
      say("", "");
      render();
    }
  });
  resetBtn.addEventListener("click", reset);

  reset();
})();
