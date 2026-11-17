"use strict";

/*
 * Solitaire in Two Colors - the page: drawing and input only.
 *
 * The rules live in two-color-solitaire-core.js. This file draws the circle of
 * cards as an SVG, deals a fresh shuffle of the two halves, turns a click on
 * a pink dot into the core's parity test, and keeps the status line. The board
 * is one focusable SVG: the arrow keys move a ring from gap to gap and Enter
 * clicks the gap under it.
 */

(() => {
  const C = TwoColorSolitaireCore;
  const SVG = "http://www.w3.org/2000/svg";
  const CX = 100, CY = 100, RADIUS = 72;

  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const lineEl = document.getElementById("line");
  const nInput = document.getElementById("nInput");
  const newBtn = document.getElementById("newBtn");

  let state = null;
  let cursor = 0; // the gap index the keyboard ring is on

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose");
    if (kind) statusEl.classList.add(kind);
  }

  /** Fisher-Yates, for one half of the deck. */
  function shuffle(values) {
    const a = values.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** The applet's deal: shuffle each half, then interleave them. */
  function dealtOrder(n) {
    const half = n / 2;
    const red = shuffle([...Array(half)].map((_, i) => i + 1));
    const blue = shuffle([...Array(half)].map((_, i) => half + i + 1));
    const order = [];
    for (let k = 0; k < half; k++) order.push(red[k], blue[k]);
    return order;
  }

  function deal(n) {
    state = C.start({ n, order: dealtOrder(n) });
    cursor = 0;
    render();
    say("Click a pink dot between two numbers of the same kind — both odd or both even.");
  }

  function cardRadius(n) {
    return Math.min(13, Math.max(7, 300 / n));
  }

  function gapRadius(n) {
    return Math.min(4, Math.max(2.4, 110 / n));
  }

  function render() {
    const n = state.n;
    const m = state.order.length;
    const dotR = cardRadius(n);
    const gapR = gapRadius(n);
    const parts = [];

    // The circle the cards sit on.
    parts.push(el("circle", { cx: CX, cy: CY, r: RADIUS, class: "rail" }));

    const gaps = el("g", { class: "gaps" });
    for (let i = 0; i < m; i++) {
      const angle = ((i + 0.5) * 2 * Math.PI) / m - Math.PI / 2;
      const gx = CX + RADIUS * Math.cos(angle);
      const gy = CY + RADIUS * Math.sin(angle);
      const g = el("g", { class: "gap", "data-index": String(i) });
      g.appendChild(el("circle", { cx: gx, cy: gy, r: gapR, class: "gap-dot" }));
      // A wider invisible target for fingers, still not overlapping its neighbours.
      g.appendChild(el("circle", { cx: gx, cy: gy, r: Math.min(9, 160 / m), class: "gap-hit" }));
      g.addEventListener("click", () => clickGap(i));
      gaps.appendChild(g);
    }
    parts.push(gaps);

    // The keyboard ring, drawn only while the board has focus.
    if (m > 0) {
      const angle = ((cursor + 0.5) * 2 * Math.PI) / m - Math.PI / 2;
      const gx = CX + RADIUS * Math.cos(angle);
      const gy = CY + RADIUS * Math.sin(angle);
      parts.push(el("circle", { cx: gx, cy: gy, r: gapR + 3.5, class: "cursor" }));
    }

    const cards = el("g", { class: "cards" });
    for (let i = 0; i < m; i++) {
      const value = state.order[i];
      const angle = (i * 2 * Math.PI) / m - Math.PI / 2;
      const x = CX + RADIUS * Math.cos(angle);
      const y = CY + RADIUS * Math.sin(angle);
      const red = C.colorOf(n, value) === "red";
      cards.appendChild(el("circle", {
        cx: x, cy: y, r: dotR, class: red ? "card red" : "card blue",
      }));
      const label = el("text", {
        x, y: y + dotR * 0.03, class: "num", "font-size": dotR * 1.1,
      });
      label.textContent = String(value);
      cards.appendChild(label);
    }
    parts.push(cards);

    svg.replaceChildren(...parts);
    svg.setAttribute("aria-label",
      m === 0
        ? "The circle is empty."
        : `Circle of ${m} cards. The gap cursor is on gap ${cursor + 1} of ${m}. Use the arrow keys and Enter to remove a pair.`);

    const removed = n - m;
    lineEl.textContent = m === 0
      ? `${n} cards dealt · all removed`
      : `${n} cards dealt · ${removed / 2} pair${removed === 2 ? "" : "s"} removed · ${m} left`;

    // The position, for the player's record and the tutor (assets/progress.js).
    if (window.Track) window.Track.state({ n, order: state.order.slice() });
  }

  function clickGap(i) {
    const pair = C.pairAt(state, i);
    if (!pair) return;
    const next = C.removePair(state, i);
    if (!next) {
      cursor = i;
      render();
      say(`${pair.a} is ${C.parityOf(pair.a)} while ${pair.b} is ${C.parityOf(pair.b)} — only two odds or two evens can go.`);
      svg.focus();
      return;
    }
    state = next;
    cursor = 0;
    render();

    const outcome = C.result(state);
    if (outcome === "win") {
      say(`Every card is gone — the magic trick worked. ${pair.a} and ${pair.b} were the last pair.`, "win");
    } else if (outcome === "lose") {
      say(`No two neighbours share a parity: the game is stuck with ${state.order.length} cards left. New deal to try again.`, "lose");
    } else {
      say(`Removed ${pair.a} and ${pair.b}. ${state.order.length} cards left.`);
    }
    svg.focus();
  }

  for (let n = C.MIN_N; n <= C.MAX_N; n += 2) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = `${n} cards`;
    if (n === C.DEFAULT_N) o.selected = true;
    nInput.appendChild(o);
  }

  newBtn.addEventListener("click", () => deal(Number(nInput.value)));
  nInput.addEventListener("change", () => deal(Number(nInput.value)));

  svg.addEventListener("keydown", (e) => {
    const m = state.order.length;
    if (m === 0) return;
    switch (e.key) {
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        cursor = (cursor - 1 + m) % m;
        render();
        break;
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        cursor = (cursor + 1) % m;
        render();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        clickGap(cursor);
        break;
      default:
        break;
    }
  });

  deal(C.DEFAULT_N);
})();
