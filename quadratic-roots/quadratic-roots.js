"use strict";

/*
 * Browser UI for the Quadratic Roots construction. Three sliders set a, b
 * and c. The diagram shows the broken line A(0,a)-B(0,0)-C(b,0)-D(b,c), the
 * circle with diameter AD and the points where it meets the x-axis; those
 * points are a times the roots of ax² - bx + c = 0. Everything geometric is
 * in quadratic-roots-core.js. The SVG is styled with CSS classes, so theme
 * changes need no redraw.
 */

(() => {
  const C = QuadraticRootsCore;
  const svg = document.getElementById("diagram");
  const statusEl = document.getElementById("status");
  const rootsEl = document.getElementById("roots");
  const point = (p) => ({ x: p.x, y: -p.y });
  let state = C.start();
  let unit = 1; // viewBox units per pixel-ish stroke width, set by draw()

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function element(name, attrs, className) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (className) {
      node.setAttribute("class", className);
      const widths = { axis: 0.012, broken: 0.05, helper: 0.028, "construction-circle": 0.04 };
      if (widths[className]) node.setAttribute("stroke-width", String(widths[className] * unit));
    }
    return node;
  }

  function line(a, b, className, dashed = false) {
    const p = point(a);
    const q = point(b);
    const attrs = { x1: p.x, y1: p.y, x2: q.x, y2: q.y };
    if (dashed) attrs["stroke-dasharray"] = `${unit * 0.16} ${unit * 0.16}`;
    return element("line", attrs, className);
  }

  function dot(p, className, radius = 0.09) {
    const s = point(p);
    return element("circle", { cx: s.x, cy: s.y, r: radius * unit }, className);
  }

  function label(p, text) {
    const s = point(p);
    const node = element("text", {
      x: s.x + unit * 0.12,
      y: s.y - unit * 0.12,
      "font-size": unit * 0.4,
    }, "point-label");
    node.textContent = text;
    return node;
  }

  function draw() {
    const g = C.geometry(state);
    const xs = [g.A.x, g.B.x, g.C.x, g.D.x, g.center.x - g.radius,
      g.center.x + g.radius, ...g.xRoots];
    const ys = [g.A.y, g.B.y, g.C.y, g.D.y, g.center.y - g.radius,
      g.center.y + g.radius, 0];
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    unit = Math.max(maxX - minX, maxY - minY, 2) * 0.16;
    const pad = unit * 2;
    svg.setAttribute("viewBox", [
      minX - pad, -(maxY + pad),
      maxX - minX + 2 * pad, maxY - minY + 2 * pad,
    ].join(" "));
    svg.replaceChildren();
    svg.append(
      line({ x: minX - pad, y: 0 }, { x: maxX + pad, y: 0 }, "axis"),
      line({ x: 0, y: minY - pad }, { x: 0, y: maxY + pad }, "axis"),
    );

    const broken = element("polyline", {
      points: [g.A, g.B, g.C, g.D].map((p) => {
        const s = point(p);
        return `${s.x},${s.y}`;
      }).join(" "),
    }, "broken");
    svg.appendChild(broken);
    svg.appendChild(line(g.A, g.D, "helper", true));
    if (g.E && g.F) {
      svg.appendChild(line(g.E, g.F, "helper", true));
      if (state.showHint) svg.appendChild(dot(g.E, "right-angle", 0.04));
    }

    const center = point(g.center);
    svg.appendChild(element("circle", {
      cx: center.x, cy: center.y, r: g.radius,
    }, "construction-circle"));

    g.xRoots.forEach((x) => svg.appendChild(dot({ x, y: 0 }, "root", 0.13)));
    Object.entries({ A: g.A, B: g.B, C: g.C, D: g.D, E: g.E, F: g.F }).forEach(([name, p]) => {
      if (p) svg.appendChild(dot(p, "vertex"));
    });

    if (state.showNames) {
      Object.entries({ A: g.A, B: g.B, C: g.C, D: g.D, E: g.E, F: g.F }).forEach(([name, p]) => {
        if (p) svg.appendChild(label(p, name));
      });
      g.xRoots.forEach((x, i) => svg.appendChild(label({ x, y: 0 }, `x${i + 1}`)));
    }

    rootsEl.textContent = g.kind === "none"
      ? "No real roots: the circle misses the line."
      : g.kind === "linear"
        ? `One root (a = 0): ${g.roots[0].toFixed(2)}`
        : g.kind === "double"
          ? `One double root: ${g.roots[0].toFixed(2)}`
          : `Two roots: ${g.roots[0].toFixed(2)} and ${g.roots[1].toFixed(2)}`;
  }

  function render() {
    for (const key of ["a", "b", "c"]) {
      document.getElementById(`slider-${key}`).value = String(state[key]);
      document.getElementById(`value-${key}`).textContent = state[key].toFixed(1);
    }
    document.getElementById("hintBox").checked = state.showHint;
    document.getElementById("namesBox").checked = state.showNames;
    draw();
    say(state.message, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      const g = C.geometry(state);
      window.Track.state({
        a: state.a, b: state.b, c: state.c,
        showHint: state.showHint, showNames: state.showNames,
        kind: g.kind, roots: g.roots.slice(),
        explored: state.explored,
      });
    }
  }

  for (const key of ["a", "b", "c"]) {
    document.getElementById(`slider-${key}`).addEventListener("input", (event) => {
      state = C.setCoefficient(state, key, Number(event.target.value));
      render();
    });
  }
  document.getElementById("hintBox").addEventListener("change", () => {
    state = C.toggle(state, "showHint");
    render();
  });
  document.getElementById("namesBox").addEventListener("change", () => {
    state = C.toggle(state, "showNames");
    render();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = C.reset(state);
    render();
  });

  render();
})();
