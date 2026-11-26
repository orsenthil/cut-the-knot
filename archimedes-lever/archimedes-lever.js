"use strict";

/*
 * The page for Archimedes Lever: drawing and input only. The balance rules
 * live in archimedes-lever-core.js. The stage has a top row with the two
 * original weights, a middle line with their evenly spaced unit weights, and
 * a lower row with the same weights again; the red fulcrum sits on the common
 * centre of gravity of both rows. The three dots can be dragged or moved with
 * the arrow keys. There is no win and no loss.
 */

(function () {
  const Core = ArchimedesLeverCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const pOut = document.getElementById("pOut");
  const qOut = document.getElementById("qOut");
  const gcdBox = document.getElementById("gcdBox");
  const snapBtn = document.getElementById("snapBtn");
  const newBtn = document.getElementById("newBtn");

  const W = board.viewBox.width;
  const Y_TOP = 62;
  const Y_MID = 132;
  const Y_LOW = 214;
  const MAX_UNITS = Core.MAX_WEIGHT * 2;      // 50 unit circles at most

  let state = Core.start({ width: W });

  /** The line under the game. An illustration has no win or loss to report. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* Layers in paint order: guides, beams, unit weights, triangles, text, dots. */
  const guides = board.layer("guides");
  const beams = board.layer("beams");
  const unitsLayer = board.layer("units");
  const marks = board.layer("marks");
  const texts = board.layer("texts");
  const dots = board.layer("dots");

  const topBeam = board.segment({ x: 0, y: Y_TOP }, { x: W, y: Y_TOP }, "beam", beams);
  const midBeam = board.segment({ x: 0, y: Y_MID }, { x: W, y: Y_MID }, "guide-line", guides);
  const lowBeam = board.segment({ x: 0, y: Y_LOW }, { x: W, y: Y_LOW }, "beam beam-low", beams);
  const segmentP = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "distance", guides);
  const segmentQ = board.segment({ x: 0, y: 0 }, { x: 1, y: 0 }, "distance", guides);
  const distP = board.label({ x: 0, y: 0 }, "", "measure-label", 0, -5, texts);
  const distQ = board.label({ x: 0, y: 0 }, "", "measure-label", 0, -5, texts);

  /* A fixed pool of circles and ticks: redrawing never steals a handle's focus. */
  const unitNodes = [];
  const tickNodes = [];
  for (let i = 0; i < MAX_UNITS; i++) {
    unitNodes.push(board.circle({ x: -20, y: -20 }, 5, "unit", unitsLayer));
    tickNodes.push(board.segment({ x: -20, y: -20 }, { x: -20, y: -20 }, "tick", guides));
  }
  const lowP = board.circle({ x: -20, y: -20 }, 6, "low-weight low-p", marks);
  const lowQ = board.circle({ x: -20, y: -20 }, 6, "low-weight low-q", marks);
  const triTop = board.polygon([{ x: 0, y: 0 }], "fulcrum", marks);
  const triMid = board.polygon([{ x: 0, y: 0 }], "fulcrum", marks);
  const triLow = board.polygon([{ x: 0, y: 0 }], "fulcrum", marks);
  const numberP = board.label({ x: -20, y: -20 }, "", "weight-number", 0, 5, texts);
  const numberQ = board.label({ x: -20, y: -20 }, "", "weight-number", 0, 5, texts);
  const cap = board.label({ x: W / 2, y: 190 }, "", "caption", 0, 0, texts);

  const clampAlong = (q, rowY) => ({ x: q.x, y: rowY });
  const pHandle = board.handle("P", { x: 80, y: Y_TOP - 16 }, {
    r: 16, step: 4, cls: "geom-handle p-handle", layer: dots,
    label: "Left weight. Drag it, or focus it and use the arrow keys, to move it along the beam.",
    describe: (p) => `at ${Math.round(p.x)} across`,
    clamp: (q) => clampAlong(q, Y_TOP - 16),
    onMove: (p) => { state = Core.moveHandle(state, "P", p); render(); },
  });
  const qHandle = board.handle("Q", { x: 290, y: Y_TOP - 18 }, {
    r: 18, step: 4, cls: "geom-handle q-handle", layer: dots,
    label: "Right weight. Drag it, or focus it and use the arrow keys, to move it along the beam.",
    describe: (p) => `at ${Math.round(p.x)} across`,
    clamp: (q) => clampAlong(q, Y_TOP - 18),
    onMove: (p) => { state = Core.moveHandle(state, "Q", p); render(); },
  });
  const fHandle = board.handle("F", { x: 200, y: 170 }, {
    r: 9, step: 4, cls: "geom-handle f-handle", layer: dots,
    label: "Red fulcrum. Drag it, or focus it and use the arrow keys, to see which side tips down.",
    describe: (p) => `at ${Math.round(p.x)} across`,
    clamp: (q) => clampAlong(q, 170),
    onMove: (p) => { state = Core.moveHandle(state, "F", p); render(); },
  });

  const triangle = (x, y, size) => [
    { x: x, y: y }, { x: x - size, y: y + 2 * size }, { x: x + size, y: y + 2 * size },
  ];

  function render() {
    const m = Core.measure(state);
    const rP = Math.min(24, Math.max(11, m.rP * 0.9));
    const rQ = Math.min(24, Math.max(11, m.rQ * 0.9));
    const rU = 6;
    const yP = Y_TOP - rP, yQ = Y_TOP - rQ;

    const x0 = m.margin, x1 = W - m.margin;
    topBeam.set({ x: x0, y: Y_TOP }, { x: x1, y: Y_TOP });
    midBeam.set({ x: x0, y: Y_MID }, { x: x1, y: Y_MID });
    lowBeam.set({ x: x0, y: Y_LOW }, { x: x1, y: Y_LOW });

    unitNodes.forEach((node, i) => {
      if (i >= m.total) { node.show(false); return; }
      node.show(true);
      node.node.setAttribute("class", i < m.np ? "unit unit-p" : "unit unit-q");
      node.set({ x: m.units[i], y: Y_MID - rU }, rU);
    });
    tickNodes.forEach((node, i) => {
      if (i >= m.total) { node.show(false); return; }
      node.show(true);
      const long = i === 0 || i === m.total - 1;
      node.set({ x: m.units[i], y: Y_MID + 8 }, { x: m.units[i], y: Y_MID + (long ? 18 : 13) });
    });

    lowP.set({ x: m.xP, y: Y_LOW - 7 }, 7);
    lowQ.set({ x: m.xQ, y: Y_LOW - 7 }, 7);
    triTop.set(triangle(m.xF, Y_TOP + 3, 8));
    triMid.set(triangle(m.xF, Y_MID + 19, 8));
    triLow.set(triangle(m.xF, Y_LOW + 3, 8));

    pHandle.set({ x: m.xP, y: yP });
    qHandle.set({ x: m.xQ, y: yQ });
    fHandle.set({ x: m.xF, y: 170 });
    pHandle.node.setAttribute("r", String(rP));
    qHandle.node.setAttribute("r", String(rQ));
    numberP.set({ x: m.xP, y: yP }, String(state.NP));
    numberQ.set({ x: m.xQ, y: yQ }, String(state.NQ));

    segmentP.set({ x: m.xP, y: 196 }, { x: m.xF, y: 196 });
    segmentQ.set({ x: m.xF, y: 196 }, { x: m.xQ, y: 196 });
    distP.set({ x: (m.xP + m.xF) / 2, y: 196 },
      `dP = ${Math.max(0, m.xF - m.xP).toFixed(0)}`);
    distQ.set({ x: (m.xF + m.xQ) / 2, y: 196 },
      `dQ = ${Math.max(0, m.xQ - m.xF).toFixed(0)}`);
    cap.set({ x: W / 2, y: 242 },
      m.balanced ? "The row balances on the middle unit." : "Move the fulcrum onto the middle tick.");

    pOut.textContent = String(state.NP);
    qOut.textContent = String(state.NQ);
    gcdBox.checked = state.useGCD;
    gcdBox.disabled = !m.gcdAvailable;
    snapBtn.disabled = m.balanced;

    say(Core.label(state));

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function changeWeights(dP, dQ) {
    state = Core.setWeights(state, state.NP + dP, state.NQ + dQ, state.useGCD);
    render();
  }

  document.getElementById("minusP").addEventListener("click", () => changeWeights(-1, 0));
  document.getElementById("plusP").addEventListener("click", () => changeWeights(1, 0));
  document.getElementById("minusQ").addEventListener("click", () => changeWeights(0, -1));
  document.getElementById("plusQ").addEventListener("click", () => changeWeights(0, 1));
  gcdBox.addEventListener("change", () => {
    if (gcdBox.checked !== state.useGCD) state = Core.toggleGCD(state);
    render();
  });
  snapBtn.addEventListener("click", () => { state = Core.snapFulcrum(state); render(); });
  newBtn.addEventListener("click", () => { state = Core.reset(state); render(); });

  board.onTheme(render);
  render();
})();
