"use strict";

/*
 * The page for Colour Cycling on the Mandelbrot Set: drawing and input only.
 * The picture's counts are computed once; "Cycle" turns the palette one place
 * per tick (every 250 ms for Slow, every animation frame for Fast, as the
 * applet's Delay of 250 or 0) and repaints from the counts. The rules are in
 * mandel-cycle-core.js.
 */

(function () {
  const Core = MandelCycleCore;
  const canvas = document.getElementById("pic");
  const ctx = canvas.getContext("2d");
  const goBtn = document.getElementById("goBtn");
  const statusEl = document.getElementById("status");
  const counts = Core.image();
  const imageData = ctx.createImageData(Core.SIZE, Core.SIZE);

  let pal = Core.palette(), running = false, timer = 0, turns = 0, usedIt = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const direction = () => (document.getElementById("in").checked ? "in" : "out");
  const fast = () => document.getElementById("fast").checked;

  function draw() {
    imageData.data.set(Core.paint(counts, pal));
    ctx.putImageData(imageData, 0, 0);
    if (window.Track) window.Track.state({ turns, direction: direction(), fast: fast(), running });
  }

  function tick() {
    timer = 0;
    if (!running) return;
    pal = Core.rotate(pal, direction());
    turns++;
    draw();
    schedule();
  }

  function schedule() {
    const delay = Core.delayFor(fast());
    timer = delay === 0 ? requestAnimationFrame(tick) : setTimeout(tick, delay);
    timerIsFrame = delay === 0;
  }
  let timerIsFrame = false;
  function cancel() { if (timerIsFrame) cancelAnimationFrame(timer); else clearTimeout(timer); timer = 0; }

  function toggle() {
    running = !running;
    goBtn.textContent = running ? "Stop" : "Cycle";
    if (running) { usedIt = true; say("The colours are moving."); schedule(); }
    else { cancel(); say(usedIt ? "Paused: the picture is the same, only the colours have moved." : "", usedIt ? "done" : null); }
    draw();
  }

  goBtn.addEventListener("click", toggle);
  document.querySelectorAll('input[name="speed"], input[name="dir"]').forEach((el) => el.addEventListener("change", () => { if (running) { cancel(); schedule(); } draw(); }));
  draw();
})();
