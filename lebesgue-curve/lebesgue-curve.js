"use strict";

/*
 * The page for the Lebesgue curve: drawing and input only; the geometry is in
 * lebesgue-curve-core.js. An SVG viewBox holds a square grid, a highlight on
 * the subsquare under the keyboard cursor, and a blue chain joining the cell
 * centres in the order top-down, left-right.
 *
 * There is no win or loss: this is a demonstration. Pressing the board or the
 * Next order button runs the applet's Reset(); the mode buttons only change
 * the label, just as the applet's checkboxes do nothing to its drawing.
 */

(function () {
  const C = LebesgueCurveCore;
  const board = Geom.board(document.getElementById("board"));
  const svg = board.root;
  const statusEl = document.getElementById("status");
  const nextBtn = document.getElementById("nextBtn");
  const modeBtns = Array.from(document.querySelectorAll('input[name="mode"]'));
  const boardBtn = document.getElementById("boardBtn");

  const grid = board.layer("grid");
  const curveLayer = board.layer("curve");
  const marks = board.layer("marks");
  const handlesLayer = board.layer("handles");

  const PAD = 10;
  const BOX = 300;
  let state = C.start({});
  let mode = "lebesgue";
  let hint = null;

  /* Objects are created once and updated through .set(...) / .show(...). */
  /* board.el returns a raw node; give it the same .show() API as a shape. */
  const asShape = (node) => ({
    node: node,
    show: (on) => { node.style.display = on ? "" : "none"; },
  });

  board.el("rect", {
    x: PAD, y: PAD, width: BOX, height: BOX, rx: 4,
  }, "frame", grid);
  const guideNodes = [];
  for (let i = 0; i <= 16; i++) {
    guideNodes.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "mesh", grid));
    guideNodes.push(board.segment({ x: 0, y: 0 }, { x: 0, y: 0 }, "mesh", grid));
  }
  const pathNode = board.el("polyline", null, "curve", curveLayer);
  function setPath(pts) {
    pathNode.setAttribute("points", pts.map((p) => `${p.x},${p.y}`).join(" "));
  }

  const highlight = asShape(board.el("rect", { rx: 2 }, "cursor-cell", marks));
  highlight.show(false);
  const startDot = board.point({ x: PAD, y: PAD }, "end-dot", 4, marks);
  const endDot = board.point({ x: PAD, y: PAD }, "end-dot end", 4, marks);

  /**
   * Shows the status line. `kind` is "done" at the finest order (a whole
   * cycle of the applet's Reset); nothing while exploring. The shared record
   * reads the class, so it is never used for an ordinary progress message.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function toScreen(p, step, x0, y0, cells) {
    const span = step * cells;
    return { x: PAD + (p.x - x0) * BOX / span,
             y: PAD + (p.y - y0) * BOX / span };
  }

  /* One focusable cursor, kept across redraws so keyboard focus survives. */
  const cursor = board.handle("cursor", { x: PAD + BOX / 2, y: PAD + BOX / 2 }, {
    r: 8, step: 1, cls: "cursor-handle", layer: handlesLayer,
    label: "Cursor on the grid. Use the arrow keys to move between subsquares, or press Enter to advance the order.",
    describe: (p) => `at column ${Math.floor((p.x - PAD) / (BOX / C.describe(state).cellsPerSide)) + 1}, row ${Math.floor((p.y - PAD) / (BOX / C.describe(state).cellsPerSide)) + 1}`,
    onMove: (p) => {
      const cells = C.describe(state).cellsPerSide;
      hint = {
        x: Math.max(0, Math.min(cells - 1, Math.floor((p.x - PAD) / (BOX / cells)))),
        y: Math.max(0, Math.min(cells - 1, Math.floor((p.y - PAD) / (BOX / cells)))),
      };
      render();
    },
  });

  function render() {
    const d = C.describe(state);
    const cells = d.cellsPerSide;
    const cell = BOX / cells;
    const g = C.geometry(state.canvas);
    const raw = C.points(state);
    const pts = raw.map((p) => toScreen(p, state.step, g.x0, g.y0, cells));

    for (let i = 0; i < guideNodes.length; i++) {
      const show = Math.floor(i / 2) <= cells;
      guideNodes[i].show(show);
      if (!show) continue;
      const v = PAD + Math.floor(i / 2) * cell;
      if (i % 2 === 0) guideNodes[i].set({ x: v, y: PAD }, { x: v, y: PAD + BOX });
      else guideNodes[i].set({ x: PAD, y: v }, { x: PAD + BOX, y: v });
    }
    setPath(pts);
    /* At the finest orders the segments are closer than a pixel; a hairline
       keeps the weave visible instead of flooding the board with colour. */
    pathNode.setAttribute("class", cells > 64 ? "curve fine" : "curve");
    startDot.set(pts[0]);
    endDot.set(pts[pts.length - 1]);

    if (hint) {
      const hx = Math.max(0, Math.min(cells - 1, Math.trunc(hint.x)));
      const hy = Math.max(0, Math.min(cells - 1, Math.trunc(hint.y)));
      highlight.node.setAttribute("x", PAD + hx * cell);
      highlight.node.setAttribute("y", PAD + hy * cell);
      highlight.node.setAttribute("width", cell);
      highlight.node.setAttribute("height", cell);
      highlight.show(true);
      cursor.set({ x: PAD + (hx + 0.5) * cell, y: PAD + (hy + 0.5) * cell });
      cursor.node.setAttribute("aria-label",
        "Cursor on the grid. Use the arrow keys to move between subsquares, or press Enter to advance the order. " +
        `At column ${hx + 1}, row ${hy + 1} of ${cells}.`);
      cursor.show(true);
    } else {
      highlight.show(false);
      cursor.show(false);
    }

    const modeText = mode === "lebesgue" ? "Lebesgue" : "Moore";
    say(`${modeText} curve, order ${d.order}: a ${cells} by ${cells} grid, ` +
        `${d.cells} centres joined in ${d.segments} steps. ` +
        (hint ? `Cursor at column ${Math.trunc(hint.x) + 1}, row ${Math.trunc(hint.y) + 1}. ` : "") +
        `Press Next order or click the board to refine.`,
        d.order === d.maxOrder ? "done" : null);

    nextBtn.textContent = d.order === d.maxOrder ? "Start again" : "Next order";
    nextBtn.setAttribute("aria-label", d.order === d.maxOrder
      ? "Start again at order 1" : `Advance to order ${d.order + 1}`);
    modeBtns.forEach((b) => { b.checked = b.value === mode; });
    boardBtn.setAttribute("aria-label", "Advance the Lebesgue curve to the next order");

    /* The position, for the player's record and the tutor. */
    if (window.Track) window.Track.state({
      order: d.order, mode: mode, cellsPerSide: cells, hint: hint, points: pts.length,
    });
  }

  function refine() {
    state = C.next(state);
    hint = null;
    render();
  }

  nextBtn.addEventListener("click", refine);
  boardBtn.addEventListener("click", refine);
  modeBtns.forEach((b) => b.addEventListener("change", () => {
    if (b.checked) { mode = b.value; render(); }
  }));

  /* Clicking or tapping the board advances the curve, as the applet did. */
  svg.addEventListener("pointerdown", (e) => {
    if (e.target.closest("circle[tabindex]")) return; // the cursor handle
    refine();
  });

  /* Keyboard: arrows move the cursor through the cells, Enter advances. */
  document.addEventListener("keydown", (e) => {
    const target = e.target;
    if (target && (target.tagName === "BUTTON" || target.tagName === "INPUT")) return;
    const cells = C.describe(state).cellsPerSide;
    const dx = e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0;
    const dy = e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0;
    if (dx || dy) {
      e.preventDefault();
      const h = hint || { x: 0, y: 0 };
      hint = {
        x: Math.max(0, Math.min(cells - 1, h.x + dx)),
        y: Math.max(0, Math.min(cells - 1, h.y + dy)),
      };
      render();
      cursor.show(true);
      cursor.node.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      refine();
    }
  });

  board.onTheme(render);
  render();
})();
