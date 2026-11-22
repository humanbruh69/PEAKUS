import test from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateExpression,
  formatCalcNumber,
  toggleSignInExpression,
} from './calculatorEngine';

test('evaluates arithmetic with proper precedence and float precision cleanup', () => {
  assert.equal(evaluateExpression('0.1 + 0.2').formatted, '0.3');
  assert.equal(evaluateExpression('2 + 3 * 4').formatted, '14');
  assert.equal(evaluateExpression('(2 + 3) * 4').formatted, '20');
  assert.equal(evaluateExpression('100 - 15%').formatted, '99.85');
  assert.equal(evaluateExpression('2^3^2').formatted, '512');
});

test('handles implicit multiplication and constants', () => {
  assert.equal(evaluateExpression('2(3+4)').formatted, '14');
  assert.equal(evaluateExpression('(2+1)(3+2)').formatted, '15');
  assert.equal(evaluateExpression('2π').value?.toFixed(4), (2 * Math.PI).toFixed(4));
  assert.equal(evaluateExpression('ans * 3', 'DEG', 12).formatted, '36');
});

test('handles scientific functions in DEG and RAD modes', () => {
  assert.equal(evaluateExpression('sin(30)', 'DEG').formatted, '0.5');
  assert.equal(evaluateExpression('cos(0)', 'DEG').formatted, '1');
  assert.equal(evaluateExpression('sin(π / 2)', 'RAD').formatted, '1');
  assert.equal(evaluateExpression('√(144)').formatted, '12');
  assert.equal(evaluateExpression('log(1000)').formatted, '3');
  assert.equal(evaluateExpression('ln(e)').formatted, '1');
});

test('returns safe descriptive errors for invalid inputs', () => {
  const divZero = evaluateExpression('10 / 0');
  assert.equal(divZero.ok, false);
  assert.match(divZero.error || '', /zero/i);

  const negSqrt = evaluateExpression('√(-4)');
  assert.equal(negSqrt.ok, false);

  const unclosed = evaluateExpression('(2 + 3');
  assert.equal(unclosed.ok, false);
});

test('toggles sign cleanly and formats large/small floats', () => {
  assert.equal(toggleSignInExpression('42'), '-42');
  assert.equal(toggleSignInExpression('-42'), '42');
  assert.equal(toggleSignInExpression('10+5'), '10+(-5)');
  assert.equal(toggleSignInExpression('10+(-5)'), '10+5');
  assert.equal(formatCalcNumber(-0), '0');
});
