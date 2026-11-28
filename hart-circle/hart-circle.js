"use strict";

/*
 * Hart Circle — the drawing and the controls; all the geometry is in
 * hart-circle-core.js. Six focusable handles move the three centres and
 * three boundary points. Grabbing a grey circle's outline drags the whole
 * circle, as in the applet: centre and boundary point move together. The
 * dropdown picks one of the eight curved triangles; the two switches add the
 * red incircles and the little dots where pairs of circles nearly touch.
 */

(() => {
  const Core = HartCircleCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const variantEl = document.getElementById("variant");
  const addOnsEl = document.getElementById("addOns");
  const tangencyEl = document.getElementById("tangency");
  const resetBtn = document.getElementById("resetBtn");

  let state = Core.start({
    variant: variantEl.value,
    showAddOns: addOnsEl.checked,
    showTangency: tangencyEl.checked,
  });

  /* Back to front: the three given circles, the radius guides, the four
   * inscribed circles, the tangency dots, then the handles that keep focus. */
  const givenLayer = board.layer("given");
  const guideLayer = board.layer("guides");
  const incircleLayer = board.layer("incircles");
  const hartLayer = board.layer("hart");
  const dotLayer = board.layer("dots");
  const handleLayer = board.layer("handles");

  const given = [], hits = [], radii = [], centres = [], edges = [];
  for (let i = 0; i < 3; i++) {
    const item = state.circles[i];
    given[i] = board.circle(item.c, Core.dist(item.c, item.b), `given-circle given-${i + 1}`, givenLayer);
    hits[i] = board.circle(item.c, Core.dist(item.c, item.b), "given-hit", givenLayer);
    hits[i].node.setAttribute("data-circle", String(i));
    radii[i] = board.segment(item.c, item.b, `radius radius-${i + 1}`, guideLayer);
    centres[i] = board.handle(`c${i + 1}`, item.c, {
      r: 8, step: 4, shift: 12, layer: handleLayer,
      clamp: (p) => Core.clamp(p),
      label: `Centre of circle ${i + 1}. Drag it, or focus it and use the arrow keys to move it.`,
      onMove: (p, name) => { state = Core.move(state, name, p); render(); },
    });
    edges[i] = board.handle(`b${i + 1}`, item.b, {
      r: 8, step: 4, shift: 12, layer: handleLayer,
      clamp: (p) => Core.clamp(p),
      label: `Edge point of circle ${i + 1}. Drag it, or focus it and use the arrow keys to set the radius.`,
      onMove: (p, name) => { state = Core.move(state, name, p); render(); },
    });
  }

  const baseCircle = board.circle(state.circles[0].c, 1, "base-circle", incircleLayer);
  const extras = [0, 1, 2].map(() =>
    board.circle(state.circles[0].c, 1, "extra-circle", incircleLayer));
  const hartCircle = board.circle(state.circles[0].c, 1, "hart-circle", hartLayer);
  const dots = [];
  for (let i = 0; i < 16; i++) dots.push(board.point(state.circles[0].c, "tangency-dot", 3.5, dotLayer));

  /* A very large solution circle is still a solution; clip only its drawn
   * radius so a nearly straight line cannot stress the SVG renderer. */
  const drawRadius = (c) => Math.min(c.r, 5000);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const g = Core.geometry(state);
    for (let i = 0; i < 3; i++) {
      given[i].set(g.given[i]);
      hits[i].set(g.given[i]);
      radii[i].set(state.circles[i].c, state.circles[i].b);
      centres[i].set(state.circles[i].c);
      edges[i].set(state.circles[i].b);
    }

    baseCircle.set(g.base || g.given[0], g.base ? drawRadius(g.base) : 1);
    baseCircle.show(!!g.base);
    for (let i = 0; i < 3; i++) {
      const c = g.extras[i];
      extras[i].set(c || g.given[0], c ? drawRadius(c) : 1);
      extras[i].show(!!c);
    }
    hartCircle.set(g.hart || g.given[0], g.hart ? drawRadius(g.hart) : 1);
    hartCircle.show(!!g.hart);

    for (let i = 0; i < dots.length; i++) {
      const dot = g.tangency[i];
      dots[i].set(dot ? dot.p : g.given[0]);
      dots[i].show(!!dot);
      if (dot) dots[i].node.setAttribute("aria-hidden", "true");
    }

    variantEl.value = Core.OPTIONS[state.variant];
    addOnsEl.checked = state.showAddOns;
    tangencyEl.checked = state.showTangency;
    tangencyEl.disabled = !state.showAddOns;

    say(Core.describe(state), state.explored ? "done" : null);
    // The position, in board units, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  /* Pointer dragging of a whole grey circle: centre and boundary translate
   * by the same amount, exactly as Mover.UpdateLocation does in the applet. */
  let dragging = null;
  board.root.addEventListener("pointerdown", (e) => {
    if (!e.target.classList || !e.target.classList.contains("given-hit")) return;
    const index = Number(e.target.getAttribute("data-circle"));
    dragging = { index: index, last: board.toLocal(e.clientX, e.clientY) };
    if (board.root.setPointerCapture) board.root.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  board.root.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const p = board.toLocal(e.clientX, e.clientY);
    state = Core.moveCircle(state, dragging.index,
      Core.point(p.x - dragging.last.x, p.y - dragging.last.y));
    dragging.last = p;
    render();
    e.preventDefault();
  });
  const endDrag = () => { dragging = null; };
  board.root.addEventListener("pointerup", endDrag);
  board.root.addEventListener("pointercancel", endDrag);
  board.root.addEventListener("lostpointercapture", endDrag);

  variantEl.addEventListener("change", () => {
    state = Core.setOption(state, "variant", variantEl.value);
    render();
  });
  addOnsEl.addEventListener("change", () => {
    state = Core.setOption(state, "showAddOns", addOnsEl.checked);
    render();
  });
  tangencyEl.addEventListener("change", () => {
    state = Core.setOption(state, "showTangency", tangencyEl.checked);
    render();
  });
  resetBtn.addEventListener("click", () => { state = Core.reset(state); render(); });

  // SVG colours come from CSS classes, but keep the shared redraw hook.
  board.onTheme(render);
  render();
})();
