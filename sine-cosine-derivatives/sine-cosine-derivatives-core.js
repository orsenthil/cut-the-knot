"use strict";

/*
 * Derivatives of Sine and Cosine, from Alexander Bogomolny's applet
 * SineCosine.
 *
 * A point P runs round the unit circle: P = (cos t, sin t). Its velocity is
 * the radius turned a quarter turn, (-sin t, cos t), drawn from P. Splitting
 * that velocity into a horizontal and a vertical arrow makes a right
 * triangle equal to the one formed by the radius and its projections, only
 * turned by 90 degrees: the vertical arrow is as long as cos t and the
 * horizontal one as long as sin t. So sin'(t) = cos(t) and cos'(t) = -sin(t).
 *
 * Transcribed from SineCosineCanvas.Draw (in unit coordinates, y up): the
 * radius from O to P, the cosine as a blue arrow from O to the foot
 * F = (cos t, 0), the sine as a red arrow from F up to P, and the velocity
 * from P to T = P + (-sin t, cos t), drawn as two arrows through a corner:
 * for (t mod 180) < 90 first the vertical (blue, cos) then the horizontal
 * (red, -sin), otherwise first the horizontal then the vertical. The angle
 * moves Step degrees per frame (Slow 2, Fast 5), a frame every 50 ms.
 *
 * This file is the game's logic and nothing else. It defines one global,
 * SineCosineDerivativesCore. The position is plain data.
 */
const SineCosineDerivativesCore = (() => {
  const STEP = { slow: 2, fast: 5 };
  const FRAME_MS = 50;

  function start(options = {}) {
    const a = Number.isFinite(Number(options.a)) ? ((Math.round(Number(options.a)) % 360) + 360) % 360 : 0;
    return { a, speed: options.speed === "fast" ? "fast" : "slow" };
  }

  /** One frame: A = (A + Step) mod 360. */
  function tick(s) {
    return { ...s, a: (s.a + STEP[s.speed]) % 360 };
  }

  /** Set the angle directly (dragging P or the arrow keys). */
  function setAngle(s, a) {
    if (!Number.isFinite(Number(a))) return null;
    return { ...s, a: ((Math.round(Number(a)) % 360) + 360) % 360 };
  }

  /** Every point and arrow of the picture, in unit coordinates with y up. */
  function picture(s) {
    const t = (s.a * Math.PI) / 180;
    const c = Math.cos(t), n = Math.sin(t);
    const O = { x: 0, y: 0 };
    const P = { x: c, y: n };
    const F = { x: c, y: 0 };
    const T = { x: c - n, y: n + c };
    const verticalFirst = s.a % 180 < 90;
    const corner = verticalFirst ? { x: P.x, y: T.y } : { x: T.x, y: P.y };
    const arrows = [
      { kind: "cos", from: O, to: F },
      { kind: "sin", from: F, to: P },
      verticalFirst ? { kind: "cos", from: P, to: corner } : { kind: "sin", from: P, to: corner },
      verticalFirst ? { kind: "sin", from: corner, to: T } : { kind: "cos", from: corner, to: T },
    ];
    return { t, cos: c, sin: n, O, P, F, T, corner, verticalFirst, arrows };
  }

  /** The angle of a point, in whole degrees 0..359 (for dragging P). */
  function angleOf(x, y) {
    return ((Math.round((Math.atan2(y, x) * 180) / Math.PI) % 360) + 360) % 360;
  }

  return { STEP, FRAME_MS, start, tick, setAngle, picture, angleOf };
})();
