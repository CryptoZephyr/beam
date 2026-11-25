// Matches a Kane objective against beam.json without any network or model call.
const STOP = new Set('the a an is are be of to in on and or that this it its with for as at by into from verify assert check shows show'.split(' '));

export const tokens = (s) => String(s).toLowerCase().replace(/["'“”‘’.,:;!?()]/g, ' ').split(/\s+/).filter((t) => t && !STOP.has(t));

function similarity(a, b) {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  if (!A.size || !B.size) return 0;
  let n = 0;
  for (const t of A) if (B.has(t)) n++;
  return n / Math.max(A.size, B.size);
}

// Returns {kind: 'known-wrong'|'related'|'none', behavior, wording, score}
export function checkObjective(objective, data) {
  let best = { kind: 'none', score: 0 };
  for (const b of data.behaviors) {
    for (const a of b.avoidWordings || []) {
      const s = similarity(objective, a.text);
      if (s > best.score && s >= 0.75) best = { kind: 'known-wrong', behavior: b, wording: a, score: s };
    }
  }
  if (best.kind === 'known-wrong') return best;
  for (const b of data.behaviors) {
    const s = Math.max(...[b.title, b.summary, ...(b.tags || [])].map((x) => similarity(objective, x)), ...b.wordings.map((w) => similarity(objective, w.text)));
    if (s > best.score && s >= 0.4) best = { kind: 'related', behavior: b, score: s };
  }
  return best;
}
