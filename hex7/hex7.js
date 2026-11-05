"use strict";

/*
 * Hex 7 - the page.
 *
 * Rules and the computer live in hex7-core.js; this file draws the board
 * and runs the turns. As in the applet, you choose a side and a level;
 * switching sides on your turn hands the move to the computer, which is how
 * you let it go first.
 *
 * The board is an SVG rhombus of pointy-topped hexagons, each row shifted
 * half a cell to the right of the one above. Bands along the edges show
 * which colour joins which sides. One cell at a time is in the tab order;
 * the arrow keys move between cells and Enter or Space plays.
 */

(() => {
  const H = Hex7Core;
  const { N, WHITE, BLACK, EMPTY, CENTRE } = H;

  const svg = document.getElementById("board");
  const sideInput = document.getElementById("sideInput");
  const levelInput = document.getElementById("levelInput");
  const newBtn = document.getElementById("newBtn");
  const statusEl = document.getElementById("status");

  const SVG = "http://www.w3.org/2000/svg";
  const S = 20; // hexagon radius
  const W = Math.sqrt(3) * S; // hexagon width
  const PAD = 26;
  const THINK_MS = 30; // let "Thinking ..." paint before the search runs
  const NAME = { [WHITE]: "White", [BLACK]: "Black" };

  let state = null;
  let human = WHITE;
  let busy = false;
  let timer = null;
  let focusCell = 0;
  const polys = [];

  const cx = (r, c) => PAD + W / 2 + c * W + (r * W) / 2;
  const cy = (r) => PAD + S + r * 1.5 * S;

  function hexPoints(x, y, rad) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const a = (Math.PI / 180) * (60 * i - 90);
      pts.push((x + rad * Math.cos(a)).toFixed(2) + "," + (y + rad * Math.sin(a)).toFixed(2));
    }
    return pts.join(" ");
  }

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function build() {
    const width = cx(N - 1, N - 1) + W / 2 + PAD;
    const height = cy(N - 1) + S + PAD;
    svg.setAttribute("viewBox", `0 0 ${width.toFixed(1)} ${height.toFixed(1)}`);
    svg.replaceChildren();

    // Edge bands: top and bottom for White, left and right for Black.
    const band = (pts, side) => svg.appendChild(el("polygon", { points: pts.map((p) => p.join(",")).join(" "), class: "edge " + side }));
    const e = 9;
    const tl = [cx(0, 0) - W / 2, cy(0) - S / 2];
    const tr = [cx(0, N - 1) + W / 2, cy(0) - S / 2];
    const bl = [cx(N - 1, 0) - W / 2, cy(N - 1) + S / 2];
    const br = [cx(N - 1, N - 1) + W / 2, cy(N - 1) + S / 2];
    band([[tl[0], tl[1] - e], [tr[0] + e, tr[1] - e], [tr[0], tr[1]], tl], "white");
    band([bl, br, [br[0], br[1] + e], [bl[0] - e, bl[1] + e]], "white");
    band([[tl[0] - e, tl[1] - e], tl, bl, [bl[0] - e, bl[1] + e]], "black");
    band([[tr[0] + e, tr[1] - e], [br[0] + e, br[1] + e], br, tr], "black");

    polys.length = 0;
    for (let r = 0; r < N; r++) {
      const row = el("g", { role: "row" });
      for (let c = 0; c < N; c++) {
        const k = r * N + c;
        const p = el("polygon", { points: hexPoints(cx(r, c), cy(r), S - 0.8), class: "cell", role: "gridcell", tabindex: "-1" });
        p.addEventListener("click", () => tryPlay(k));
        p.addEventListener("keydown", (ev) => key(ev, k));
        row.appendChild(p);
        polys.push(p);
      }
      svg.appendChild(row);
    }
    svg.appendChild(el("polygon", { points: hexPoints(cx(3, 3), cy(3), S * 0.55), class: "centre-mark", id: "centreMark" }));
  }

  /** The winning chain, for highlighting: the winner's cells that touch both edges. */
  function winningChain(side) {
    const nb = H.neighbours(N);
    const reach = (startEdge) => {
      const seen = new Set();
      const stack = [];
      for (let i = 0; i < N; i++) {
        const k = side === WHITE ? (startEdge ? i : (N - 1) * N + i) : startEdge ? i * N : i * N + N - 1;
        if (state.cells[k] === side) { seen.add(k); stack.push(k); }
      }
      while (stack.length) {
        const k = stack.pop();
        for (const j of nb[k]) if (!seen.has(j) && state.cells[j] === side) { seen.add(j); stack.push(j); }
      }
      return seen;
    };
    const a = reach(true);
    const b = reach(false);
    return new Set([...a].filter((k) => b.has(k)));
  }

  function render() {
    const chain = state.winner ? winningChain(state.winner) : new Set();
    polys.forEach((p, k) => {
      const v = state.cells[k];
      const r = Math.floor(k / N);
      const c = k % N;
      p.setAttribute("class",
        "cell" + (v === WHITE ? " white" : v === BLACK ? " black" : "") +
        (v === EMPTY && state.ply === 1 && k === CENTRE ? " blocked" : "") +
        (k === state.last && !chain.size ? " last" : "") + (chain.has(k) ? " chain" : ""));
      const who = v === WHITE ? "white" : v === BLACK ? "black" : k === CENTRE && state.ply === 1 ? "blocked for the first move" : "empty";
      p.setAttribute("aria-label", `row ${r + 1}, column ${c + 1}: ${who}`);
      p.setAttribute("tabindex", k === focusCell ? "0" : "-1");
    });
    document.getElementById("centreMark").style.display = state.ply === 1 ? "" : "none";
    svg.classList.toggle("busy", busy);
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
  }

  function finish() {
    if (state.winner === human) setStatus(`${NAME[human]} wins! You joined your edges.`, "win");
    else setStatus(`${NAME[state.winner]} wins. The computer joined its edges.`, "lose");
  }

  function computerTurn() {
    busy = true;
    setStatus("Thinking ...", "");
    render();
    timer = setTimeout(() => {
      timer = null;
      H.play(state, H.chooseMove(state, levelInput.value));
      busy = false;
      if (state.winner) finish();
      else setStatus("Your move.", "");
      render();
    }, THINK_MS);
  }

  function tryPlay(k) {
    if (busy || state.winner || state.turn !== human) return;
    if (state.ply === 1 && k === CENTRE) {
      setStatus("The middle hexagon is blocked for the very first move. Try another.", "");
      return;
    }
    if (!H.play(state, k)) return;
    focusCell = k;
    if (state.winner) {
      finish();
      render();
      return;
    }
    computerTurn();
  }

  function key(ev, k) {
    const r = Math.floor(k / N);
    const c = k % N;
    const step = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[ev.key];
    if (step) {
      ev.preventDefault();
      const rr = Math.min(N - 1, Math.max(0, r + step[0]));
      const cc = Math.min(N - 1, Math.max(0, c + step[1]));
      focusCell = rr * N + cc;
      render();
      polys[focusCell].focus();
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      tryPlay(k);
    }
  }

  function newGame() {
    if (timer) clearTimeout(timer);
    timer = null;
    busy = false;
    human = Number(sideInput.value);
    state = H.start();
    focusCell = 0;
    render();
    if (state.turn === human) setStatus("Your move.", "");
    else computerTurn();
  }

  // As in the applet: switching sides on your turn lets the computer move.
  sideInput.addEventListener("change", () => {
    const wanted = Number(sideInput.value);
    if (!state || state.winner) {
      newGame();
      return;
    }
    if (busy) {
      sideInput.value = String(human);
      return;
    }
    human = wanted;
    if (state.turn !== human) computerTurn();
  });
  newBtn.addEventListener("click", newGame);

  build();
  newGame();
})();
