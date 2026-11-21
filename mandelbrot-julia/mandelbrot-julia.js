"use strict";

/* Browser UI: click the Mandelbrot set to choose c, see its Julia set. */
(() => {
  const C = MandelbrotJuliaCore;
  const mandelCanvas = document.getElementById("mandelbrot");
  const juliaCanvas = document.getElementById("julia");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const iterInput = document.getElementById("iterInput");
  const resetBtn = document.getElementById("resetBtn");
  let state = null;

  function paint(canvas, values, maxIter) {
    const ctx = canvas.getContext("2d");
    const image = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < values.length; i++) {
      const k = values[i];
      const inside = k >= maxIter;
      const hue = inside ? 0 : Math.round(210 + 150 * k / maxIter) % 360;
      const light = inside ? 0.12 : 0.35 + 0.45 * k / maxIter;
      const [r, g, b] = hslToRgb(hue, inside ? 0 : 0.75, light);
      image.data[i * 4] = r;
      image.data[i * 4 + 1] = g;
      image.data[i * 4 + 2] = b;
      image.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
  }

  function hslToRgb(h, s, l) {
    const k = (n) => (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
    return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
  }

  function render() {
    const maxIter = state.maxIter;
    paint(mandelCanvas, C.render(mandelCanvas.width, mandelCanvas.height, C.MANDELBROT_BOUNDS, state.c, maxIter, "mandelbrot"), maxIter);
    paint(juliaCanvas, C.render(juliaCanvas.width, juliaCanvas.height, C.JULIA_BOUNDS, state.c, maxIter, "julia"), maxIter);
    const r = C.analyze(state);
    iterInput.value = String(maxIter);
    readout.textContent = `c = ${state.c.re.toFixed(2)} ${state.c.im < 0 ? "−" : "+"} ${Math.abs(state.c.im).toFixed(2)}i · escape time ${r.mandelbrotEscape >= maxIter ? "bounded" : r.mandelbrotEscape}`;
    status.textContent = r.inMandelbrotSet
      ? `This c lies in the Mandelbrot set, so the orbit of 0 stays bounded. Its Julia set is connected.`
      : `This c escapes after ${r.mandelbrotEscape} steps, so its Julia set is a scattered dust.`;
    status.className = "done";
    if (window.Track) window.Track.state({
      c: { ...state.c }, maxIter,
      inMandelbrotSet: r.inMandelbrotSet, escape: r.mandelbrotEscape,
    });
  }

  mandelCanvas.addEventListener("click", (ev) => {
    const box = mandelCanvas.getBoundingClientRect();
    const px = (ev.clientX - box.left) * mandelCanvas.width / box.width;
    const py = (ev.clientY - box.top) * mandelCanvas.height / box.height;
    state = C.setC(state, C.fromMandelbrotPixel(px, py, mandelCanvas.width, mandelCanvas.height));
    render();
  });
  iterInput.addEventListener("input", () => {
    state = C.setIterations(state, Number(iterInput.value));
    render();
  });
  resetBtn.addEventListener("click", () => { state = C.start(); render(); });

  state = C.start();
  render();
})();
