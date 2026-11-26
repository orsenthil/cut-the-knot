"use strict";

/*
 * Geom — small, dependency-free drawing helpers for the SVG illustrations.
 *
 * Load it before a port's own script:
 *   <script src="../assets/geom.js"></script>
 *   <script src="my-port.js"></script>
 *
 * It defines exactly one global, window.Geom, and needs nothing else: no DOM
 * ready handler, no catalogue, no CSS of its own. A port puts an <svg> with a
 * viewBox inside a .stage and starts with:
 *
 *   const board = Geom.board(document.getElementById("board"));
 *   const shapes = board.layer("shapes");
 *   const seg = board.segment(A, B, "bar", shapes);
 *   const ha = board.handle("A", A, { step: 5, onMove: render });
 *
 * Elements are created once and changed through their .set(...) methods, so a
 * handle keeps keyboard focus across a redraw. Geom never sets a colour: every
 * element gets a class, and the port's <style> maps that class to the site's
 * CSS custom properties (--ink, --accent, --stage, --muted, --good, --bad,
 * --highlight, --text). Handles are focusable, carry an aria-label and move
 * with the arrow keys (Shift for a bigger step). Pointer coordinates go
 * through the SVG's own transform so the board shrinks on a phone. A theme
 * flip is just a CSS change for class-styled SVG, but board.onTheme(fn) is
 * there for ports that also compute something in JavaScript.
 *
 * The pure geometry helpers (distance, midpoint, foot, angle, line and circle
 * intersections) live directly on Geom and touch no DOM, so a DOM-free core
 * can use them too.
 */

