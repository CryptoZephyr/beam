// results + manifests → beam.json, the one file the site, the skill and `kane-beam check` read.
import fs from 'node:fs';
import { loadBehaviors } from './behaviors.mjs';
import { loadResults } from './results.mjs';
import { gradeBehavior } from './grade.mjs';
import { DATA_FILE } from './paths.mjs';

const ISSUE_URL = (n) => `https://github.com/LambdaTest/kane-cli/issues/${n}`;

function cmpVersion(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pb[i] - pa[i];
  return 0;
}

export function buildCompat({ write = true } = {}) {
  const results = loadResults();
  const behaviors = loadBehaviors();
  const versionSet = new Set();
  for (const b of Object.values(results.behaviors)) for (const w of Object.values(b.wordings)) for (const v of Object.keys(w.versions)) versionSet.add(v);
  const versions = [...versionSet].sort(cmpVersion);
  const reference = versions[0] || null;

  const out = {
    schema: 1,
    generated: new Date().toISOString(),
    lastRun: results.updated,
    referenceVersion: reference,
    versions,
    creditsReported: Math.round((results.runs || []).reduce((s, r) => s + (r.credits || 0), 0)),
    behaviors: [],
  };

  for (const m of behaviors) {
    const rb = results.behaviors[m.id];
    const wordings = m.wordings.map((w) => {
      const rw = rb?.wordings[w.id];
      const perVersion = {};
      for (const v of versions) {
        const rv = rw?.versions[v];
        if (!rv) continue;
        perVersion[v] = {
          state: rv.state || 'NOT_RUN',
          correct: rv.correct?.verdict || null,
          broken: rv.broken?.verdict || null,
          brokenSummary: rv.broken?.summary || null,
          correctSummary: rv.correct?.summary || null,
          codeJs: rv.broken?.codeJs || rv.correct?.codeJs || null,
          stored: { correct: rv.correct?.stored || {}, broken: rv.broken?.stored || {} },
          testUrl: rv.correct?.testUrl || rv.broken?.testUrl || null,
          at: rv.broken?.at || rv.correct?.at || null,
        };
      }
      return { id: w.id, origin: w.origin || 'baseline', text: w.text, versions: perVersion };
    });

    const cells = {};
    for (const v of versions) {
      const states = Object.fromEntries(wordings.map((w) => [w.id, w.versions[v]?.state || 'NOT_RUN']));
      const g = gradeBehavior(states);
      cells[v] = { state: g.state, recommended: g.recommended };
    }
    const ref = reference ? cells[reference] : { state: 'NOT_RUN', recommended: null };
    const recommended = ref.recommended ? wordings.find((w) => w.id === ref.recommended) : null;
    const avoid = reference ? wordings.filter((w) => ['FALSE_GREEN', 'FALSE_RED'].includes(w.versions[reference]?.state)).map((w) => ({ text: w.text, state: w.versions[reference].state })) : [];

    out.behaviors.push({
      id: m.id,
      title: m.title,
      summary: m.summary,
      whatDiffers: m.what_differs,
      tags: m.tags,
      issue: m.issue ? { number: m.issue, url: ISSUE_URL(m.issue) } : null,
      steps: m.steps || '',
      state: ref.state,
      limitation: ['FALSE_GREEN', 'FALSE_RED'].includes(ref.state),
      recommendedWording: recommended ? recommended.text : null,
      avoidWordings: avoid,
      cells,
      wordings,
      fixture: { correct: `fixtures/${m.id}/correct.html`, broken: `fixtures/${m.id}/broken.html` },
    });
  }
  const order = { FALSE_GREEN: 0, FALSE_RED: 1, FIXED_BY_WORDING: 2, ERROR: 3, CORRECT: 4, NOT_RUN: 5 };
  out.behaviors.sort((a, b) => order[a.state] - order[b.state] || a.title.localeCompare(b.title));
  if (write) fs.writeFileSync(DATA_FILE, JSON.stringify(out, null, 2) + '\n');
  return out;
}
