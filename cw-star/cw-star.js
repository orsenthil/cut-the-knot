"use strict";

/*
 * The page for CWStar: drawing and input only. cw-star-core.js holds the
 * construction. The stage holds one SVG: the star polygon, the arcs that
 * bound the constant-width curve, optional wider arcs and their small gap
 * arcs, and a handle for every star vertex. Handles arrow-key and drag
 * through Geom; the position goes back to the record on every redraw.
 */

(() => {
  const Core = CwStarCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const controls = {
    steps: document.getElementById("stepsInput"),
    length: document.getElementById("lengthInput"),
    addOn: document.getElementById("addOnInput"),
    speed: document.getElementById("speedInput"),
  };
  const readouts = {
    steps: document.getElementById("stepsValue"),
    length: document.getElementById("lengthValue"),
    addOn: document.getElementById("addOnValue"),
    speed: document.getElementById("speedValue"),
  };
  const resetBtn = document.getElementById("newBtn");
  const startBtn = document.getElementById("startBtn");
  const stepBtn = document.getElementById("stepBtn");

  let state = Core.start({});
  let rolling = null;
  let timer = null;

  /** The line below the picture. This is a demo, so there is no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const shapes = board.layer("shapes");
  const gaps = board.layer("gaps");
  const extensions = board.layer("extensions");
  const outline = board.layer("outline");
  const tops = board.layer("handles");

  const star = board.polygon(state.points, "star-polygon", outline);
  const maxN = Core.stepsToN(Core.LIMITS.steps.max);

  /* board.el gives a raw node; wrap it with the same show/set API as a shape. */
  const raw = (node) => ({
    node,
    show(on) { node.style.display = on ? "" : "none"; },
    attr(name, value) { node.setAttribute(name, value); },
  });

  /* Build the elements once, then only change them: keyboard focus survives. */
  const drawings = Array.from({ length: maxN }, () => ({
    base: raw(board.el("path", null, "arc-base", shapes)),
    outer: raw(board.el("path", null, "arc-outer", shapes)),
    gap: raw(board.el("path", null, "arc-gap", gaps)),
    before: raw(board.el("line", null, "extension", extensions)),
    after: raw(board.el("line", null, "extension", extensions)),
  }));

  const handles = Array.from({ length: maxN }, (_, i) => board.handle("V" + (i + 1), { x: -20, y: -20 }, {
    r: 6, step: 2, shift: 10, layer: tops,
    label: `Point ${i + 1} of the star. Drag it, or focus it and use the arrow keys to move it`,
    describe: (p) => `at ${Math.round(p.x)} across, ${Math.round(p.y)} down`,
    onMove: (p, name) => {
      const index = Number(name.slice(1)) - 1;
      state = Core.movePoint(state, index, p);
      if (rolling) rolling = { ...rolling, points: state.points };
      render();
    },
  }));

  /** Java drawArc angles run anticlockwise on screen; SVG's sweep flag is reversed. */
  function arcPath(arc, radius, start) {
    const from = Core.arcPoint(arc, radius, start);
    const to = Core.arcPoint(arc, radius, start + arc.sweep);
    const large = Math.abs(arc.sweep) > 180 ? 1 : 0;
    const sweep = arc.sweep < 0 ? 1 : 0;
    return `M ${from.x.toFixed(2)} ${from.y.toFixed(2)} A ${radius.toFixed(2)} ${radius.toFixed(2)} 0 ${large} ${sweep} ${to.x.toFixed(2)} ${to.y.toFixed(2)}`;
  }

  function render() {
    const arcs = Core.arcs(state);
    const n = state.points.length;
    star.set(state.points);
    for (let i = 0; i < maxN; i++) {
      const d = drawings[i];
      const on = i < n;
      d.base.show(on);
      d.outer.show(on && state.addOn > 0);
      d.gap.show(on && state.addOn > 0);
      d.before.show(on && state.addOn > 0);
      d.after.show(on && state.addOn > 0);
      handles[i].show(on);
      if (!on) continue;
      const arc = arcs[i];
      handles[i].set(state.points[i]);
      d.base.attr("d", arcPath(arc, arc.radius, arc.start));
      if (state.addOn > 0) {
        d.outer.attr("d", arcPath(arc, arc.outerRadius, arc.start));
        d.gap.attr("d", arcPath(arc, arc.gapRadius, arc.gapStart));
        d.before.attr("x1", arc.centre.x);
        d.before.attr("y1", arc.centre.y);
        d.before.attr("x2", arc.extensionPrev.x);
        d.before.attr("y2", arc.extensionPrev.y);
        d.after.attr("x1", arc.centre.x);
        d.after.attr("y1", arc.centre.y);
        d.after.attr("x2", arc.extensionNext.x);
        d.after.attr("y2", arc.extensionNext.y);
      }
    }

    for (const key in controls) {
      controls[key].value = String(state[key]);
      readouts[key].textContent = key === "steps"
        ? `${Core.stepsToN(state.steps)} points`
        : String(state[key]);
    }
    startBtn.textContent = timer ? "Stop rolling" : "Start rolling";
    startBtn.setAttribute("aria-pressed", timer ? "true" : "false");
    say(Core.describe(state));

    // The position, in board units, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        steps: state.steps, length: state.length,
        addOn: state.addOn, speed: state.speed,
        points: state.points.map((p) => ({ x: p.x, y: p.y })),
      });
    }
  }

  function stopRolling() {
    if (timer) clearInterval(timer);
    timer = null;
    rolling = null;
  }

  function toggleRolling() {
    if (timer) {
      stopRolling();
    } else {
      rolling = Core.startRoll(state);
      timer = setInterval(() => {
        rolling = Core.rollStep(rolling);
        state = { ...rolling };
        render();
      }, 50);
    }
    render();
  }

  for (const key in controls) {
    controls[key].addEventListener("input", () => {
      const value = Number(controls[key].value);
      state = Core.setOption(state, key, value);
      if (rolling) rolling = Core.setOption(rolling, key, value);
      render();
    });
  }

  resetBtn.addEventListener("click", () => {
    stopRolling();
    state = Core.start({
      steps: state.steps, length: state.length, addOn: state.addOn, speed: state.speed,
    });
    render();
  });
  startBtn.addEventListener("click", toggleRolling);
  stepBtn.addEventListener("click", () => {
    state = Core.rollStep(state);
    rolling = state;
    render();
  });

  board.onTheme(render);
  render();
})();
