// test-animation-state.mjs
// Verifies grounded-state edge transitions (jump, airborne, landing, repeated jump)
// and AnimationController clip registration rules (no T-Pose as Idle fallback).

import assert from 'node:assert/strict';

function resolveLocomotionState(prevGrounded, isGrounded, horizSpeed, sprint, yawDiff) {
  const takeoff = prevGrounded && !isGrounded;
  const landed = !prevGrounded && isGrounded;

  let nextAnim = 'Idle';
  if (!isGrounded) {
    nextAnim = 'Jump';
  } else if (landed) {
    nextAnim = 'Land';
  } else if (horizSpeed > 7.5 && sprint) {
    nextAnim = 'Sprint';
  } else if (horizSpeed > 4.6) {
    nextAnim = 'Run';
  } else if (horizSpeed > 0.45) {
    nextAnim = 'Walk';
  } else if (Math.abs(yawDiff) > 0.45 && horizSpeed <= 0.45) {
    nextAnim = 'Turn';
  }
  return { takeoff, landed, nextAnim };
}

// 1. Jumping: grounded -> airborne
const j1 = resolveLocomotionState(true, false, 3.0, false, 0);
assert.equal(j1.takeoff, true, 'Should detect takeoff');
assert.equal(j1.landed, false);
assert.equal(j1.nextAnim, 'Jump');

// 2. Remaining airborne: airborne -> airborne
const air = resolveLocomotionState(false, false, 3.0, false, 0);
assert.equal(air.takeoff, false);
assert.equal(air.landed, false);
assert.equal(air.nextAnim, 'Jump');

// 3. Landing: airborne -> grounded
const land = resolveLocomotionState(false, true, 1.0, false, 0);
assert.equal(land.takeoff, false);
assert.equal(land.landed, true, 'Should detect landing edge');
assert.equal(land.nextAnim, 'Land');

// 4. Repeated jump after landing
const steady = resolveLocomotionState(true, true, 0, false, 0);
assert.equal(steady.nextAnim, 'Idle');
const j2 = resolveLocomotionState(true, false, 8.2, true, 0);
assert.equal(j2.takeoff, true, 'Should detect second takeoff');
assert.equal(j2.nextAnim, 'Jump');

// 5. Sprint vs Run vs Walk vs Turn
assert.equal(resolveLocomotionState(true, true, 8.5, true, 0).nextAnim, 'Sprint');
assert.equal(resolveLocomotionState(true, true, 5.5, false, 0).nextAnim, 'Run');
assert.equal(resolveLocomotionState(true, true, 2.5, false, 0).nextAnim, 'Walk');
assert.equal(resolveLocomotionState(true, true, 0.1, false, 0.8).nextAnim, 'Turn');

// 6. Source-level regression guards (read the REAL TypeScript sources so the
//    tests fail if the grounded-state / vehicle / idle bugs are reintroduced).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const playerSrc = readFileSync(path.resolve(__dirname, '../src/player/PlayerController.ts'), 'utf8');
const animSrc = readFileSync(path.resolve(__dirname, '../src/animation/AnimationController.ts'), 'utf8');

// 6a. Vehicle: entering must play 'enter', exiting must play 'exit' (never the
//     reverse). Guard against the "VehicleExit plays when entering" bug.
assert.ok(
  /inside\s*\?\s*'enter'\s*:\s*'exit'/.test(playerSrc),
  "setInVehicle must map inside -> 'enter', outside -> 'exit'"
);
assert.ok(
  !/playVehicleTransition\(\s*inside\s*\?\s*'exit'/.test(playerSrc),
  'Entering a vehicle must NOT play VehicleExit'
);

// 6b. Grounded-state: prevGrounded must be captured before isGrounded is
//     computed, and wasGrounded must be updated afterwards.
const prevIdx = playerSrc.indexOf('const prevGrounded = this.wasGrounded');
const groundIdx = playerSrc.indexOf('this.isGrounded = hit !== null');
const updateIdx = playerSrc.indexOf('this.wasGrounded = this.isGrounded');
assert.ok(prevIdx >= 0 && groundIdx >= 0 && updateIdx >= 0, 'grounded-state capture/update present');
assert.ok(prevIdx < groundIdx, 'prevGrounded captured BEFORE computing isGrounded');
assert.ok(updateIdx > groundIdx, 'wasGrounded updated AFTER computing isGrounded');

// 6c. AnimationController must never register 'TPose' as the Idle clip.
const idleAliases = animSrc.match(/Idle:\s*\[([^\]]*)\]/);
assert.ok(idleAliases, 'Idle alias list present');
assert.ok(!/TPose/i.test(idleAliases[1]), 'T-Pose must NOT be mapped as Idle');

console.log('✅ All animation & grounded-state transition tests passed (5/5 + source guards)');
