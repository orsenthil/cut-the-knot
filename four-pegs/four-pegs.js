"use strict";

/*
 * UI for Four Pegs That Form a Square. The rule lives in pegs-core.js; this
 * file draws the grid and the pegs and handles clicks.
 *
 * The applet dragged a peg and snapped it to the nearest legal point. Here a
 * click picks a peg up and the points it can reach appear as rings, so the
 * rule is visible rather than discovered by dragging, and the whole thing
 * works by touch and from the keyboard. The pegs and the rings are real
 * buttons positioned over an SVG that draws everything else.
 *
 * The controls are the applet's panel: four pegs or five, the side of the
 * opening square, and the grid toggle.
 */
(() => {
  const C = PegsCore;
  const NS = "http://www.w3.org/2000/svg";

  const field = document.getElementById("field");
  const svg = document.getElementById("paper");
  const statusEl = document.getElementById("status");
  const sideLabel = document.getElementById("sideLabel");
  const smallerBtn = document.getElementById("smallerBtn");
  const biggerBtn = document.getElementById("biggerBtn");
  const gridBox = document.getElementById("gridBox");
  const fiveBox = document.getElementById("fiveBox");
  const resetBtn = document.getElementById("resetBtn");

  const N = C.GRID;
  let side = C.SIDE_DEFAULT;
  let pegs = [];
  let opening = [];
  let picked = -1;
  let moves = 0;
  let loose = false; // the fifth peg is waiting to be placed

  /* ------------------------------------------------------------- the paper */

  // One unit of the grid, in the SVG's own coordinates, with room for a peg.
  const PAD = 0.6;
  svg.setAttribute("viewBox", `${-PAD} ${-PAD} ${N + 2 * PAD} ${N + 2 * PAD}`);

  const el = (name, attrs) => {
    const node = document.createElementNS(NS, name);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    return node;
  };

  /** Percentage position of a grid point inside the square field. */
  const at = (p) => ({
    left: `${((p.x + PAD) / (N + 2 * PAD)) * 100}%`,
    top: `${((p.y + PAD) / (N + 2 * PAD)) * 100}%`,
  });

  function drawPaper() {
    svg.textContent = "";
    if (gridBox.checked) {
      const g = el("g", { class: "grid" });
      for (let i = 0; i <= N; i++) {
        g.appendChild(el("line", { x1: i, y1: 0, x2: i, y2: N }));
        g.appendChild(el("line", { x1: 0, y1: i, x2: N, y2: i }));
      }
      svg.appendChild(g);
    }
    // The square the pegs started in, to measure the current shape against.
    svg.appendChild(
      el("polygon", {
        class: "opening",
        points: opening.map((p) => `${p.x},${p.y}`).join(" "),
      })
    );
    // The quadrilateral the four original pegs make now.
    const quad = C.convexOrder(pegs.slice(0, 4));
    svg.appendChild(
      el("polygon", { class: "shape", points: quad.map((p) => `${p.x},${p.y}`).join(" ") })
    );
    if (picked >= 0) {
      for (const t of C.legalMoves(pegs, picked)) {
        svg.appendChild(
          el("line", { class: "hop", x1: pegs[picked].x, y1: pegs[picked].y, x2: t.x, y2: t.y })
        );
      }
    }
  }

  /* ---------------------------------------------------------------- render */

  function render() {
    drawPaper();
    for (const b of field.querySelectorAll("button")) b.remove();

    pegs.forEach((p, i) => {
      if (loose && i === 4) return; // not placed yet
      const b = document.createElement("button");
      b.type = "button";
      b.className = `peg${i === picked ? " picked" : ""}${i === 4 ? " extra" : ""}`;
      Object.assign(b.style, at(p));
      b.setAttribute(
        "aria-label",
        `Peg ${i + 1} at column ${p.x}, row ${p.y}${i === picked ? ", picked up" : ""}`
      );
      b.addEventListener("click", () => pick(i));
      field.appendChild(b);
    });

    const targets = loose ? freePoints() : picked >= 0 ? C.legalMoves(pegs, picked) : [];
    for (const t of targets) {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "target";
      Object.assign(b.style, at(t));
      b.setAttribute("aria-label", `Land on column ${t.x}, row ${t.y}`);
      b.addEventListener("click", () => land(t));
      field.appendChild(b);
    }

    statusEl.textContent = report();
    statusEl.classList.toggle("win", won());
    sideLabel.textContent = String(side);
    smallerBtn.disabled = side <= C.SIDE_MIN;
    biggerBtn.disabled = side >= C.SIDE_MAX;
  }

  /** Every free grid point, for dropping the fifth peg the first time. */
  function freePoints() {
    const out = [];
    for (let y = 0; y <= N; y++) {
      for (let x = 0; x <= N; x++) {
        if (!pegs.some((p, i) => i !== 4 && p.x === x && p.y === y)) out.push({ x, y });
      }
    }
    return out;
  }

  /**
   * What the four original pegs are making now, and the grid the whole set
   * still generates. The fifth peg is a helper: the question stays whether the
   * original four can be worked into a bigger square.
   */
  function report() {
    if (loose) return "Put the fifth peg anywhere you like, then it hops like the others.";
    const four = pegs.slice(0, 4);
    const sq = C.squareOf(four);
    const lat = C.latticeBasis(pegs);
    const step = lat.a === lat.b && !lat.c ? `${lat.a}` : `${lat.a} by ${lat.b}`;
    const grid = `The pegs reach a grid of step ${step}.`;
    if (!sq) return `Moves: ${moves}. Not a square \u2014 area ${C.area(four)}. ${grid}`;
    const tilt = sq.axisAligned ? "" : " tilted";
    if (sq.side2 > side * side) {
      return `Moves: ${moves}. A${tilt} square of side \u221a${sq.side2} \u2014 bigger than the one you started in. You did it!`;
    }
    if (sq.side2 < side * side) {
      return `Moves: ${moves}. A${tilt} square of side \u221a${sq.side2} \u2014 smaller than the original. ${grid}`;
    }
    return `Moves: ${moves}. A${tilt} square, the same size as the one you started in. ${grid}`;
  }

  /** Have the four original pegs beaten the square they started in? */
  function won() {
    if (loose) return false;
    const sq = C.squareOf(pegs.slice(0, 4));
    return !!sq && sq.side2 > side * side;
  }

  /* ------------------------------------------------------------------ play */

  function pick(i) {
    if (loose) return;
    picked = picked === i ? -1 : i;
    render();
  }

  function land(t) {
    if (loose) {
      pegs[4] = { x: t.x, y: t.y };
      loose = false;
      render();
      return;
    }
    const next = C.move(pegs, picked, t);
    if (!next) return;
    pegs = next;
    picked = -1;
    moves++;
    render();
  }

  /* -------------------------------------------------------------- controls */

  function reset() {
    pegs = C.start(side);
    opening = C.start(side);
    if (fiveBox.checked) {
      pegs.push({ x: 0, y: 0 });
      loose = true;
    } else {
      loose = false;
    }
    picked = -1;
    moves = 0;
    render();
  }

  function resize(delta) {
    const next = Math.min(C.SIDE_MAX, Math.max(C.SIDE_MIN, side + delta));
    if (next === side) return;
    side = next;
    reset();
  }

  resetBtn.addEventListener("click", reset);
  smallerBtn.addEventListener("click", () => resize(-1));
  biggerBtn.addEventListener("click", () => resize(+1));
  fiveBox.addEventListener("change", reset);
  gridBox.addEventListener("change", render);

  reset();
})();
