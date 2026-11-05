#!/usr/bin/env node
"use strict";

/*
 * Logic test for eye-opener/eye-opener-core.js.
 *
 * The paradox: an (n+1) by (n-1) rectangle has area n^2 - 1, and the square it
 * supposedly turns into has area n^2. One square appears from nowhere.
 *
 * The port reproduces the applet's trick rather than a real dissection, so the
 * test pins down both halves of it:
 *
 *   - before the cheat, the two pieces exactly tile the rectangle: their areas
 *     sum to n^2 - 1 and neither overlaps nor leaves a gap;
 *   - the cheat adds a strip n wide and 1/n tall, which is exactly the one
 *     missing square, taking the total to n^2.
 *
 * Checked for every board size the UI offers, so there is no n where the
 * arithmetic quietly stops working.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const E = loadCore("eye-opener/eye-opener-core.js", "EyeOpener");

const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;

check("the size range is the applet's", E.MIN_N === 5 && E.MAX_N === 25, `${E.MIN_N}..${E.MAX_N}`);

for (let n = E.MIN_N; n <= E.MAX_N; n++) {
  const rectArea = (n + 1) * (n - 1); // = n^2 - 1
  const squareArea = n * n;

  /* ----------------------------------------- 1. the pieces tile the rectangle */

  const lower = E.area(E.lowerPolygon(n));
  const upperFlat = E.area(E.upperPolygon(n, 0, 0, 0));
  check(
    `n=${n}: the two pieces make up the ${n + 1} by ${n - 1} rectangle (${rectArea})`,
    near(lower + upperFlat, rectArea),
    `lower ${lower} + upper ${upperFlat} = ${lower + upperFlat}, expected ${rectArea}`,
  );

  /* ------------------------------------------------- 2. the step is (n-1)/n */

  check(`n=${n}: each step is (n-1)/n tall`, near(E.step(n), (n - 1) / n));

  /* ---------------------------------- 3. the fitted position is (1, -(n-1)/n) */

  const t = E.target(n);
  check(`n=${n}: the piece fits one right and one step up`, near(t.dx, 1) && near(t.dy, -E.step(n)));

  /* ------------------------------------ 4. the cheat is exactly one square */

  const fullCheat = E.cheat(n, -1); // lifted well past the threshold
  check(`n=${n}: the cheat tops out at 1/n`, near(fullCheat, 1 / n), `got ${fullCheat}`);

  const upperCheated = E.area(E.upperPolygon(n, t.dx, t.dy, fullCheat));
  check(
    `n=${n}: with the cheat the pieces cover the ${n} by ${n} square (${squareArea})`,
    near(lower + upperCheated, squareArea),
    `lower ${lower} + upper ${upperCheated} = ${lower + upperCheated}, expected ${squareArea}`,
  );
  check(
    `n=${n}: the cheat adds exactly one square`,
    near(upperCheated - upperFlat, 1),
    `added ${upperCheated - upperFlat}`,
  );

  /* ---------------------------------- 5. no cheat until the piece is lifted */

  equal(`n=${n}: resting piece is not stretched`, E.cheat(n, 0), 0);
  equal(`n=${n}: a small lift is not stretched`, E.cheat(n, -0.3), 0);
  check(`n=${n}: the stretch is monotone`, E.cheat(n, -0.5) >= E.cheat(n, -0.4));

  /* ----------------------------------------------------- 6. snapping into place */

  const nearly = E.snap(n, t.dx + 0.1, t.dy + 0.1);
  check(`n=${n}: a near miss snaps home`, nearly.fitted && near(nearly.dx, t.dx) && near(nearly.dy, t.dy));
  const far = E.snap(n, t.dx + 0.5, t.dy);
  check(`n=${n}: a clear miss does not snap`, !far.fitted);

  /* -------------------------------------------------------- 7. clamping sizes */

  equal(`n=${n}: clampN leaves a valid size alone`, E.clampN(n), n);
}

equal("clampN pulls a small size up", E.clampN(1), E.MIN_N);
equal("clampN pulls a large size down", E.clampN(999), E.MAX_N);

done("check-eye-opener");
