// Grades one wording on one Kane version from its two verdicts.
export const STATES = ['CORRECT', 'FIXED_BY_WORDING', 'FALSE_GREEN', 'FALSE_RED', 'ERROR', 'NOT_RUN'];

export function gradeWording(verdicts, expected = { correct: 'PASS', broken: 'FAIL' }) {
  const c = verdicts?.correct;
  const b = verdicts?.broken;
  if (!c || !b) return 'NOT_RUN';
  if (c === 'ERROR' || b === 'ERROR') return 'ERROR';
  const brokenRight = b === expected.broken;
  const correctRight = c === expected.correct;
  if (brokenRight && correctRight) return 'CORRECT';
  if (!brokenRight) return 'FALSE_GREEN';
  return 'FALSE_RED';
}

// A behavior's cell for one version: the first wording (baseline) decides unless it's wrong
// and another wording is right, in which case the behavior is fixable by wording.
export function gradeBehavior(wordingStates) {
  const entries = Object.entries(wordingStates).filter(([, s]) => s !== 'NOT_RUN');
  if (!entries.length) return { state: 'NOT_RUN', recommended: null };
  const [baseId, baseState] = entries[0];
  if (baseState === 'CORRECT') return { state: 'CORRECT', recommended: baseId };
  const fix = entries.find(([, s]) => s === 'CORRECT');
  if (fix && baseState !== 'ERROR') return { state: 'FIXED_BY_WORDING', recommended: fix[0] };
  if (fix) return { state: 'CORRECT', recommended: fix[0] };
  return { state: baseState, recommended: null };
}
