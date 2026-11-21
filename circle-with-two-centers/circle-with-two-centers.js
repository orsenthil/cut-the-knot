"use strict";

/*
 * The page for A Circle With Two Centers: drawing and input only. All the
 * geometry is in circle-with-two-centers-core.js. The play area is an SVG with
 * a 600x400 viewBox; A, B and C are focusable handles that can be dragged with
 * a pointer or moved with the arrow keys. The honest drawing has one centre;
 * the cheating drawing (the page's first applet) has two. Everything is drawn
 * from the tokens in assets/site.css so both themes follow the site.
 */

(function () {
  const Core = CircleWithTwoCentersCore;
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const cheatBox = document.getElementById("cheatCheck");
  const namesBox = document.getElementById("namesCheck");
  const hintBox = document.getElementById("hintCheck");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let drawing = null;
  let dragging = null; // which point name is being dragged

  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const fmt = (p) => `(${Math.round(p.x)}, ${Math.round(p.y)})`;

  /** Shows a line under the game. "done" tells the record the demo is explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /* ---------------------------------------------------------- SVG construction */

  function make(tag, cls, parent) {
    const e = document.createElementNS(NS, tag);
    if (cls) e.setAttribute("class", cls);
    parent.appendChild(e);
    return e;
  }

  function setLine(el, p, q) {
    el.setAttribute("x1", p.x);
    el.setAttribute("y1", p.y);
    el.setAttribute("x2", q.x);
    el.setAttribute("y2", q.y);
  }

  function setDot(el, p) {
    el.setAttribute("cx", p.x);
    el.setAttribute("cy", p.y);
  }

  function setCircle(el, c) {
    setDot(el, c);
    el.setAttribute("r", c.r);
  }

  function setLabel(el, p, text, dx, dy) {
    el.setAttribute("x", p.x + (dx === undefined ? 9 : dx));
    el.setAttribute("y", p.y + (dy === undefined ? -9 : dy));
    el.textContent = text;
  }

  function show(el, on) {
    el.style.display = on ? "" : "none";
  }

  function initBoard() {
    const d = {};
    d.rayB = make("line", "ray", svg);
    d.rayC = make("line", "ray", svg);
    d.circle = make("circle", "circumcircle", svg);
    d.perpB = make("line", "perp", svg);
    d.perpC = make("line", "perp", svg);
    d.hintB = make("path", "hint", svg);
    d.hintC = make("path", "hint", svg);
    d.diamB = make("line", "diameter", svg);
    d.diamC = make("line", "diameter false", svg);
    d.honestDiam = make("line", "diameter", svg);
    d.centerB = make("circle", "centre false", svg);
    d.centerC = make("circle", "centre false", svg);
    d.honestCentre = make("circle", "centre true", svg);
    d.E = make("circle", "secondary", svg);
    d.F = make("circle", "secondary", svg);
    d.D = make("circle", "fixed", svg);

    d.handles = {};
    ["A", "B", "C"].forEach((name) => {
      const c = make("circle", "handle", svg);
      c.setAttribute("r", 9);
      c.setAttribute("tabindex", "0");
      c.setAttribute("data-point", name);
      c.setAttribute("role", "button");
      c.setAttribute("aria-label", `Point ${name}. Drag it, or focus it and use the arrow keys to move it.`);
      c.addEventListener("pointerdown", (ev) => {
        dragging = name;
        svg.setPointerCapture(ev.pointerId);
        ev.preventDefault();
      });
      c.addEventListener("keydown", (ev) => {
        const step = ev.shiftKey ? 30 : 10;
        const delta = {
          ArrowLeft: [-step, 0], ArrowRight: [step, 0],
          ArrowUp: [0, -step], ArrowDown: [0, step],
        }[ev.key];
        if (!delta) return;
        const next = Core.nudge(state, name, delta[0], delta[1]);
        if (next) {
          state = next;
          render(`You moved point ${name} with the arrow keys. ${explanation(Core.geometry(state))}`);
        }
        ev.currentTarget.focus(); // focus must stay on the board after a move
        ev.preventDefault();
      });
      d.handles[name] = c;
    });

    d.labels = {};
    ["A", "B", "C", "D", "E", "F", "centre1", "centre2"].forEach((key) => {
      d.labels[key] = make("text", "label", svg);
    });
    return d;
  }

  /** A small right-angle corner at `v`, between the directions to p and q. */
  function corner(v, p, q, size) {
    const u = { x: p.x - v.x, y: p.y - v.y };
    const w = { x: q.x - v.x, y: q.y - v.y };
    const un = Math.hypot(u.x, u.y);
    const wn = Math.hypot(w.x, w.y);
    if (!un || !wn) return null;
    const a = { x: v.x + u.x / un * size, y: v.y + u.y / un * size };
    const b = { x: a.x + w.x / wn * size, y: a.y + w.y / wn * size };
    const c = { x: v.x + w.x / wn * size, y: v.y + w.y / wn * size };
    return `M ${a.x} ${a.y} L ${b.x} ${b.y} L ${c.x} ${c.y}`;
  }

  function draw(g) {
    if (!drawing) drawing = initBoard();
    const d = drawing;
    const extend = (p) => ({ x: g.A.x + (p.x - g.A.x) * 1.15, y: g.A.y + (p.y - g.A.y) * 1.15 });

    setLine(d.rayB, g.A, extend(g.B));
    setLine(d.rayC, g.A, extend(g.C));
    show(d.circle, !g.degenerate);

    show(d.perpB, !!g.D);
    show(d.perpC, !!g.D);
    if (g.D) {
      // Clip each line to the piece around the intersection: the applet drew
      // it all the way across the canvas, but that hides the circle.
      const past = (base) => ({
        x: g.D.x + (g.D.x - base.x) * 0.18,
        y: g.D.y + (g.D.y - base.y) * 0.18,
      });
      setLine(d.perpB, g.B, past(g.B));
      setLine(d.perpC, g.C, past(g.C));
      d.perpB.classList.toggle("cheat", state.cheat);
      d.perpC.classList.toggle("cheat", state.cheat);
    }

    const hint = state.showHint && g.D && !g.degenerate;
    show(d.hintB, !!hint);
    show(d.hintC, !!hint);
    if (hint) {
      d.hintB.setAttribute("d", corner(g.B, g.A, g.D, 22) || "");
      d.hintC.setAttribute("d", corner(g.C, g.A, g.D, 22) || "");
    }

    show(d.honestDiam, !state.cheat && !g.degenerate);
    show(d.honestCentre, !state.cheat && !g.degenerate);
    show(d.diamB, state.cheat && !g.degenerate);
    show(d.diamC, state.cheat && !g.degenerate);
    show(d.centerB, state.cheat && !g.degenerate);
    show(d.centerC, state.cheat && !g.degenerate);
    show(d.E, state.cheat && !!g.E);
    show(d.F, state.cheat && !!g.F);
    show(d.D, !g.degenerate);

    if (!g.degenerate) {
      setCircle(d.circle, g.circle);
      setDot(d.D, g.D);
      if (state.cheat) {
        setLine(d.diamB, g.D, g.E);
        setLine(d.diamC, g.D, g.F);
        setDot(d.centerB, g.centerB);
        setDot(d.centerC, g.centerC);
        setDot(d.E, g.E);
        setDot(d.F, g.F);
      } else {
        setLine(d.honestDiam, g.A, g.D);
        setDot(d.honestCentre, g.centerB);
      }
    }
    ["A", "B", "C"].forEach((name) => setDot(d.handles[name], g[name]));

    const nameOn = state.showNames;
    const eFar = state.cheat && g.E && dist(g.E, g.A) > 4;
    const fFar = state.cheat && g.F && dist(g.F, g.A) > 4;
    show(d.labels.A, nameOn);
    show(d.labels.B, nameOn);
    show(d.labels.C, nameOn);
    show(d.labels.D, nameOn && !g.degenerate);
    show(d.labels.E, nameOn && !!eFar);
    show(d.labels.F, nameOn && !!fFar);
    show(d.labels.centre1, nameOn && state.cheat && !g.degenerate);
    show(d.labels.centre2, nameOn && state.cheat && !g.degenerate);
    if (nameOn) {
      setLabel(d.labels.A, g.A, "A");
      setLabel(d.labels.B, g.B, "B");
      setLabel(d.labels.C, g.C, "C");
      if (!g.degenerate) {
        setLabel(d.labels.D, g.D, "D");
        if (eFar) setLabel(d.labels.E, g.E, "E", -26, 20);
        if (fFar) setLabel(d.labels.F, g.F, "F", 10, -18);
        if (state.cheat) {
          setLabel(d.labels.centre1, g.centerB, "centre 1", 9, -10);
          setLabel(d.labels.centre2, g.centerC, "centre 2", 9, 24);
        }
      }
    }
  }

  /* ----------------------------------------------------------- words on screen */

  function explanation(g) {
    if (g.degenerate) {
      return "The two rays lie on one line, so their perpendiculars are parallel and point D does not exist. Move a point to open up an angle.";
    }
    if (state.cheat) {
      const sep = dist(g.centerB, g.centerC);
      const off = dist(g.E, g.A);
      return `Cheat is on: the lines at B and C are tilted, so E is ${off.toFixed(1)} units from A and the two supposed centres are ${sep.toFixed(1)} units apart. A circle cannot have two centres.`;
    }
    return `Cheat is off: E and F are both at A, so both midpoints land on ${fmt(g.centerB)} — one centre, as the page explains.`;
  }

  function render(message) {
    const g = Core.geometry(state);
    cheatBox.checked = state.cheat;
    namesBox.checked = state.showNames;
    hintBox.checked = state.showHint;
    draw(g);
    let text = message || `Here is the construction. ${explanation(g)}`;
    if (Core.result(state) === "done") text += " You have compared both drawings.";
    say(text, Core.result(state) === "done" ? "done" : "");
    if (window.Track) window.Track.state(state);
  }

  /* ------------------------------------------------------------------- input */

  function pointerPoint(ev) {
    // Map the pointer through the SVG's own size, so the board shrinks on a phone.
    const rect = svg.getBoundingClientRect();
    return {
      x: (ev.clientX - rect.left) * Core.W / Math.max(1, rect.width),
      y: (ev.clientY - rect.top) * Core.H / Math.max(1, rect.height),
    };
  }

  svg.addEventListener("pointermove", (ev) => {
    if (!dragging) return;
    const p = pointerPoint(ev);
    const next = Core.move(state, { point: dragging, x: p.x, y: p.y });
    if (next) {
      state = next;
      render(`You dragged point ${dragging} to ${fmt(p)}. ${explanation(Core.geometry(state))}`);
    }
    ev.preventDefault();
  });
  const stopDrag = () => { dragging = null; };
  svg.addEventListener("pointerup", stopDrag);
  svg.addEventListener("pointercancel", stopDrag);

  cheatBox.addEventListener("change", () => {
    state = Core.setOptions(state, { cheat: cheatBox.checked });
    render(`You switched the cheat ${state.cheat ? "on" : "off"}. ${explanation(Core.geometry(state))}`);
  });
  namesBox.addEventListener("change", () => {
    state = Core.setOptions(state, { showNames: namesBox.checked });
    render(`Names are now ${state.showNames ? "shown" : "hidden"}. ${explanation(Core.geometry(state))}`);
  });
  hintBox.addEventListener("change", () => {
    state = Core.setOptions(state, { showHint: hintBox.checked });
    render(`The right-angle marks are now ${state.showHint ? "shown" : "hidden"}. ${explanation(Core.geometry(state))}`);
  });
  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render(`The three points are back where they started. ${explanation(Core.geometry(state))}`);
  });

  window.addEventListener("themechange", () => { if (drawing) draw(Core.geometry(state)); });

  state = Core.start({});
  render();
})();
