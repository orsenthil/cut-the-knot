"use strict";

/*
 * Browser UI for the game of Y, from Bogomolny's YTheory applet.
 *
 * An SVG triangle of hexagonal cells, one chip per cell. Clicking a cell
 * switches its colour. "Show subgame" draws the dots of the reduced board:
 * each upward triangle of three cells gets one dot of the majority colour.
 * "Shrink" replaces the board with that reduced board, one size smaller, and
 * "Reset" deals a fresh colouring of the current size. There is no opponent
 * and no win to reach — the board is a picture of the no-draw proof.
 */

(() => {
  const C = YTheoryCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const shrinkBtn = document.getElementById("shrinkBtn");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const nOut = document.getElementById("nOut");
  const subgameCheck = document.getElementById("subgameCheck");

  const SVG_NS = "http://www.w3.org/2000/svg";
  const R = 17;
  const W = Math.sqrt(3) * R;
  const H = 1.5 * R;
  const PAD = 16;
  const NAME = { [C.BLUE]: "Blue", [C.RED]: "Red" };

  let state = null;
  let showSubgame = false;
  let focusCell = 0;
  let cellEls = [];

  const cx = (i, j) => PAD + W / 2 + (j + i / 2) * W;
  const cy = (i) => PAD + R + i * H;
  const hexPoints = (x, y) => {
    const pts = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k + 30);
      pts.push(`${(x + (R - 1) * Math.cos(a)).toFixed(2)},${(y + (R - 1) * Math.sin(a)).toFixed(2)}`);
    }
    return pts.join(" ");
  };
  const el = (name, attrs) => {
    const node = document.createElementNS(SVG_NS, name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    return node;
  };

  function build() {
    const n = state.n;
    svg.setAttribute("viewBox", `0 0 ${(PAD * 2 + W * (n + 1)).toFixed(1)} ${(PAD * 2 + H * (n - 1) + 2 * R).toFixed(1)}`);
    svg.setAttribute("aria-label", `Triangular board of size ${n}, with ${n} cells on each side`);
    svg.replaceChildren();
    cellEls = [];

    if (showSubgame && n > 1) {
      for (const [a, b, c] of C.triples(n)) {
        const color = C.majority(state.cells[a], state.cells[b], state.cells[c]);
        const ca = C.coords(n, a);
        const cb = C.coords(n, b);
        const cc = C.coords(n, c);
        const x = (cx(ca.i, ca.j) + cx(cb.i, cb.j) + cx(cc.i, cc.j)) / 3;
        const y = (cy(ca.i) + cy(cb.i) + cy(cc.i)) / 3;
        svg.appendChild(el("circle", { cx: x.toFixed(2), cy: y.toFixed(2), r: 4, class: `dot ${color}` }));
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        const id = C.index(n, i, j);
        const group = el("g", {
          class: "ycell", role: "button", tabindex: id === focusCell ? "0" : "-1",
          "data-id": String(id),
        });
        group.appendChild(el("polygon", { points: hexPoints(cx(i, j), cy(i)), class: "hex" }));
        group.appendChild(el("circle", { cx: cx(i, j).toFixed(2), cy: cy(i).toFixed(2), r: R * 0.62, class: "chip" }));
        group.addEventListener("click", () => toggle(id));
        group.addEventListener("keydown", (ev) => key(ev, i, j, id));
        svg.appendChild(group);
        cellEls[id] = group;
      }
    }
  }

  function render() {
    const n = state.n;
    const blueChain = new Set(C.winningChain(state, C.BLUE) || []);
    const redChain = new Set(C.winningChain(state, C.RED) || []);
    build();
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n - i; j++) {
        const id = C.index(n, i, j);
        const color = state.cells[id];
        const group = cellEls[id];
        const { k } = C.coords(n, id);
        group.setAttribute("class",
          `ycell ${color}` + (blueChain.has(id) || redChain.has(id) ? " chain" : ""));
        group.setAttribute("aria-label",
          `Row ${i + 1}, cell ${j + 1}, side ${k + 1}: ${NAME[color]} chip; press to switch colour`);
      }
    }

    nOut.textContent = String(n);
    lessBtn.disabled = n <= C.MIN_N;
    moreBtn.disabled = n >= C.MAX_N;
    shrinkBtn.disabled = n <= 1;

    const blue = blueChain.size > 0;
    const red = redChain.size > 0;
    const winnerText = blue && !red ? "Blue reaches all three sides." : red && !blue ? "Red reaches all three sides." : "";
    status.textContent =
      `${winnerText} Board of size ${n}. Click a cell to switch its chip.` +
      (showSubgame && n > 1 ? " The small dots are the reduced board." : "");

    if (window.Track) window.Track.state({ n: state.n, cells: state.cells.slice() });
  }

  function toggle(id) {
    focusCell = id;
    state = C.toggle(state, id);
    render();
    cellEls[id].focus();
  }

  function key(ev, i, j, id) {
    if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      toggle(id);
      return;
    }
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
    if (!step) return;
    ev.preventDefault();
    const n = state.n;
    const ii = Math.max(0, Math.min(n - 1, i + step[0]));
    const jj = Math.max(0, Math.min(n - 1 - ii, j + step[1]));
    focusCell = C.index(n, ii, jj);
    render();
    cellEls[focusCell].focus();
  }

  function reset() {
    focusCell = 0;
    state = C.start({ n: state.n });
    render();
  }

  function shrink() {
    const smaller = C.reduce(state);
    if (!smaller) return;
    state = smaller;
    focusCell = 0;
    render();
  }

  function setN(value) {
    const n = C.clampN(value);
    if (n === state.n) return;
    state = { n, cells: C.start({ n }).cells };
    focusCell = 0;
    render();
  }

  resetBtn.addEventListener("click", reset);
  shrinkBtn.addEventListener("click", shrink);
  lessBtn.addEventListener("click", () => setN(state.n - 1));
  moreBtn.addEventListener("click", () => setN(state.n + 1));
  subgameCheck.addEventListener("change", () => {
    showSubgame = subgameCheck.checked;
    render();
  });

  state = C.start({ n: 7 });
  render();
})();
