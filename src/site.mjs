// beam.json → a static site (and, with lab: true, the same pages with lab controls).
import fs from 'node:fs';
import path from 'node:path';
import { buildCompat } from './compat.mjs';
import { ROOT, SITE_DIR } from './paths.mjs';

export const SITE_URL = process.env.BEAM_SITE_URL || 'https://kane-beam.vercel.app';
const INSTALL = 'npx kane-beam install';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const STATE_LABEL = {
  CORRECT: 'True',
  FIXED_BY_WORDING: 'True with wording',
  FALSE_GREEN: 'False green',
  FALSE_RED: 'False red',
  ERROR: "Couldn't run",
  NOT_RUN: 'Not run',
};
const STATE_HELP = {
  CORRECT: 'Kane passed the correct page and failed the broken one, with the first wording.',
  FIXED_BY_WORDING: 'The first wording got it wrong. Another wording, shown on the page, gets it right.',
  FALSE_GREEN: 'Kane passed the broken page. No wording tried so far fixes it.',
  FALSE_RED: 'Kane failed the correct page. No wording tried so far fixes it.',
  ERROR: "Kane couldn't finish the run. Not counted as right or wrong.",
  NOT_RUN: 'Not run on this version yet.',
};

// The beam reading: glyph + word, never colour alone (DESIGN_SYSTEM.md section 7).
export function beamGlyph(state) {
  const beam = state === 'FALSE_GREEN' ? 'M2 7.6 18 3.4l.4 1.5L2.4 9.1z' : state === 'FALSE_RED' ? 'M2 3.4l16 4.2-.4 1.5L1.6 4.9z' : 'M2 5h16v1.6H2z';
  const dashed = state === 'ERROR';
  const body = state === 'NOT_RUN' ? '' : dashed ? '<path class="beam" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 1.5" d="M2.5 5.3h15"/>' : '<path class="beam" fill="currentColor" d="' + beam + '"/>';
  const mark = state === 'FIXED_BY_WORDING' ? '<rect x="15.4" y="0.6" width="3" height="3" fill="var(--streak)"/>' : '';
  return '<svg width="22" height="14" viewBox="0 0 20 12" aria-hidden="true">' + body + '<path fill="currentColor" d="M9.2 6.6h1.6V10H9.2zM6.5 10h7v1.5h-7z"/>' + mark + '</svg>';
}
const pill = (state, extra = '') => `<span class="reading r-${state}" title="${esc(STATE_HELP[state])}">${beamGlyph(state)}${esc(STATE_LABEL[state] || state)}</span>${extra}`;
const verdict = (v) => (v ? `<span class="v v-${v}">${v === 'PASS' ? 'passed' : v === 'FAIL' ? 'failed' : "couldn't run"}</span>` : '<span class="v">–</span>');
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Lagos' }) + ' WAT' : 'not yet');

