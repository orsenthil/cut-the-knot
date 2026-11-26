# Geom — shared SVG drawing helper

`assets/geom.js` is a small, dependency-free global for the illustration ports
(the 900-odd geometry applets in `porting/PLAN.md`). It defines one global,
`Geom`, needs no build step and has no CSS of its own. Load it before a port's
own script, after the shared scripts:

```html
<script src="../assets/wiki-hovercard.js"></script>
<script src="../assets/progress.js"></script>
<script src="../assets/geom.js"></script>
<script src="my-illustration.js"></script>
```

## A complete minimal page

The stage holds an `<svg>` with a `viewBox`. `touch-action: none` lets a pointer
drag a handle on a touch screen without the page scrolling:

```html
<div id="stage" class="stage">
  <svg id="board" viewBox="0 0 360 240" role="group"
       aria-label="Two draggable points joined by a segment"></svg>
</div>
<div id="status" role="status" aria-live="polite"></div>
```

```css
#board { display: block; width: 100%; height: auto; touch-action: none; }
#board .bar { stroke: var(--ink); stroke-width: 3; }
#board .geom-handle { fill: var(--accent); stroke: var(--stage); stroke-width: 2; cursor: grab; }
#board .geom-handle:focus-visible { outline: none; stroke: var(--good); stroke-width: 5; }
```

```js
"use strict";
/* Drag A or B; the segment follows them. */
(() => {
  const board = Geom.board(document.getElementById("board"));
  const shapes = board.layer("shapes");                    // z-order: shapes before handles
  const A = { x: 80, y: 160 }, B = { x: 280, y: 120 };
  const bar = board.segment(A, B, "bar", shapes);

  function render() {
    bar.set(a.point, b.point);
    document.getElementById("status").textContent =
      `A is at (${Math.round(a.point.x)}, ${Math.round(a.point.y)}).`;
    if (window.Track) window.Track.state({ A: a.point, B: b.point });
  }
  const a = board.handle("A", A, { step: 5, onMove: render });
  const b = board.handle("B", B, { step: 5, onMove: render });
  render();
})();
```

That is the whole port: two focusable handles, arrow-key movement, pointer
dragging mapped through the `viewBox`, and a shared `.stage`.

## API

`Geom.board(svgOrId)` returns a board:

- `board.layer(name)` — create/get a named `<g>` layer. Create layers in the
  order you want them painted (e.g. `grid`, `shapes`, `handles`). Pass a layer
  as the last argument of any helper, or omit it to append to the `<svg>`.
- `board.el(tag, attrs, cls, layer, text)` — raw SVG element, for anything the
  helpers do not cover. `board.clear(layer)` empties a layer.
- `board.point(p, cls, r, layer)`, `board.segment(p, q, cls, layer)`,
  `board.line(p, q, cls, layer)` (clipped to the `viewBox`),
  `board.circle(c, r, cls, layer)`, `board.polygon(points, cls, layer)`,
  `board.arc(c, r, start, end, cls, layer)` (angles in radians),
  `board.angleArc(vertex, p, q, r, cls, layer)`,
  `board.rightAngle(vertex, p, q, size, cls, layer)`,
  `board.label(p, text, cls, dx, dy, layer)`.
  Each returns `{ node, set(...), show(on) }`; call `.set(...)` on every redraw
  rather than rebuilding the element, so focus on a handle is kept.
- `board.handle(name, p, opts)` — a draggable, focusable dot. Options: `r`
  (visual and hit radius, default 10), `step` (arrow-key step, default 1),
  `shift` (step multiplier, default 5), `label` (aria-label), `cls` (default
  `geom-handle`), `layer`, `role` (default `button`), `clamp(q, name)`,
  `describe(point, name)` (spoken position) and `onMove(point, name)`. The
  handle has `.point`, `.set(p)`, `.onMove(fn)` and `.show(on)`.
- `board.toLocal(clientX, clientY)` and `board.toClient(p)` — convert between
  client pixels and `viewBox` user units in both directions. Use `toLocal` in
  your own pointer handlers; never use raw `e.clientX`/`clientY` as board
  coordinates.
- `board.onTheme(fn, immediate)` — run `fn` on the site's `themechange` event
  and on an OS dark-mode change; it returns an unsubscribe function.

Pure utilities on `Geom` itself (usable from a DOM-free core): `distance(p,q)`,
`midpoint(p,q)`, `lerp(p,q,t)`, `clamp(v,lo,hi)`, `dot(a,b)`,
`pointOnCircle(c,r,angle)`, `angle(v,p,q)` (radians in `[0,PI]`),
`foot(p,a,b)`, `lineIntersection(a,b,c,d)` (null if parallel) and
`circleIntersection(c1,r1,c2,r2)` (0, 1 or 2 points). `Geom.el(...)` and
`Geom.NS` are exposed for raw element creation.

## Rules

- **Colours come from tokens, never from Geom.** Geom sets geometry attributes
  and classes only — no `fill`, `stroke` or inline colour. Style each class in
  the page's own `<style>` with custom properties from `assets/site.css`:
  `--ink` for outlines, `--accent` for selection and highlights, `--muted` for
  guide lines, `--good`/`--bad` for right/wrong, `--highlight` for "just
  happened", `--stage` for a fill that must match the panel, `--text` for
  labels. Fixed colours are fine only for an object's own palette.
- **Name the handles for screen readers.** Every handle already has `tabindex`
  and a default aria-label saying it can be dragged or moved with the arrow
  keys. Override `label:` only to keep that useful wording, and use `describe:`
  if the point's position should be spoken. If a port rebuilds the SVG, restore
  focus to the moved handle.
- **Scale and accessibility.** Give the `<svg>` `width: 100%; height: auto`
  and let the `viewBox` do the scaling; it must fit at 375px and at twice the
  text size. Keep the label class `pointer-events: none`. Use `role="group"`
  and an `aria-label` on the `<svg>`, and keep the status line on `#status`
  with `aria-live="polite"` so the progress tracker sees the result.
- **Save the position for the tutor.** Call `window.Track.state(position)` from
  your `render()` as the other illustrated ports do; the position should be the
  points in board units, not screen pixels.

## Deliberately left to each port

Geom does not decide what a picture *means*: no snapping to a grid, no
constraints beyond an optional `clamp`, no dragging of whole shapes (only
point handles), no undo/history, no animation loop, and no domain-specific
math beyond the small utilities above. It also does not create the `<svg>` or
touch `#status`/`Track` — the port owns the page, the rules and the math text.
Ports that need a canvas rather than SVG should keep using the canvas pattern
in `coordinates/` or `distance-to-line/`.
