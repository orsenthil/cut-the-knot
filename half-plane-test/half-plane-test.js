"use strict";

/*
 * The page for Half Plane Test: drawing and input only; the half-plane geometry
 * is in half-plane-test-core.js. The SVG board holds the clipped overlap, one
 * line per half plane, a fat invisible strip for dragging a line, and two
 * focusable handles for the selected line's ends. Dragging near an end swings
 * the line around its other end; dragging in the middle slides it.
 */

(function () {
  const Core = HalfPlaneTestCore;
  const statusEl = document.getElementById("status");
  const showBox = document.getElementById("showBox");
  const countIn = document.getElementById("countIn");
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");
  const modeBtn = document.getElementById("modeBtn");
  const newBtn = document.getElementById("newBtn");
  const board = Geom.board(document.getElementById("board"));

  const regionLayer = board.layer("region");
  const linesLayer = board.layer("lines");
  const hitsLayer = board.layer("hits");
  const handlesLayer = board.layer("handles");
  const labelsLayer = board.layer("labels");
  const zero = { x: 0, y: 0 };

  const region = board.polygon([], "overlap-region", regionLayer);
  const lines = Array.from({ length: Core.MAX_LINES }, () => board.line(zero, zero, "half-line", linesLayer));
  const hits = Array.from({ length: Core.MAX_LINES }, () => board.segment(zero, zero, "hit-line", hitsLayer));

  let state = Core.start({ n: Number(countIn.value) });
  let drag = null;

  /** The shared #status line: "done" tells the record the demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function apply(m) {
    const next = Core.move(state, m);
    if (next === state) return;
    state = next;
    render();
  }

  const handles = {};
  for (const [name, which] of [["start", "p1"], ["end", "p2"]]) {
    handles[name] = board.handle(name, zero, {
      r: 8, step: 5, shift: 10,
      label: "Line " + which + " handle. Drag it to swing the line around its other end, " +
        "or focus it and use the arrow keys to move it.",
      clamp: (p) => Core.clampPoint(p),
      layer: handlesLayer,
      onMove: (p) => {
        const line = state.lines[state.selected];
        if (!line) return;
        if (state.slide) {
          const here = line[which];
          apply({ type: "translate", dx: p.x - here.x, dy: p.y - here.y });
        } else {
          apply({ type: "end", which: which, point: p });
        }
      },
    });
  }
  const labels = [board.label(zero, "", "handle-label", 10, -9, labelsLayer),
    board.label(zero, "", "handle-label", 10, -9, labelsLayer)];

  function describe(poly) {
    if (poly.length === 0) return "The shared part is empty.";
    const a = Core.area(poly);
    if (a < 1) return "The shared part has shrunk to a line or a point.";
    return "The shared part is a convex polygon with " + poly.length +
      " corners and area " + Math.round(a) + ".";
  }

  function render() {
    const poly = Core.intersection(state.lines);
    region.set(poly);
    region.show(state.showIntersection && poly.length >= 3);

    for (let i = 0; i < Core.MAX_LINES; i++) {
      const line = state.lines[i];
      const on = i < state.n && !!line;
      lines[i].show(on);
      hits[i].show(on);
      if (!on) continue;
      lines[i].set(line.p1, line.p2);
      lines[i].node.setAttribute("class", i === state.selected ? "half-line selected" : "half-line");
      hits[i].set(line.p1, line.p2);
    }

    const chosen = state.lines[state.selected];
    if (chosen) {
      const a = Core.clampPoint(chosen.p1);
      const b = Core.clampPoint(chosen.p2);
      handles.start.set(a);
      handles.end.set(b);
      labels[0].set(a, "1");
      labels[1].set(b, "2");
      handles.start.node.setAttribute("aria-label",
        "Line " + (state.selected + 1) + " end 1. Drag it to swing the line around end 2, or use the arrow keys.");
      handles.end.node.setAttribute("aria-label",
        "Line " + (state.selected + 1) + " end 2. Drag it to swing the line around end 1, or use the arrow keys.");
    }

    if (document.activeElement !== countIn) countIn.value = String(state.n);
    showBox.checked = state.showIntersection;
    modeBtn.textContent = state.slide ? "Arrows: slide" : "Arrows: swing";
    modeBtn.setAttribute("aria-pressed", String(state.slide));
    modeBtn.setAttribute("aria-label", state.slide
      ? "Arrow keys slide the selected line. Press to switch to swinging an end."
      : "Arrow keys swing an end of the selected line. Press to switch to sliding the line.");

    say(describe(poly) + " Line " + (state.selected + 1) + " of " + state.n + " is selected. " +
      (state.slide ? "Arrow keys slide this line." : "Arrow keys swing either end."), Core.result(state));
    if (window.Track) window.Track.state(state);
  }

  /* A pointer on the middle of a line slides it; near an end it swings about
     the opposite end, as the Java applet's Inside() test decides. */
  hits.forEach((hit, i) => {
    hit.node.addEventListener("pointerdown", (e) => {
      const line = state.lines[i];
      if (!line) return;
      const p = board.toLocal(e.clientX, e.clientY);
      const motion = Core.hitMotion(line, p);
      if (!motion) return;
      e.preventDefault();
      drag = { index: i, motion: motion, start: p };
      if (i !== state.selected) state = Core.move(state, { type: "select", value: i });
      if (svg()) svg().setPointerCapture(e.pointerId);
      handles.start.node.focus();
      render();
    });
  });

  function svg() {
    return board.root;
  }

  board.root.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const p = board.toLocal(e.clientX, e.clientY);
    if (drag.motion === "translate") {
      state = Core.move(state, {
        type: "translate", index: drag.index,
        dx: p.x - drag.start.x, dy: p.y - drag.start.y,
      });
    } else {
      state = Core.move(state, {
        type: "end", index: drag.index,
        which: drag.motion === "rotate1" ? "p1" : "p2", point: p,
      });
    }
    render();
  });

  for (const event of ["pointerup", "pointercancel", "lostpointercapture"]) {
    board.root.addEventListener(event, () => { drag = null; });
  }

  showBox.addEventListener("change", () => apply({ type: "show", value: showBox.checked }));
  countIn.addEventListener("change", () => apply({ type: "count", value: Number(countIn.value) }));
  prevBtn.addEventListener("click", () => apply({ type: "select", value: state.selected - 1 }));
  nextBtn.addEventListener("click", () => apply({ type: "select", value: state.selected + 1 }));
  modeBtn.addEventListener("click", () => apply({ type: "slide", value: !state.slide }));
  newBtn.addEventListener("click", () => apply({ type: "new", rng: Math.random }));
  board.onTheme(() => { /* SVG classes follow the site's colour tokens. */ });

  render();
})();
