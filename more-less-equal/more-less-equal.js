"use strict";

/*
 * The page for More, Less or Equal: drawing and input only. The sign is
 * worked out in more-less-equal-core.js. The stage shows the equation in
 * large type: each of the three numbers has a + button above it and a −
 * button below it, and clicking the number itself works as in the applet
 * (right half up, left half down). Holding a button repeats, like dragging
 * the mouse over a number in the applet. The radio buttons pick the
 * operation.
 */

(function () {
  const Core = MoreLessEqualCore;
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const signEl = document.getElementById("sign");
  const opEl = document.getElementById("op");
  const nums = { a: document.getElementById("num-a"), b: document.getElementById("num-b"), c: document.getElementById("num-c") };

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const WORD = { ">": "is more than", "<": "is less than", "=": "is equal to" };
  const NAME = { "+": "plus", "-": "minus", "x": "times", "/": "divided by" };

  function render() {
    nums.a.textContent = String(state.a);
    nums.b.textContent = state.b < 0 ? `(${state.b})` : String(state.b);
    nums.c.textContent = String(state.c);
    opEl.textContent = Core.SYMBOL[state.op];
    const rel = Core.relation(state);
    signEl.textContent = rel === "<>" ? "≠" : rel;
    signEl.className = "sign " + (rel === "=" ? "eq" : rel === "<>" ? "none" : "ineq");
    for (const k of ["a", "b", "c"]) nums[k].setAttribute("aria-label", `${state[k]}. Click the right half to add one, the left half to take one away`);
    const left = `${state.a} ${NAME[state.op]} ${state.b < 0 ? `(${state.b})` : state.b}`;
    if (rel === "<>") say(`${left} has no value: you cannot divide by zero, so it cannot be compared with ${state.c}.`);
    else {
      say(`${left} is ${Core.leftValue(state)}, which ${WORD[rel]} ${state.c}.`);
    }
    if (window.Track) window.Track.state(state);
  }

  function nudge(which, delta) {
    const next = Core.nudge(state, which, delta);
    if (next) { state = next; render(); }
  }

  /** Press and hold repeats, as dragging over a number did in the applet. */
  function holdable(el, action) {
    let t1 = null, t2 = null;
    const stop = () => { clearTimeout(t1); clearInterval(t2); t1 = t2 = null; };
    el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      action(e);
      t1 = setTimeout(() => { t2 = setInterval(() => action(e), 80); }, 400);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => el.addEventListener(ev, stop));
    // Keyboard and assistive clicks arrive as click with no pointer.
    el.addEventListener("click", (e) => { if (e.detail === 0) action(e); });
  }

  document.querySelectorAll("[data-nudge]").forEach((btn) => {
    const [which, d] = btn.dataset.nudge.split(":");
    holdable(btn, () => nudge(which, Number(d)));
  });
  for (const k of ["a", "b", "c"]) {
    holdable(nums[k], (e) => {
      if (e.detail === 0 && e.type === "click") return nudge(k, 1);
      const r = nums[k].getBoundingClientRect();
      nudge(k, e.clientX > r.left + r.width / 2 ? 1 : -1);
    });
    nums[k].addEventListener("keydown", (e) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); nudge(k, 1); }
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); nudge(k, -1); }
    });
  }
  document.querySelectorAll('input[name="op"]').forEach((el) =>
    el.addEventListener("change", () => { state = Core.setOp(state, el.value); render(); }));
  resetBtn.addEventListener("click", () => {
    state = Core.start({ op: state.op });
    render();
  });

  render();
})();
