"use strict";

/*
 * Browser UI for Number Guessing. All the rules live in cards-core.js.
 *
 * The card is drawn on a canvas as a ten-column grid of numbers, like the
 * applet's printed card. A visually hidden paragraph says the same numbers in
 * words for screen readers (and for the play scenario). Yes and No are real
 * buttons, so mouse, touch and keyboard all work; focus stays on the button
 * that was pressed. The site's colour tokens are read at draw time and the
 * card is redrawn whenever the theme changes.
 */

(function () {
  const Core = CardsCore;
  const el = (id) => document.getElementById(id);
  const canvas = el("cardCanvas");
  const ctx = canvas.getContext("2d");
  const cardLabel = el("cardLabel");
  const cardText = el("cardText");
  const statusEl = el("status");
  const resetBtn = el("resetBtn");
  const yesBtn = el("yesBtn");
  const noBtn = el("noBtn");

  // The applet's bit positions, from the right: 1, 2, 4, ..., 64.
  const PLACES = ["ones", "twos", "fours", "eights", "sixteens", "thirty-twos", "sixty-fours"];

  let state = null;
  let last = null; // { answer, shownBit, digit, cardNo } for the status sentence

  /** Show a line under the game. "done" also tells the record the demo ended. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The shared colours, read from the site's tokens at draw time. */
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const token = (name) => cs.getPropertyValue(name).trim();
    return {
      card: token("--card"),
      border: token("--border-strong"),
      ink: token("--ink"),
      accent: token("--accent"),
      highlight: token("--highlight"),
    };
  }

  function roundedRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /** Draw the current card: a bordered card with the numbers in ten columns. */
  function draw() {
    const tok = readTokens();
    const w = canvas.width;
    const h = canvas.height;
    const cellW = w / Core.COLS;
    const cellH = (h - 8) / 10;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = tok.card;
    roundedRect(2, 2, w - 4, h - 4, 12);
    ctx.fill();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = tok.border;
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    if (state.done) {
      // The applet replaces the card with its "Your number is" announcement.
      ctx.fillStyle = tok.accent;
      ctx.font = `600 ${Math.round(w * 0.075)}px ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(Core.reveal(state), w / 2, h / 2);
      return;
    }

    const nums = Core.cardNumbers(state, { max: Core.MAX });
    ctx.fillStyle = tok.ink;
    ctx.font = `600 ${Math.round(cellW * 0.42)}px ui-sans-serif, system-ui, sans-serif`;
    for (const n of nums) {
      const col = n % Core.COLS;
      const row = Math.floor(n / Core.COLS);
      const x = col * cellW + cellW / 2;
      const y = 4 + row * cellH + cellH / 2;
      ctx.fillText(String(n), x, y);
    }
  }

  /** A sentence saying, in words, what the last answer changed. */
  function statusText() {
    if (state.done) {
      return last
        ? last.sentence + " That is all seven digits. " + Core.reveal(state) + "."
        : Core.reveal(state) + ".";
    }
    if (!last) return "Think of a number from 1 to 99. Is it on this card? Press Yes or No.";
    return last.sentence + " That is " + state.cardNo + " of 7 digits.";
  }

  function render() {
    const nums = Core.cardNumbers(state, { max: Core.MAX });
    cardLabel.textContent = state.done
      ? "All seven cards have been shown"
      : "Card " + (state.cardNo + 1) + " of 7";
    cardText.textContent = state.done
      ? "All seven cards have been shown. Your number is " + state.guess + "."
      : "Card " + (state.cardNo + 1) + " of 7. The numbers on the card are: " + nums.join(", ") + ".";
    const finished = state.done;
    yesBtn.disabled = finished;
    noBtn.disabled = finished;
    draw();

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        cardNo: state.cardNo,
        result: state.result,
        bit: state.bit,
        done: state.done,
        guess: state.guess,
        card: nums,
        max: Core.MAX,
      });
    }
  }

  function play(next, answerValue, shownBit) {
    const digit = answerValue === "Yes" ? shownBit : 1 - shownBit;
    const place = PLACES[state.cardNo];
    const sentence = "You said " + answerValue + ". The card showed numbers with a " +
      shownBit + " in the " + place + " place, so I recorded " + digit + " there.";
    state = next;
    last = { answer: answerValue, shownBit, digit, cardNo: state.cardNo - 1, sentence };
    render();
    if (Core.result(state) === "done") say(statusText(), "done");
    else say(statusText());
  }

  function answer(answerValue) {
    if (state.done) return;
    const shownBit = state.bit;
    const next = Core.answer(state, answerValue);
    if (next) play(next, answerValue, shownBit);
  }

  function reset() {
    state = Core.start({});
    last = null;
    render();
    say(statusText());
  }

  resetBtn.addEventListener("click", reset);
  yesBtn.addEventListener("click", () => answer("Yes"));
  noBtn.addEventListener("click", () => answer("No"));
  window.addEventListener("themechange", draw);

  reset();
})();
