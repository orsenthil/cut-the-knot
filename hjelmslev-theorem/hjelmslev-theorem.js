"use strict";

/*
 * The page for Hjelmslev Theorem: drawing and input only. The algebra and the
 * drag constraints are in hjelmslev-theorem-core.js.
 *
 * The SVG reproduces the applet's two thick segments, its pale lines joining
 * corresponding points, and its eleven marks on the segment A_r B_r. Unlike
 * the applet we also draw a faint line through those marks, so the collinearity
 * is visible at a glance. Four focusable handles move the endpoints with a
 * pointer or the arrow keys; dragging a thick segment moves both its ends.
 */

(function () {
  const Core = HjelmslevTheoremCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const rSlider = document.getElementById("rSlider");
  const rOut = document.getElementById("rOut");
  const newBtn = document.getElementById("newBtn");
  const namesBtn = document.getElementById("namesBtn");
  const equalBtn = document.getElementById("equalBtn");
  const fixBtn = document.getElementById("fixBtn");
  const checkBtn = document.getElementById("checkBtn");

  const view = board.viewBox;
  const inside = (p) => ({
    x: Geom.clamp(p.x, view.x + 8, view.x + view.width - 8),
    y: Geom.clamp(p.y, view.y + 8, view.y + view.height - 8),
  });

  let state = Core.start({ s: Number(rSlider.value) });
  let checked = false;

  const guides = board.layer("guides");
  const locusLayer = board.layer("locus");
  const marksLayer = board.layer("marks");
  const hits = board.layer("hits");
  const shapes = board.layer("shapes");
  const labelsLayer = board.layer("labels");
  const handlesLayer = board.layer("handles");

  /* Everything is created once; render only moves, shows or hides it. */
  const pairs = [];
  const dots = [];
  for (let i = 0; i <= Core.N; i++) {
    pairs.push(board.segment(state.A1, state.A2, "pair-line", guides));
    dots.push(board.point(state.A1, "mark-dot", 4.5, marksLayer));
  }
  const locus = board.segment(state.A1, state.B1, "locus-line", locusLayer);
  const coincideDot = board.point(state.A1, "coincide-dot", 7, locusLayer);
  const hit1 = board.segment(state.A1, state.B1, "bar-hit", hits);
  const hit2 = board.segment(state.A2, state.B2, "bar-hit", hits);
  const bar1 = board.segment(state.A1, state.B1, "bar", shapes);
  const bar2 = board.segment(state.A2, state.B2, "bar alt", shapes);
  const names = CORE_NAMES();

  function CORE_NAMES() {
    return [
      board.label(state.A1, "A₁", "glabel", -18, -10, labelsLayer),
      board.label(state.B1, "B₁", "glabel", -18, 24, labelsLayer),
      board.label(state.A2, "A₂", "glabel alt", -18, -10, labelsLayer),
      board.label(state.B2, "B₂", "glabel alt", -18, 24, labelsLayer),
    ];
  }

  /**
   * Shows the line under the picture. "done" is the class the player's record
   * reads when an illustration has been explored; there is no win or loss.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function syncHandles() {
    for (const h of handles) h.set(state[h.name]);
  }

  function render() {
    const cl = Core.claims(state);
    const { Ar, Br } = Core.endpoints(state);
    const p1 = Core.combinedPoints(state);

    for (let i = 0; i <= Core.N; i++) {
      const u = i / Core.N;
      const from = Core.innerPoint(state.A1, state.B1, u, 1);
      const to = Core.innerPoint(state.A2, state.B2, u, 1);
      pairs[i].set(from, to);
      dots[i].set(p1[i]);
    }
    bar1.set(state.A1, state.B1);
    bar2.set(state.A2, state.B2);
    hit1.set(state.A1, state.B1);
    hit2.set(state.A2, state.B2);

    locus.show(!cl.coincide);
    coincideDot.show(cl.coincide);
    if (cl.coincide) coincideDot.set(Ar);
    else locus.set(Ar, Br);

    for (let i = 0; i < names.length; i++) {
      names[i].show(state.showNames);
      names[i].set(state[Core.NAMES[i]]);
    }
    syncHandles();

    const count = Core.N + 1;
    if (checked) {
      const text = cl.coincide
        ? `All ${count} marks sit on one spot: A_r and B_r coincide.`
        : `All ${count} marks lie on one straight segment from A_r to B_r.`;
      say(text + " This holds for every r, not only r = 1/2.", "done");
    } else {
      say(`r = ${state.s.toFixed(2)}. ${count} marks are drawn; press Check the claim to read what they show.`, null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function movePoint(name, p) {
    state = Core.withPoint(state, name, inside(p));
    render();
  }

  const opts = {
    r: 9, step: 3, shift: 12, layer: handlesLayer, clamp: inside,
  };
  const handles = Core.NAMES.map((name) => board.handle(name, state[name], {
    ...opts,
    label: `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`,
    onMove: (p) => movePoint(name, p),
  }));

  /* Dragging the interior of a black segment moves both of its endpoints. */
  let segmentDrag = null;
  const svg = board.root;
  svg.addEventListener("pointerdown", (e) => {
    let name = null;
    if (e.target === hit1.node || e.target === bar1.node) name = "A1B1";
    else if (e.target === hit2.node || e.target === bar2.node) name = "A2B2";
    if (!name) return;
    segmentDrag = { name, start: board.toLocal(e.clientX, e.clientY), snapshot: state };
    if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener("pointermove", (e) => {
    if (!segmentDrag) return;
    const here = board.toLocal(e.clientX, e.clientY);
    const delta = { x: here.x - segmentDrag.start.x, y: here.y - segmentDrag.start.y };
    state = Core.withSegment(segmentDrag.snapshot, segmentDrag.name, delta);
    render();
    e.preventDefault();
  });
  const stopSegmentDrag = () => { segmentDrag = null; };
  svg.addEventListener("pointerup", stopSegmentDrag);
  svg.addEventListener("pointercancel", stopSegmentDrag);
  svg.addEventListener("lostpointercapture", stopSegmentDrag);

  function syncButtons() {
    namesBtn.setAttribute("aria-pressed", String(state.showNames));
    namesBtn.textContent = state.showNames ? "Hide names" : "Show names";
    equalBtn.setAttribute("aria-pressed", String(state.keepEqual));
    equalBtn.textContent = state.keepEqual ? "Equal lengths: on" : "Keep segments equal";
    fixBtn.setAttribute("aria-pressed", String(state.fixLength));
    fixBtn.textContent = state.fixLength ? "Fix lengths: on" : "Fix lengths";
    rOut.textContent = state.s.toFixed(2);
  }

  function reset() {
    const fresh = Core.start({ s: Number(rSlider.value) });
    state = {
      ...fresh,
      showNames: state.showNames,
      keepEqual: state.keepEqual,
      fixLength: state.fixLength,
    };
    checked = false;
    syncButtons();
    render();
    handles[0].node.focus();
  }

  function toggle(name) {
    state = Core.withOption(state, name, !state[name]);
    syncButtons();
    render();
  }

  newBtn.addEventListener("click", reset);
  namesBtn.addEventListener("click", () => toggle("showNames"));
  equalBtn.addEventListener("click", () => toggle("keepEqual"));
  fixBtn.addEventListener("click", () => toggle("fixLength"));
  checkBtn.addEventListener("click", () => { checked = true; render(); });
  rSlider.addEventListener("input", () => {
    state = Core.withOption(state, "s", Number(rSlider.value));
    syncButtons();
    render();
  });

  board.onTheme(render);
  syncButtons();
  render();
})();