(function () {
  const NS = "http://www.w3.org/2000/svg";

  /* ------------------------------------------------ pure geometry (no DOM) */

  const distance = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  const midpoint = (p, q) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const lerp = (p, q, t) => ({ x: p.x + (q.x - p.x) * t, y: p.y + (q.y - p.y) * t });
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const dot = (a, b) => a.x * b.x + a.y * b.y;
  const pointOnCircle = (c, r, a) => ({ x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) });

  /** Angle at v between the rays v->p and v->q, in radians, in [0, PI]. */
  function angle(v, p, q) {
    const a = { x: p.x - v.x, y: p.y - v.y }, b = { x: q.x - v.x, y: q.y - v.y };
    const na = Math.hypot(a.x, a.y), nb = Math.hypot(b.x, b.y);
    if (!na || !nb) return 0;
    return Math.acos(clamp(dot(a, b) / (na * nb), -1, 1));
  }

  /** Foot of the perpendicular from p to the line through a and b. */
  function foot(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy;
    if (!len2) return { x: a.x, y: a.y };
    const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
    return { x: a.x + dx * t, y: a.y + dy * t };
  }

  /** Intersection of line(a,b) with line(c,d), or null when they are parallel. */
  function lineIntersection(a, b, c, d) {
    const rx = b.x - a.x, ry = b.y - a.y, sx = d.x - c.x, sy = d.y - c.y;
    const cross = rx * sy - ry * sx;
    if (Math.abs(cross) < 1e-12) return null;
    const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / cross;
    return { x: a.x + rx * t, y: a.y + ry * t };
  }

  /** Intersection points of two circles: 0, 1 or 2 points. */
  function circleIntersection(c1, r1, c2, r2) {
    const dx = c2.x - c1.x, dy = c2.y - c1.y, d = Math.hypot(dx, dy);
    if (!d || d > r1 + r2 || d < Math.abs(r1 - r2)) return [];
    const a = (r1 * r1 - r2 * r2 + d * d) / (2 * d);
    const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
    const base = { x: c1.x + (dx * a) / d, y: c1.y + (dy * a) / d };
    if (h < 1e-9) return [base];
    return [
      { x: base.x - (dy * h) / d, y: base.y + (dx * h) / d },
      { x: base.x + (dy * h) / d, y: base.y - (dx * h) / d },
    ];
  }

  /* ------------------------------------------------------- theme redraw hook */

  /** Call fn on a site theme flip and on an OS dark-mode change. */
  function onTheme(fn, immediate) {
    window.addEventListener("themechange", fn);
    const mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (mq && mq.addEventListener) mq.addEventListener("change", fn);
    if (immediate) fn();
    return function off() {
      window.removeEventListener("themechange", fn);
      if (mq && mq.removeEventListener) mq.removeEventListener("change", fn);
    };
  }

  /* ------------------------------------------------- private SVG primitives */

  function makeEl(tag, attrs, cls, parent, text) {
    const node = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (cls) node.setAttribute("class", cls);
    if (text !== undefined) node.textContent = text;
    if (parent) parent.appendChild(node);
    return node;
  }

  function setAttrs(node, attrs) {
    for (const k in attrs) node.setAttribute(k, attrs[k]);
  }

  function readViewBox(svg) {
    const vb = svg.viewBox && svg.viewBox.baseVal;
    if (vb && vb.width && vb.height) return { x: vb.x, y: vb.y, width: vb.width, height: vb.height };
    const p = String(svg.getAttribute("viewBox") || "0 0 300 200").trim().split(/[\s,]+/).map(Number);
    return { x: p[0] || 0, y: p[1] || 0, width: p[2] || 300, height: p[3] || 200 };
  }

  /** The unit vector from `from` towards `to`, scaled to `size`. */
  function dir(from, to, size) {
    const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy) || 1;
    return { x: (dx / d) * size, y: (dy / d) * size };
  }

  /** Clip the infinite line through p,q to the viewBox rectangle. */
  function clipLine(p, q, v) {
    const dx = q.x - p.x, dy = q.y - p.y;
    let lo = -Infinity, hi = Infinity;
    const slab = (start, delta, min, max) => {
      if (delta === 0) return start >= min && start <= max;
      let a = (min - start) / delta, b = (max - start) / delta;
      if (a > b) { const t = a; a = b; b = t; }
      lo = Math.max(lo, a);
      hi = Math.min(hi, b);
      return true;
    };
    if (!slab(p.x, dx, v.x, v.x + v.width) || !slab(p.y, dy, v.y, v.y + v.height)) return null;
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    return [{ x: p.x + dx * lo, y: p.y + dy * lo }, { x: p.x + dx * hi, y: p.y + dy * hi }];
  }

  /** Path for the minor arc of radius r about c, from angle a0 to a1. */
  function arcPath(c, r, a0, a1) {
    const p0 = pointOnCircle(c, r, a0), p1 = pointOnCircle(c, r, a1);
    const sweep = Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) >= 0 ? 1 : 0;
    return `M ${p0.x} ${p0.y} A ${r} ${r} 0 0 ${sweep} ${p1.x} ${p1.y}`;
  }

  /* ------------------------------------------------------------------ board */

  function board(target, opts) {
    const svg = typeof target === "string" ? document.getElementById(target) : target;
    if (!svg || String(svg.nodeName).toLowerCase() !== "svg") {
      throw new Error("Geom.board needs an <svg> element or its id");
    }
    const view = readViewBox(svg);
    const layers = Object.create(null);
    const handles = [];
    let active = null;

    function layer(name) {
      if (!layers[name]) layers[name] = makeEl("g", null, "geom-layer geom-layer-" + name, svg);
      return layers[name];
    }
    const where = (l) => (typeof l === "string" ? layer(l) : l || svg);

    /** Every drawing object gets .node, .set(...) and .show(on). */
    function shape(node, update) {
      const api = {
        node: node,
        set: function () { update.apply(null, arguments); return api; },
        show: function (on) { node.style.display = on ? "" : "none"; return api; },
      };
      return api;
    }

    /* Client pixels <-> viewBox user units, through the SVG's own transform. */
    function toLocal(clientX, clientY) {
      const m = svg.getScreenCTM && svg.getScreenCTM();
      if (m && typeof DOMPoint === "function") {
        const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
        return { x: p.x, y: p.y };
      }
      if (m && svg.createSVGPoint) {
        const p = svg.createSVGPoint(); p.x = clientX; p.y = clientY;
        const q = p.matrixTransform(m.inverse());
        return { x: q.x, y: q.y };
      }
      const r = svg.getBoundingClientRect();
      return {
        x: view.x + ((clientX - r.left) / Math.max(1, r.width)) * view.width,
        y: view.y + ((clientY - r.top) / Math.max(1, r.height)) * view.height,
      };
    }
    function toClient(p) {
      const m = svg.getScreenCTM && svg.getScreenCTM();
      if (m && typeof DOMPoint === "function") {
        const q = new DOMPoint(p.x, p.y).matrixTransform(m);
        return { x: q.x, y: q.y };
      }
      if (m && svg.createSVGPoint) {
        const q = svg.createSVGPoint(); q.x = p.x; q.y = p.y;
        const r = q.matrixTransform(m);
        return { x: r.x, y: r.y };
      }
      const r = svg.getBoundingClientRect();
      return {
        x: r.left + ((p.x - view.x) / view.width) * r.width,
        y: r.top + ((p.y - view.y) / view.height) * r.height,
      };
    }

    /** Raw element creator, for the shapes none of the helpers cover. */
    function el(tag, attrs, cls, l, text) {
      return makeEl(tag, attrs, cls, where(l), text);
    }

    function clear(l) {
      const node = where(l);
      while (node.firstChild) node.removeChild(node.firstChild);
      return api;
    }

    /* ---- drawing helpers: each returns { node, set(...), show(on) } ---- */

    function point(p, cls, r, l) {
      const node = makeEl("circle", null, cls, where(l));
      const set = (q, radius) => setAttrs(node, { cx: q.x, cy: q.y, r: radius === undefined ? r : radius });
      set(p, r);
      return shape(node, set);
    }

    function segment(p, q, cls, l) {
      const node = makeEl("line", null, cls, where(l));
      const set = (a, b) => setAttrs(node, { x1: a.x, y1: a.y, x2: b.x, y2: b.y });
      set(p, q);
      return shape(node, set);
    }

    /** A line through p and q, clipped to the viewBox. */
    function line(p, q, cls, l) {
      const node = makeEl("line", null, cls, where(l));
      const set = (a, b) => {
        const ends = clipLine(a, b, view) || [a, a];
        setAttrs(node, { x1: ends[0].x, y1: ends[0].y, x2: ends[1].x, y2: ends[1].y });
      };
      set(p, q);
      return shape(node, set);
    }

    function circle(c, r, cls, l) {
      const node = makeEl("circle", null, cls, where(l));
      const set = (center, radius) => setAttrs(node, { cx: center.x, cy: center.y, r: radius === undefined ? r : radius });
      set(c, r);
      return shape(node, set);
    }

    function polygon(points, cls, l) {
      const node = makeEl("polygon", null, cls, where(l));
      const set = (pts) => node.setAttribute("points", pts.map((p) => p.x + "," + p.y).join(" "));
      set(points);
      return shape(node, set);
    }

    /** Arc of radius r about c, from angle a0 to a1 (radians, SVG y-down). */
    function arc(c, r, a0, a1, cls, l) {
      const node = makeEl("path", null, cls, where(l));
      const set = (center, radius, start, end) => node.setAttribute("d", arcPath(center, radius, start, end));
      set(c, r, a0, a1);
      return shape(node, set);
    }

    /** Angle arc at `vertex`, between the directions to p and q. */
    function angleArc(vertex, p, q, r, cls, l) {
      const node = makeEl("path", null, cls, where(l));
      const set = (vtx, a, b, radius) => {
        const a0 = Math.atan2(a.y - vtx.y, a.x - vtx.x);
        const a1 = Math.atan2(b.y - vtx.y, b.x - vtx.x);
        node.setAttribute("d", arcPath(vtx, radius, a0, a1));
      };
      set(vertex, p, q, r);
      return shape(node, set);
    }

    /** Small right-angle corner at `vertex` between the rays to p and q. */
    function rightAngle(vertex, p, q, size, cls, l) {
      const node = makeEl("path", null, cls, where(l));
      const set = (vtx, a, b, s) => {
        const u = dir(vtx, a, s), w = dir(vtx, b, s);
        node.setAttribute("d",
          `M ${vtx.x + u.x} ${vtx.y + u.y} L ${vtx.x + u.x + w.x} ${vtx.y + u.y + w.y} L ${vtx.x + w.x} ${vtx.y + w.y}`);
      };
      set(vertex, p, q, size);
      return shape(node, set);
    }

    function label(p, text, cls, dx, dy, l) {
      const node = makeEl("text", null, cls, where(l), text);
      const set = (at, words, offx, offy) => {
        node.setAttribute("x", at.x + (offx === undefined ? dx : offx));
        node.setAttribute("y", at.y + (offy === undefined ? dy : offy));
        if (words !== undefined) node.textContent = words;
      };
      set(p, text, dx, dy);
      return shape(node, set);
    }

    /* ---- draggable, keyboard-accessible point handles ---- */

    function handle(name, p, opts) {
      const o = opts || {};
      const r = o.r === undefined ? 10 : o.r;
      const step = o.step === undefined ? 1 : o.step;
      const shift = o.shift === undefined ? 5 : o.shift;
      const node = makeEl("circle", {
        r: r, tabindex: "0", role: o.role || "button",
        "aria-label": o.label || ("Point " + name + ". Drag it, or focus it and use the arrow keys to move it."),
      }, o.cls || "geom-handle", where(o.layer));

      const api = {
        name: name,
        node: node,
        point: { x: p.x, y: p.y },
        _move: o.onMove || function () {},
        _clamp: o.clamp || null,
        set: function (q) {
          api.point = { x: q.x, y: q.y };
          setAttrs(node, { cx: api.point.x, cy: api.point.y });
          if (o.describe) node.setAttribute("aria-label",
            (o.label || ("Point " + name)) + ". " + o.describe(api.point, name));
          return api;
        },
        onMove: function (fn) { api._move = fn; return api; },
        show: function (on) { node.style.display = on ? "" : "none"; return api; },
      };
      api.set(p);

      const keys = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      node.addEventListener("keydown", function (e) {
        const d = keys[e.key];
        if (!d) return;
        e.preventDefault();
        const s = e.shiftKey ? shift : step;
        let q = { x: api.point.x + d[0] * s, y: api.point.y + d[1] * s };
        if (api._clamp) q = api._clamp(q, name);
        api.set(q);
        api._move(api.point, name);
        node.focus(); // the port keeps the same node, so focus survives a redraw
      });

      handles.push(api);
      return api;
    }

    /* Pointer dragging is wired once for every handle on this board. */
    svg.addEventListener("pointerdown", function (e) {
      const h = handles.find((x) => x.node === e.target);
      if (!h) return;
      active = h;
      if (svg.setPointerCapture) svg.setPointerCapture(e.pointerId);
      if (e.target.focus) e.target.focus();
      e.preventDefault();
    });
    svg.addEventListener("pointermove", function (e) {
      if (!active) return;
      const q = toLocal(e.clientX, e.clientY);
      active.set(active._clamp ? active._clamp(q, active.name) : q);
      active._move(active.point, active.name);
      e.preventDefault();
    });
    const endDrag = function () { active = null; };
    svg.addEventListener("pointerup", endDrag);
    svg.addEventListener("pointercancel", endDrag);
    svg.addEventListener("lostpointercapture", endDrag);

    const api = {
      root: svg,
      viewBox: view,
      layers: layers,
      layer: layer,
      el: el,
      clear: clear,
      point: point,
      segment: segment,
      line: line,
      circle: circle,
      polygon: polygon,
      arc: arc,
      angleArc: angleArc,
      rightAngle: rightAngle,
      label: label,
      handle: handle,
      toLocal: toLocal,
      toClient: toClient,
      onTheme: onTheme,
    };
    return api;
  }

  window.Geom = {
    board: board,
    onTheme: onTheme,
    el: makeEl,
    NS: NS,
    distance: distance,
    midpoint: midpoint,
    lerp: lerp,
    clamp: clamp,
    dot: dot,
    angle: angle,
    foot: foot,
    pointOnCircle: pointOnCircle,
    lineIntersection: lineIntersection,
    circleIntersection: circleIntersection,
  };
})();
