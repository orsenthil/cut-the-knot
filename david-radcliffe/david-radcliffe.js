"use strict";

/*
 * The page for David Radcliffe: drawing and input only. All the geometry is in
 * david-radcliffe-core.js. The SVG holds the outer regular polygon (thick),
 * the inward equilateral triangles (shaded, with dashed sides) and the
 * polygon made by their third vertices (thin green). The applet had one
 * spinner for N; here it is a labelled number box with two buttons, and one
 * draggable dot turns the whole picture without changing any of its lengths.
 * Nothing can be won or lost; the Check button records that the claim was
 * explored, which is how a demo counts as finished for the player's record.
 */

(function () {
  const Core = DavidRadcliffeCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const resetBtn = document.getElementById("resetBtn");
  const checkBtn = document.getElementById("checkBtn");

  const MAX_N = Core.RANGES.N[1];
  let state = Core.start({});
  let checked = false;

  /* Layers are created in paint order; every element is made once. */
  const trianglesLayer = board.layer("triangles");
  const spokesLayer = board.layer("spokes");
  const innerLayer = board.layer("inner");
  const outerLayer = board.layer("outer");
  const dotsLayer = board.layer("dots");
  const handlesLayer = board.layer("handles");

  const triangles = [];
  const spokes = [];
  const outerDots = [];
  const innerDots = [];
  for (let i = 0; i < MAX_N; i++) {
    triangles.push(board.polygon([state.V[0], state.V[0], state.U[0]], "inward-tri", trianglesLayer));
    spokes.push(board.segment(state.V[0], state.U[0], "spoke", spokesLayer));
    spokes.push(board.segment(state.V[0], state.U[0], "spoke", spokesLayer));
    outerDots.push(board.point(state.V[0], "outer-dot", 4, dotsLayer));
    innerDots.push(board.point(state.U[0], "inner-dot", 3.5, dotsLayer));
  }
  const innerPoly = board.polygon(state.U, "inner-poly", innerLayer);
  const outerPoly = board.polygon(state.V, "outer-poly", outerLayer);

  /** Keep the turning dot on the circle of the outer polygon. */
  function onCircle(q) {
    const dx = q.x - state.center.x, dy = q.y - state.center.y;
    const length = Math.hypot(dx, dy) || 1;
    return {
      x: state.center.x + (dx / length) * state.radius,
      y: state.center.y + (dy / length) * state.radius,
    };
  }

  const turn = board.handle("turn", state.V[0], {
    r: 10, step: 7, shift: 28, layer: handlesLayer, clamp: onCircle,
    label: "Turning dot. Drag, or focus it and use the arrow keys to turn the polygon",
    describe: (p) => `on the circle at ${Math.round(p.x)}, ${Math.round(p.y)}`,
    onMove: (p) => {
      const angle = Math.atan2(p.y - state.center.y, p.x - state.center.x);
      state = Core.withAngle(state, angle);
      render();
    },
  });

  /**
   * Shows a line under the picture. "done" is used when the claim has been
   * checked: this is a demo, so there is no win or loss. The shared record
   * reads the class on #status to see that the play has finished.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function describe(cl) {
    const n = cl.N;
    const size = cl.collapses
      ? `all ${n} tips meet at the centre`
      : cl.sameSize
        ? "a triangle the same size, turned halfway round"
        : `a ${n}-sided shape about ${cl.ratio.toFixed(2)} times as wide`;
    const plain = `${n} sides: the green triangle tips make ${size}. ` +
      "Drag the purple dot to turn the picture.";
    if (!checked) return plain;
    const verdict = cl.smaller
      ? "Because every tip is a grid point, a grid polygon would make a smaller one, then a smaller one, and so on – so it cannot exist."
      : cl.collapses
        ? "The tips collapse to the centre, so this one case gives no smaller copy."
        : "Here the new shape is not smaller, so this case gives no smaller copy.";
    return `${plain} Checked: ${verdict}`;
  }

  function render() {
    const n = state.N;
    for (let i = 0; i < MAX_N; i++) {
      const on = i < n;
      const j = (i + 1) % n;
      triangles[i].show(on);
      spokes[2 * i].show(on);
      spokes[2 * i + 1].show(on);
      outerDots[i].show(on);
      innerDots[i].show(on);
      if (!on) continue;
      triangles[i].set([state.V[i], state.V[j], state.U[i]]);
      spokes[2 * i].set(state.V[i], state.U[i]);
      spokes[2 * i + 1].set(state.V[j], state.U[i]);
      outerDots[i].set(state.V[i]);
      innerDots[i].set(state.U[i]);
    }
    outerPoly.set(state.V);
    innerPoly.set(state.U);
    turn.set(state.V[0]);

    const cl = Core.claims(n);
    say(describe(cl), checked ? "done" : "");
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function changeN(value) {
    const n = Core.clampOption("N", value);
    nInput.value = String(n);
    checked = false;
    state = Core.withN(state, n);
    render();
  }

  function reset() {
    checked = false;
    state = Core.start({ width: state.width, height: state.height });
    nInput.value = String(state.N);
    render();
    turn.node.focus();
  }

  lessBtn.addEventListener("click", () => changeN(state.N - 1));
  moreBtn.addEventListener("click", () => changeN(state.N + 1));
  nInput.addEventListener("change", () => changeN(nInput.value));
  resetBtn.addEventListener("click", reset);
  checkBtn.addEventListener("click", () => {
    checked = true;
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === "[") changeN(state.N - 1);
    if (e.key === "]") changeN(state.N + 1);
    if (e.key === "r" || e.key === "R") reset();
    if (e.key === "c" || e.key === "C") {
      checked = true;
      render();
    }
  });

  board.onTheme(render);
  render();
})();
