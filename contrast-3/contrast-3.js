"use strict";

/*
 * The page for Contrast 3: drawing and input only. Every number comes from
 * contrast-3-core.js, which transcribes the applet's six scrollbars and its
 * Draw() method. The board is a 500x300 SVG: two squares sit side by side, a
 * gray ring straddles their common edge, and everything inside the right
 * square is copied up or down by dy while the left square stays put.
 */

(function () {
  const C = Contrast3Core;
  const statusEl = document.getElementById("status");

  const sliders = Object.fromEntries(C.KEYS.map((key) => [key, document.getElementById(key + "Input")]));
  const outs = Object.fromEntries(C.KEYS.map((key) => [key, document.getElementById(key + "Out")]));
  const resetBtn = document.getElementById("resetBtn");

  let state = C.start();
  let view = C.analyse(state);

  const board = Geom.board(document.getElementById("board"));
  const backdropLayer = board.layer("backdrop");
  const leftLayer = board.layer("left");
  const rightLayer = board.layer("right");
  const seamsLayer = board.layer("seams");
  const frameLayer = board.layer("frame");
  const handlesLayer = board.layer("handles");

  const backdrop = board.el("rect", { x: 0, y: 0, width: C.WIDTH, height: C.HEIGHT }, "backdrop", backdropLayer);
  const defs = board.el("defs", {}, "", board.root);
  const leftClip = board.el("clipPath", { id: "contrast-3-left" }, "", defs);
  const rightClip = board.el("clipPath", { id: "contrast-3-right" }, "", defs);
  const leftClipRect = board.el("rect", {}, "", leftClip);
  const rightClipRect = board.el("rect", {}, "", rightClip);

  /* The clip stays in canvas coordinates; only the inner right group slides. */
  const leftGroup = board.el("g", { "clip-path": "url(#contrast-3-left)" }, "scene", leftLayer);
  const rightGroup = board.el("g", { "clip-path": "url(#contrast-3-right)" }, "scene", rightLayer);
  const rightSlide = board.el("g", {}, "", rightGroup);

  function scene(group, sideClass) {
    return {
      square: board.el("rect", {}, "square " + sideClass, group),
      ring: board.circle({ x: 0, y: 0 }, 1, "ring", group),
      rightHalf: board.arc({ x: 0, y: 0 }, 1, -Math.PI / 2, Math.PI / 2, "half-max", group),
      leftHalf: board.arc({ x: 0, y: 0 }, 1, Math.PI / 2, 3 * Math.PI / 2, "half-min", group),
    };
  }
  const leftScene = scene(leftGroup, "square-min");
  const rightScene = scene(rightSlide, "square-max");

  const seamBack = board.el("rect", {}, "seam-backdrop", seamsLayer);
  const seamMax = board.el("rect", {}, "seam-max", seamsLayer);
  const frame = board.el("rect", { x: 0, y: 0, width: C.WIDTH, height: C.HEIGHT }, "frame", frameLayer);

  function setRect(node, r) {
    for (const [k, v] of Object.entries({ x: r.x, y: r.y, width: r.w, height: r.h })) {
      node.setAttribute(k, String(v));
    }
    node.style.display = r.w > 0 && r.h > 0 ? "" : "none";
  }

  const clampSlide = (p) => {
    const g = C.geometry(state);
    const lo = g.cy + Math.round(g.side * C.RANGES.h.min / 100);
    const hi = g.cy + Math.round(g.side * C.RANGES.h.max / 100);
    return { x: g.cx + Math.trunc(g.side * 0.82), y: Math.max(lo, Math.min(hi, p.y)) };
  };
  const slideHandle = board.handle("slide", view.handle, {
    r: 9, step: 2, shift: 10, layer: handlesLayer, cls: "geom-handle slide-handle",
    label: "Slide handle for the right square. Drag it up or down, or focus it and use the arrow keys, to slide the right half of the ring",
    describe: (p) => {
      const g = C.geometry(state);
      return `right square moved ${Math.round(p.y - g.cy)} pixels vertically`;
    },
    clamp: clampSlide,
    onMove: (p) => {
      state = C.withOption(state, "h", C.slideFromPoint(state, p));
      sliders.h.value = String(state.h);
      render();
    },
  });

  /** The shared status line. This is an illustration: no win or loss. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function grey(byte) {
    return `rgb(${byte} ${byte} ${byte})`;
  }

  function paintScene(part, g, squareClass) {
    setRect(part.square, { x: squareClass === "square-min" ? g.x : g.cx, y: g.y, w: g.side, h: g.side });
    const center = { x: g.cx, y: g.cy };
    part.ring.set(center, g.rOuter);
    // The helper's arc endpoints are in the same y-down direction as Java's
    // fillArc angles: -90..+90 is the right half, 90..270 the left half.
    part.rightHalf.set(center, g.rInner, -Math.PI / 2, Math.PI / 2);
    part.leftHalf.set(center, g.rInner, Math.PI / 2, 3 * Math.PI / 2);
  }

  function render() {
    view = C.analyse(state);
    const g = view;

    board.root.style.setProperty("--tone-left", grey(g.tones.left));
    board.root.style.setProperty("--tone-right", grey(g.tones.right));
    board.root.style.setProperty("--tone-ring", grey(g.tones.ring));

    setRect(leftClipRect, { x: g.x, y: g.y, w: g.side, h: g.side });
    setRect(rightClipRect, { x: g.cx, y: g.y, w: g.side, h: g.side });
    paintScene(leftScene, g, "square-min");
    paintScene(rightScene, g, "square-max");
    rightSlide.setAttribute("transform", `translate(0 ${g.dy})`);

    const patches = g.patches;
    setRect(seamBack, patches[0] || { x: 0, y: 0, w: 0, h: 0 });
    setRect(seamMax, patches[1] || { x: 0, y: 0, w: 0, h: 0 });
    for (const k of C.KEYS) {
      sliders[k].value = String(state[k]);
      outs[k].textContent = String(state[k]);
      sliders[k].setAttribute("aria-valuetext", String(state[k]));
    }
    slideHandle.set(g.handle);

    const tones = `ring ${g.tones.ring}, squares ${g.tones.left} and ${g.tones.right}, radii ${g.rOuter} and ${g.rInner}`;
    if (g.dy === 0) {
      say(`The ring is one circle: ${tones}.`);
    } else {
      say(`The right square is ${Math.abs(g.dy)} pixels ${g.dy > 0 ? "below" : "above"} the left one, taking its half of the gray ring with it: ${tones}.`);
    }

    // The position, in board units and scrollbar values, for the tutor.
    if (window.Track) window.Track.state(state);
  }

  for (const k of C.KEYS) {
    sliders[k].addEventListener("input", () => {
      state = C.withOption(state, k, sliders[k].value);
      render();
    });
  }
  resetBtn.addEventListener("click", () => {
    state = C.start();
    render();
  });

  board.onTheme(render);
  render();
})();