function layout({ title, body, depth = 0, lab = false, page = '' }) {
  const up = depth ? '../'.repeat(depth) : '';
  const nav = [['index.html', 'Matrix', 'matrix'], ['install.html', 'Install', 'install'], ['about.html', 'How it works', 'about']]
    .map(([href, label, key]) => `<a href="${up}${href}"${page === key ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="Which Kane CLI checks can you trust? Measured on pages with known answers.">
<link rel="icon" href="${up}favicon.svg" type="image/svg+xml"><link rel="icon" href="${up}favicon-32.png" sizes="32x32"><link rel="apple-touch-icon" href="${up}apple-touch-icon.png">
<link rel="preload" href="${up}fonts/big-shoulders-display.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="${up}beam.css">
</head>
<body${lab ? ' class="lab"' : ''}>
<a class="skip" href="#main">Skip to content</a>
<header class="top">
  <div class="wrap top-in">
    <a class="brand" href="${up}index.html"><svg width="24" height="24" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="currentColor" fill-rule="evenodd" d="M2 6 6 2H18L22 6V18L18 22H6L2 18ZM4 6.83 6.83 4H17.17L20 6.83V17.17L17.17 20H6.83L4 17.17Z M6 7.5H18V9H6ZM11.25 9H12.75V16H11.25ZM8.5 16H15.5V17.5H8.5ZM7.4 9H8.6V11.5H7.4ZM15.4 9H16.6V11.5H15.4ZM5.5 11.5H10.5A2.5 2.5 0 0 1 5.5 11.5ZM13.5 11.5H18.5A2.5 2.5 0 0 1 13.5 11.5Z"/></svg>Beam${lab ? ' <span class="labtag">Lab, local</span>' : ''}</a>
    <nav aria-label="Main">${nav}${lab ? '<button class="btn" id="open-run" type="button">Run</button><button class="btn ghost" id="open-add" type="button">Add from issue</button>' : ''}</nav>
  </div>
  <div class="scale" aria-hidden="true"></div>
</header>
<main id="main" class="wrap">
${body}
</main>
<footer class="foot"><div class="wrap">
  <p>Beam measures Kane CLI on small pages with known answers. Every result links to the Kane run and the public Kane issue behind it. Not affiliated with TestMu AI.</p>
  <p>© 2026 Beam. MIT Licensed. <a href="https://github.com/CryptoZephyr/beam">Source</a>, <a href="${up}beam.json">beam.json</a>, <a href="https://github.com/CryptoZephyr/beam/blob/main/docs/DESIGN_SYSTEM.md">Design system</a></p>
</div></footer>
${lab ? `<script type="module" src="${up}lab.js"></script>` : ''}
<script>
document.querySelectorAll('[data-copy]').forEach(b=>b.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(b.dataset.copy);const t=b.textContent;b.textContent='Copied';b.setAttribute('aria-live','polite');setTimeout(()=>b.textContent=t,1500)}catch{}}));
</script>
</body>
</html>`;
}

function copyBox(text, label = 'Copy', wrap = false) {
  return `<div class="cmd${wrap ? ' wrap' : ''}"><code>${esc(text)}</code><button type="button" class="btn small" data-copy="${esc(text)}">${label}</button></div>`;
}

function heroContrast(data) {
  const b = data.behaviors.find((x) => x.id === 'plural-counter');
  const ref = data.referenceVersion;
  if (!b || !ref) return '';
  const rows = b.wordings.filter((w) => w.versions[ref]).slice(0, 2).map((w) => {
    const v = w.versions[ref];
    const caught = v.broken === 'FAIL';
    return `<li><code>${esc(w.text)}</code><span>${pill(v.state)} <span class="muted">On a page that says “1 items left”, Kane ${v.broken === 'PASS' ? 'passed it: bug missed' : 'failed it: bug caught'}.</span></span></li>`;
  }).join('');
  return `<ol class="contrast" aria-label="Two wordings of the same check">${rows}</ol>`;
}

function matrix(data, { lab }) {
  const vs = data.versions;
  const head = `<tr><th scope="col">Behavior</th><th scope="col">Issue</th>${vs.map((v) => `<th scope="col">Kane ${esc(v)}</th>`).join('')}</tr>`;
  const rows = data.behaviors.map((b) => {
    const cells = vs.map((v) => {
      const c = b.cells[v] || { state: 'NOT_RUN' };
      const prev = vs[vs.indexOf(v) + 1];
      const changed = prev && b.cells[prev] && b.cells[prev].state !== c.state && c.state !== 'NOT_RUN' && b.cells[prev].state !== 'NOT_RUN';
      return `<td data-cell="${esc(b.id)}|${esc(v)}">${pill(c.state, changed ? `<span class="changed">changed since ${esc(prev)}</span>` : '')}</td>`;
    }).join('');
    const tags = [b.title, b.summary, ...(b.tags || []), b.issue ? `#${b.issue.number}` : ''].join(' ').toLowerCase();
    return `<tr data-state="${esc(b.state)}" data-search="${esc(tags)}"><th scope="row"><a href="b/${esc(b.id)}.html">${esc(b.title)}</a><span class="sub">${esc(b.summary)}</span></th><td>${b.issue ? `<a href="${esc(b.issue.url)}">#${b.issue.number}</a>` : '<span class="muted">–</span>'}</td>${cells}</tr>`;
  }).join('');
  const counts = Object.fromEntries(Object.keys(STATE_LABEL).map((s) => [s, data.behaviors.filter((b) => b.state === s).length]));
  const filters = ['ALL', 'CORRECT', 'FIXED_BY_WORDING', 'FALSE_GREEN', 'FALSE_RED']
    .map((s) => `<button type="button" data-filter="${s}" aria-pressed="${s === 'ALL'}">${s === 'ALL' ? `All (${data.behaviors.length})` : `${STATE_LABEL[s]} (${counts[s]})`}</button>`).join('');
  return `
<section id="matrix" aria-labelledby="mh">
  <div class="scale" aria-hidden="true"></div>
  <div class="mhead">
    <h2 id="mh">The matrix</h2>
    <dl class="legend">
      <div><dt>${pill('CORRECT')}</dt><dd>right as first worded</dd></div>
      <div><dt>${pill('FIXED_BY_WORDING')}</dt><dd>right with Beam's wording</dd></div>
      <div><dt>${pill('FALSE_GREEN')}</dt><dd>passed a broken page</dd></div>
      <div><dt>${pill('FALSE_RED')}</dt><dd>failed a correct page</dd></div>
    </dl>
  </div>
  <div class="controls">
    <label class="search">Search behaviors<input id="q" type="search" placeholder="plural, reload, toast, #254" autocomplete="off"></label>
    <div class="segmented" role="group" aria-label="Filter by reading">${filters}</div>
  </div>
  <div class="tablewrap"><table class="m"><thead>${head}</thead><tbody>${rows}</tbody></table></div>
  <p id="empty" class="empty" hidden>No behavior matches that search. Know a Kane check that goes wrong? <a href="about.html#add">Suggest one</a>.</p>
</section>
<script>
const q=document.getElementById('q'),rows=[...document.querySelectorAll('table.m tbody tr')],chips=[...document.querySelectorAll('.segmented button')];let f='ALL';
function apply(){const t=q.value.trim().toLowerCase();let n=0;rows.forEach(r=>{const ok=(f==='ALL'||r.dataset.state===f)&&(!t||r.dataset.search.includes(t));r.hidden=!ok;if(ok)n++});document.getElementById('empty').hidden=n>0}
q.addEventListener('input',apply);chips.forEach(c=>c.addEventListener('click',()=>{f=c.dataset.filter;chips.forEach(x=>x.setAttribute('aria-pressed',x===c));apply()}));
</script>`;
}

function indexPage(data, { lab }) {
  const n = data.behaviors.length;
  const issues = data.behaviors.filter((b) => b.issue).length;
  const body = `
<section class="hero">
  <h1>Same Kane check, two wordings, opposite results.</h1>
  <p class="lede">Beam measures which Kane CLI checks are right, on pages where we know the answer, and teaches your coding agent to write the ones that are.</p>
  ${heroContrast(data)}
  ${copyBox(INSTALL)}
  </section>
<p class="scope">${n} behaviors, ${issues} of them from public Kane issues. Measured on Kane ${data.versions.map(esc).join(' and ') || '(none yet)'}, last run ${esc(fmtDate(data.lastRun))}.</p>
${matrix(data, { lab })}
${lab ? labPanels() : ''}`;
  return layout({ title: 'Beam: make every Kane green a true green', body, lab, page: 'matrix' });
}

function behaviorPage(b, data, { lab }) {
  const vs = data.versions;
  const rows = b.wordings.map((w) => vs.filter((v) => w.versions[v]).map((v, i) => {
    const r = w.versions[v];
    return `<tr>${i === 0 ? `<th scope="row" rowspan="${vs.filter((x) => w.versions[x]).length}"><code>${esc(w.text)}</code><span class="sub">${w.origin === 'agent' ? 'Proposed by the agent' : w.origin === 'issue' ? 'From the Kane issue' : 'Baseline'}</span></th>` : ''}<td>${esc(v)}</td><td>${verdict(r.correct)}</td><td>${verdict(r.broken)}</td><td>${pill(r.state)}</td></tr>`;
  }).join('') || `<tr><th scope="row"><code>${esc(w.text)}</code></th><td colspan="4" class="muted">Not run yet</td></tr>`).join('');

  const ref = data.referenceVersion;
  const coded = b.wordings.filter((w) => w.versions[ref]?.codeJs);
  const wrong = b.wordings.find((w) => ['FALSE_GREEN', 'FALSE_RED'].includes(w.versions[ref]?.state));
  const why = coded.length || wrong?.versions[ref]?.brokenSummary ? `
<section aria-labelledby="why"><div class="scale" aria-hidden="true"></div><h2 id="why">How Kane read the page</h2>
  <p>Kane turns each wording into code that reads the page. This is the code it recorded:</p>
  ${coded.map((w) => `<div class="codepair"><p><code>${esc(w.text)}</code> ${pill(w.versions[ref].state)}</p><pre><code>${esc(w.versions[ref].codeJs)}</code></pre></div>`).join('')}
  ${wrong?.versions[ref]?.brokenSummary ? `<p>Kane's summary on the broken page with <code>${esc(wrong.text)}</code>:</p><blockquote>${esc(wrong.versions[ref].brokenSummary)}</blockquote>` : ''}
</section>` : '';

  const agentLine = b.recommendedWording
    ? `<p class="label">Use</p>${copyBox(b.recommendedWording, 'Copy', true)}`
    : b.state === 'NOT_RUN' ? '<p>Not measured yet.</p>' : '<p><strong>No wording tried so far makes Kane get this right.</strong> Your agent adds a separate check (a unit test or a direct DOM assertion) next to the Kane check.</p>';
  const avoid = b.avoidWordings.length ? `<p class="label">Avoid</p><ul class="avoid">${b.avoidWordings.map((a) => `<li><code>${esc(a.text)}</code> <span class="muted">(${esc(STATE_LABEL[a.state])})</span></li>`).join('')}</ul>` : '';
  const src = (f) => esc(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  const body = `
<p class="crumb"><a href="../index.html">Matrix</a> / ${esc(b.title)}</p>
<header class="bhead">
  <h1>${esc(b.title)}</h1>
  <div>${pill(b.state)} ${b.issue ? `<a class="issue" href="${esc(b.issue.url)}">Kane issue #${b.issue.number}</a>` : ''}</div>
</header>
<p class="lede">${esc(b.summary)} ${esc(b.whatDiffers)}</p>
<section class="agent" aria-labelledby="ag"><h2 id="ag">What your agent will do with Beam installed</h2><div class="agent-body">${agentLine}${avoid}</div></section>
<section aria-labelledby="res"><div class="scale" aria-hidden="true"></div><h2 id="res">Results</h2>
  ${b.steps ? `<p>Before each check, Kane does: <em>${esc(b.steps)}</em></p>` : ''}
  <div class="tablewrap"><table class="r"><thead><tr><th scope="col">Wording</th><th scope="col">Kane</th><th scope="col">Correct page</th><th scope="col">Broken page</th><th scope="col">Result</th></tr></thead><tbody>${rows}</tbody></table></div>
</section>
${why}
<section aria-labelledby="pages"><div class="scale" aria-hidden="true"></div><h2 id="pages">The two pages</h2>
  ${b.steps ? `<p class="muted">These are live. To see the difference, do what Kane does: ${esc(b.steps)}</p>` : ""}
  <div class="twins">
    <figure><figcaption>Correct page (Kane should pass)</figcaption><iframe title="Correct page" loading="lazy" sandbox="allow-scripts" src="../fixtures/${esc(b.id)}/correct.html"></iframe><details><summary>Source</summary><pre><code>${src(b.fixture.correct)}</code></pre></details></figure>
    <figure><figcaption>Broken page (Kane should fail)</figcaption><iframe title="Broken page" loading="lazy" sandbox="allow-scripts" src="../fixtures/${esc(b.id)}/broken.html"></iframe><details><summary>Source</summary><pre><code>${src(b.fixture.broken)}</code></pre></details></figure>
  </div>
</section>
<section aria-labelledby="repro"><div class="scale" aria-hidden="true"></div><h2 id="repro">Reproduce it</h2>
  <p>Clone the repo, then run this behavior on your own Kane:</p>
  ${copyBox(`npm run suite -- ${b.id}`)}
</section>`;
  return layout({ title: `${b.title} · Beam`, body, depth: 1, lab });
}

function installPage() {
  const body = `
<h1>Install Beam into your coding agent</h1>
<p class="lede">One command. Your agent then uses the Kane wordings that are measured to be right, and avoids the ones that pass broken pages.</p>
${copyBox(INSTALL)}
<section><h2>What it changes</h2>
<ul>
  <li><strong>Claude Code:</strong> adds <code>~/.claude/skills/kane-beam/SKILL.md</code> and <code>beam.json</code> beside it.</li>
  <li><strong>Codex:</strong> adds <code>~/.codex/skills/kane-beam/</code> when Codex is installed.</li>
  <li><strong>Cursor:</strong> adds <code>.cursor/rules/kane-beam.mdc</code> in the current project (asks first).</li>
</ul>
<p>Nothing else is touched. Every file it writes is listed in <code>~/.kane-beam/installed.json</code>.</p></section>
<section><h2>How you'll know it's working</h2>
<p>When your agent writes a Kane check that Beam knows about, it says one line, for example:</p>
<pre><code>Beam: used the "exact visible text" wording. The shorter wording passes plural bugs.</code></pre></section>
<section><h2>Check a wording yourself</h2>
${copyBox(`npx kane-beam check "Verify the todo counter reads '1 item left'"`)}
<p>Exits with code 1 on a wording known to pass broken pages, so you can use it in a pre-commit hook or CI.</p></section>
<section><h2>Update and remove</h2>
${copyBox('npx kane-beam update')}
${copyBox('npx kane-beam uninstall')}</section>`;
  return layout({ title: 'Install · Beam', body, page: 'install' });
}

function aboutPage(data) {
  const body = `
<h1>How Beam measures Kane</h1>
<p class="lede">A check is only useful if it fails when the app is broken. Beam tests that directly.</p>
<ol class="steps">
  <li><strong>Two pages per behavior.</strong> A correct page and a broken twin that differs in one visible thing. We know the right answer for both.</li>
  <li><strong>Kane runs every wording on both pages.</strong> Right means: passed the correct page and failed the broken one. Passing the broken page is a false green.</li>
  <li><strong>The agent repairs wrong wordings.</strong> When no wording is right, Claude Code reads what Kane did (its summary and the code it recorded) and proposes new wordings. Kane runs those too. The first one that's right is what Beam recommends.</li>
  <li><strong>Every Kane version gets a column.</strong> Checks are recorded once with Kane ${esc(data.referenceVersion || '')}, then replayed with healing off on each version. So older columns measure Kane's replay of those recordings.</li>
</ol>
<section><h2>Honesty notes</h2>
<ul>
  <li>Pages are small test pages, not real websites. They're in the repo, and the two versions of each differ by one to four lines.</li>
  <li>A behavior from a Kane issue that Kane now gets right is shown as correct. That's a finding, not something to hide.</li>
  <li>"Couldn't run" results are never counted as right or wrong.</li>
  <li>Kane reported ${esc(data.creditsReported)} credits for the runs behind this page.</li>
</ul></section>
<section id="add"><h2>Add a behavior</h2>
<p>Know a Kane check that goes wrong? Open an issue on <a href="https://github.com/CryptoZephyr/beam/issues">Beam's repo</a> with a link to the Kane issue, or run it yourself:</p>
${copyBox('npm run add-issue -- https://github.com/LambdaTest/kane-cli/issues/<number>')}
<p>The agent drafts the two pages. Nothing runs until a person approves them.</p></section>`;
  return layout({ title: 'How it works · Beam', body, page: 'about' });
}

function labPanels() {
  return `
<dialog id="run-dialog" aria-labelledby="run-h"><form method="dialog" id="run-form">
  <h2 id="run-h">Run behaviors through Kane</h2>
  <fieldset><legend>Behaviors</legend><div id="run-behaviors" class="checks"></div></fieldset>
  <fieldset><legend>Kane versions</legend><div id="run-versions" class="checks"></div></fieldset>
  <label>Budget (credits) <input id="run-budget" type="number" min="10" value="100"></label>
  <label class="inline"><input id="run-headed" type="checkbox"> Show browser</label>
  <p id="run-estimate" class="muted"></p>
  <div class="row"><button class="btn" id="run-go" type="button">Run</button><button class="btn ghost" value="cancel">Cancel</button></div>
</form></dialog>
<dialog id="add-dialog" aria-labelledby="add-h"><form method="dialog" id="add-form">
  <h2 id="add-h">Add a behavior from a Kane issue</h2>
  <label>Issue URL <input id="add-url" type="url" placeholder="https://github.com/LambdaTest/kane-cli/issues/252" required></label>
  <div class="row"><button class="btn" id="add-go" type="button">Draft the pages</button><button class="btn ghost" value="cancel">Cancel</button></div>
  <div id="add-draft"></div>
</form></dialog>
<aside id="run-status" class="runstatus" aria-live="polite" hidden></aside>`;
}

export function buildSite({ lab = false, outDir = SITE_DIR } = {}) {
  const data = buildCompat();
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(outDir, 'b'), { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), indexPage(data, { lab }));
  for (const b of data.behaviors) fs.writeFileSync(path.join(outDir, 'b', `${b.id}.html`), behaviorPage(b, data, { lab }));
  fs.writeFileSync(path.join(outDir, 'install.html'), installPage());
  fs.writeFileSync(path.join(outDir, 'about.html'), aboutPage(data));
  fs.writeFileSync(path.join(outDir, 'beam.json'), JSON.stringify(data, null, 2));
  for (const f of ['beam.css', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', ...(lab ? ['lab.js'] : [])]) fs.copyFileSync(path.join(ROOT, 'site-src', f), path.join(outDir, f));
  fs.cpSync(path.join(ROOT, 'site-src', 'fonts'), path.join(outDir, 'fonts'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'fixtures'), path.join(outDir, 'fixtures'), { recursive: true, filter: (s) => !s.includes('_drafts') });
  if (!lab) console.log(`Site built: ${data.behaviors.length} behaviors → ${path.relative(ROOT, outDir)}/`);
  return data;
}
