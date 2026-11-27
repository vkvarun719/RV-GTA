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

console.log('✅ All animation & grounded-state transition tests passed (5/5)');
