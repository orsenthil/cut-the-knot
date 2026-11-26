"use strict";

/*
 * Browser UI for the Reflection Lemma demo. Sliders set the start height a,
 * the finish height b and the number of steps. One walk draws a random walk
 * from A to B together with its reflection from A' = (0,-a) up to the first
 * touch of the axis; the two coincide afterwards. All logic is in
 * reflection-principle-core.js. The SVG uses CSS classes, so themes need no
 * redraw.
 */

(() => {
  const C = ReflectionPrincipleCore;
  const svg = document.getElementById("diagram");
  const statusEl = document.getElementById("status");
  const summaryEl = document.getElementById("walkSummary");
  const point = (y, x) => ({ x, y: -y });
  let state = C.start();

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function element(name, attrs, className) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", name);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    if (className) node.setAttribute("class", className);
    return node;
  }

  function draw() {
    const steps = C.steps(state);
    const ys = [state.a, -state.a, state.b, 0, ...(state.path ?? []), ...(state.reflected ?? [])];
    const lo = Math.min(...ys);
    const hi = Math.max(...ys);
    const span = Math.max(hi - lo, 4);
    const pad = span * 0.18;
    svg.setAttribute("viewBox", [-1, -(hi + pad), steps + 2, span + 2 * pad].join(" "));
    svg.replaceChildren();

    svg.appendChild(element("line", { x1: -1, y1: 0, x2: steps + 1, y2: 0 }, "axis"));
    for (let x = 0; x <= steps; x++) {
      svg.appendChild(element("line", {
        x1: x, y1: -(hi + pad), x2: x, y2: -(lo - pad),
      }, "grid-line"));
    }

    const markers = [
      [state.a, 0, "start-dot", "A"],
      [-state.a, 0, "mirror-dot", "A'"],
      [state.b, steps, "end-dot", "B"],
    ];
    markers.forEach(([y, x, className, name]) => {
      const p = point(y, x);
      svg.appendChild(element("circle", { cx: p.x, cy: p.y, r: span * 0.06 }, className));
      if (state.showNames) {
        const label = element("text", {
          x: p.x + span * 0.07,
          y: p.y - span * 0.08,
          "font-size": span * 0.1,
        }, "point-label");
        label.textContent = name;
        svg.appendChild(label);
      }
    });

    for (const [path, className] of [
      [state.reflected, "reflected-walk"],
      [state.path, "walk"],
    ]) {
      if (!path) continue;
      const pts = path.map((y, x) => {
        const p = point(y, x);
        return `${p.x},${p.y}`;
      }).join(" ");
      svg.appendChild(element("polyline", {
        points: pts,
        "stroke-width": span * 0.028,
      }, className));
    }
  }

  function render() {
    for (const key of ["a", "b", "n"]) {
      document.getElementById(`slider-${key}`).value = String(state[key]);
      document.getElementById(`value-${key}`).textContent = String(state[key]);
    }
    document.getElementById("namesBox").checked = state.showNames;
    draw();
    summaryEl.textContent = state.path
      ? `A walk from A to B and its reflection from A'. There are ${C.countWalks(state)} walks from A to B in ${C.steps(state)} steps.`
      : "No walk yet.";
    say(state.message, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        a: state.a, b: state.b, n: state.n,
        showNames: state.showNames,
        steps: C.steps(state),
        touchedZero: state.passedZero,
        walk: state.path ? state.path.slice() : null,
        reflected: state.reflected ? state.reflected.slice() : null,
        explored: state.explored,
      });
    }
  }

  function change(key, value) {
    state = C.setParam(state, key, Number(value));
    render();
  }

  for (const key of ["a", "b", "n"]) {
    document.getElementById(`slider-${key}`).addEventListener("input", (event) => {
      change(key, event.target.value);
    });
  }
  document.getElementById("namesBox").addEventListener("change", () => {
    state = C.toggleNames(state);
    render();
  });
  document.getElementById("oneBtn").addEventListener("click", () => {
    state = C.addWalk(state);
    render();
  });

  render();
})();
