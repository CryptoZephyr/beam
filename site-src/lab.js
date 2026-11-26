// Lab mode client: run panel, add-from-issue review, live cell updates over SSE.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LABEL = { CORRECT: 'Balanced', FIXED_BY_WORDING: 'Balanced with wording', FALSE_GREEN: 'False green', FALSE_RED: 'False red', ERROR: "Couldn't run", NOT_RUN: 'Not run' };
const BEAM = { level: 'M2 5h16v1.6H2z', FALSE_GREEN: 'M2 7.6 18 3.4l.4 1.5L2.4 9.1z', FALSE_RED: 'M2 3.4l16 4.2-.4 1.5L1.6 4.9z' };
const glyph = (s) => `<svg width="22" height="14" viewBox="0 0 20 12" aria-hidden="true"><path class="beam" fill="currentColor" d="${BEAM[s] || BEAM.level}"/><path fill="currentColor" d="M9.2 6.6h1.6V10H9.2zM6.5 10h7v1.5h-7z"/>${s === 'FIXED_BY_WORDING' ? '<rect x="15.4" y="0.6" width="3" height="3" fill="var(--streak)"/>' : ''}</svg>`;
const reading = (s, extra = '') => `<span class="reading r-${s}${extra}">${glyph(s)}${esc(LABEL[s] || s)}</span>`;
const base = location.pathname.includes('/b/') ? '../' : '';

const status = $('#run-status');
const log = (line) => {
  status.hidden = false;
  const p = document.createElement('p');
  p.style.margin = '2px 0';
  p.textContent = line;
  status.append(p);
  while (status.children.length > 6) status.firstChild.remove();
};

function setCell(id, version, html) {
  document.querySelectorAll(`[data-cell="${CSS.escape(id + '|' + version)}"]`).forEach((td) => (td.innerHTML = html));
}
const running = (d) => `<span class="reading r-RUNNING">${glyph('level')}Reading ${esc(d.version)}, ${esc(d.twin || '')} page</span><span class="cellstep">${esc(d.remark || (d.recording ? 'Recording the check' : 'Replaying the check'))}</span>`;

// Live updates
const es = new EventSource('/api/events');
es.addEventListener('hello', (e) => {
  const d = JSON.parse(e.data);
  for (const [k, c] of Object.entries(d.cells || {})) if (c.running) { const [id, v] = k.split('|'); setCell(id, v, running(c)); }
});
es.addEventListener('run:start', (e) => { const d = JSON.parse(e.data); log(`Run started: ${d.behaviors.length} behavior(s) on Kane ${d.versions.join(', ')}`); });
es.addEventListener('cell:start', (e) => { const d = JSON.parse(e.data); setCell(d.id, d.version, running(d)); });
es.addEventListener('kane:step', (e) => { const d = JSON.parse(e.data); setCell(d.id, d.version, running(d)); });
es.addEventListener('cell:done', (e) => {
  const d = JSON.parse(e.data);
  const s = d.state && d.state !== 'NOT_RUN' ? d.state : null;
  setCell(d.id, d.version, s ? `${reading(s, ' arrived')}<span class="cellstep">${esc(d.wording)} · ${d.twin} page ${d.verdict === 'PASS' ? 'passed' : d.verdict === 'FAIL' ? 'failed' : "couldn't run"}</span>` : `<span class="reading r-RUNNING">${glyph('level')}Waiting for the broken page</span><span class="cellstep">${esc(d.wording)} · correct page ${d.verdict === 'PASS' ? 'passed' : 'failed'}</span>`);
  log(`${d.id} ${d.wording} · Kane ${d.version} · ${d.twin} page: ${d.verdict}${d.credits ? ` (${d.credits.toFixed(1)} credits)` : ''}`);
});
es.addEventListener('agent:start', (e) => log(`${JSON.parse(e.data).id}: no wording is right, asking the agent for new ones…`));
es.addEventListener('agent:wordings', (e) => { const d = JSON.parse(e.data); log(`Agent proposed: ${d.wordings.map((w) => `“${w}”`).join(' · ') || 'nothing new'}`); });
es.addEventListener('agent:error', (e) => log(`Agent unavailable: ${JSON.parse(e.data).error}`));
es.addEventListener('behavior:skip', (e) => { const d = JSON.parse(e.data); log(`Skipped ${d.id}: ${d.reason}`); });
es.addEventListener('budget:stop', (e) => log(`Stopped at the budget (${JSON.parse(e.data).spent} credits).`));
es.addEventListener('kane:not-ready', (e) => log(`Kane isn't ready: ${JSON.parse(e.data).message}`));
es.addEventListener('run:done', (e) => { log(`Run finished (${Number(JSON.parse(e.data).credits).toFixed(1)} credits). Updating the page…`); setTimeout(() => location.reload(), 1500); });
es.addEventListener('error', (e) => { if (e.data) log(`Error: ${JSON.parse(e.data).message}`); });

// Run panel
async function openRun(preselect) {
  const st = await (await fetch('/api/state')).json();
  if (st.active) return log('A run is already in progress.');
  const here = location.pathname.match(/\/b\/([a-z0-9-]+)\.html/)?.[1];
  $('#run-behaviors').innerHTML = st.behaviors.map((b) => `<label><input type="checkbox" value="${esc(b.id)}" ${(preselect ? preselect.includes(b.id) : b.id === here) ? 'checked' : ''}> ${esc(b.title)}</label>`).join('');
  $('#run-versions').innerHTML = st.versions.map((v, i) => `<label><input type="checkbox" value="${esc(v)}" checked ${i === 0 ? 'disabled' : ''}> Kane ${esc(v)}${i === 0 ? ' (reference)' : ''}</label>`).join('');
  const est = () => {
    const n = [...document.querySelectorAll('#run-behaviors input:checked')].length;
    $('#run-estimate').textContent = n ? `New checks cost about 18 credits each to record. Replays of recorded checks cost about 0. Up to ${n * 2} wordings × 2 pages × ${st.versions.length} version(s).` : 'Pick at least one behavior.';
  };
  $('#run-behaviors').onchange = est;
  est();
  $('#run-dialog').showModal();
}
$('#open-run').addEventListener('click', () => openRun());
$('#run-go').addEventListener('click', async () => {
  const ids = [...document.querySelectorAll('#run-behaviors input:checked')].map((i) => i.value);
  if (!ids.length) return;
  const versions = [...document.querySelectorAll('#run-versions input:checked')].map((i) => i.value);
  const r = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids, versions, budget: Number($('#run-budget').value), headed: $('#run-headed').checked }) });
  const d = await r.json();
  $('#run-dialog').close();
  if (!r.ok) log(d.error);
});

// Add from issue
$('#open-add').addEventListener('click', () => { $('#add-draft').innerHTML = ''; $('#add-dialog').showModal(); });
$('#add-go').addEventListener('click', async () => {
  const url = $('#add-url').value.trim();
  if (!url) return;
  const box = $('#add-draft');
  box.innerHTML = `<p class="muted">Reading ${esc(url.split('/').pop() ? '#' + url.split('/').pop() : 'the issue')} and drafting the two pages. This takes about a minute…</p>`;
  $('#add-go').disabled = true;
  try {
    const r = await fetch('/api/draft', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ issueUrl: url }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error);
    box.innerHTML = `
      <h3>${esc(d.title)}</h3>
      <p><strong>Correct page:</strong> ${esc(d.summary)}<br><strong>Broken page:</strong> ${esc(d.what_differs)}</p>
      ${d.steps ? `<p><strong>Steps:</strong> ${esc(d.steps)}</p>` : ''}
      <p><strong>Check:</strong> <code>${esc(d.wordings[0].text)}</code></p>
      <div class="draft-twins"><div><p class="label">Correct</p><iframe sandbox="allow-scripts" src="${esc(d.correctUrl)}" title="Drafted correct page"></iframe></div><div><p class="label">Broken</p><iframe sandbox="allow-scripts" src="${esc(d.brokenUrl)}" title="Drafted broken page"></iframe></div></div>
      <details><summary>Source of both pages</summary><pre><code>${esc(d.correctHtml)}</code></pre><pre><code>${esc(d.brokenHtml)}</code></pre></details>
      <div class="row"><button class="btn" type="button" id="approve">Approve &amp; run</button><button class="btn ghost" type="button" id="discard">Discard</button></div>`;
    $('#approve').onclick = async () => {
      await fetch('/api/approve', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) });
      $('#add-dialog').close();
      log(`Added ${d.id}. Starting the run…`);
      const r2 = await fetch('/api/run', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ids: [d.id], budget: 80, headed: true }) });
      if (!r2.ok) log((await r2.json()).error);
    };
    $('#discard').onclick = async () => { await fetch('/api/discard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: d.id }) }); $('#add-dialog').close(); };
  } catch (e) {
    box.innerHTML = `<p>Couldn't draft from that issue: ${esc(e.message)}</p>`;
  } finally {
    $('#add-go').disabled = false;
  }
});

// Live verify: Kane's steps on the left pan, the app's own values on the right, then the reading.
const liveTest = document.getElementById('live-test');
if (liveTest) {
  const kaneList = document.getElementById('live-kane');
  const appList = document.getElementById('live-app');
  const verdictEl = document.getElementById('live-verdict');
  const cap = document.getElementById('live-cap');
  const kaneV = document.getElementById('live-kane-v');
  fetch('/api/tests').then((r) => r.json()).then((tests) => {
    liveTest.innerHTML = tests.map((t) => `<option value="${esc(t.id)}">${esc(t.id)}</option>`).join('');
  });
  document.getElementById('live-go').addEventListener('click', async () => {
    const go = document.getElementById('live-go');
    go.disabled = true;
    const r = await fetch('/api/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: liveTest.value, headed: document.getElementById('live-headed').checked }) });
    if (!r.ok) {
      // A run is already going (or the request was refused): keep the live view as it is.
      const msg = (await r.json()).error;
      go.disabled = false;
      const note = document.createElement('span');
      note.className = 'muted busy';
      note.setAttribute('role', 'status');
      note.textContent = ` ${msg}`;
      go.after(note);
      setTimeout(() => document.querySelectorAll('#live .busy').forEach((n) => n.remove()), 4000);
      return;
    }
    kaneList.innerHTML = ''; appList.innerHTML = ''; verdictEl.innerHTML = ''; kaneV.textContent = '';
    cap.textContent = `Verifying ${liveTest.value}… Kane takes about 40 seconds to start.`;
  });
  es.addEventListener('verify:step', (e) => {
    const { remark } = JSON.parse(e.data);
    const li = document.createElement('li');
    li.textContent = remark.replace(/^(PRIMARY: )/, '');
    kaneList.append(li);
    while (kaneList.children.length > 7) kaneList.firstChild.remove();
  });
  es.addEventListener('verify:app', (e) => {
    const { values, failed } = JSON.parse(e.data);
    const rows = Object.entries(values || {}).map(([k, v]) => `<li><span class="what">${esc(k)}</span><span class="val">${esc(JSON.stringify(v))}</span></li>`);
    for (const f of failed || []) rows.push(`<li class="no"><span class="what">request failed</span><span class="val">${esc(f)}</span></li>`);
    appList.innerHTML = rows.join('');
  });
  es.addEventListener('verify:done', (e) => {
    document.getElementById('live-go').disabled = false;
    const r = JSON.parse(e.data);
    const kane = r.kane === 'PASS' ? 'passed' : r.kane === 'FAIL' ? 'failed' : "couldn't run";
    kaneV.innerHTML = `Verdict: <strong>${kane}</strong>`;
    if (r.checks) appList.innerHTML = r.checks.map((c) => `<li class="${c.ok ? 'ok' : 'no'}"><span class="what">${esc(c.what)}</span><span class="val">${esc(String(typeof c.actual === 'string' ? c.actual : JSON.stringify(c.actual)).replace(/https?:\/\/[^/\s]+/g, ''))}</span>${c.ok ? '' : `<span class="exp">expected ${esc(c.expected === 'none' ? 'none' : JSON.stringify(c.expected))}</span>`}</li>`).join('');
    const state = r.state === 'BALANCED' ? 'CORRECT' : r.state === 'COULDNT_RUN' ? 'ERROR' : r.state;
    verdictEl.innerHTML = `${reading(state, ' arrived')} <span>${esc(r.state === 'BALANCED' ? 'Kane and the app agree.' : r.state === 'FALSE_GREEN' ? 'Kane passed, but the app says it is broken.' : r.state === 'FALSE_RED' ? 'Kane failed, but the app says it works.' : (r.note || r.label || ''))}</span>`;
    cap.textContent = `Done: ${r.test || liveTest.value}${r.kaneRun?.credits ? `, ${r.kaneRun.credits.toFixed(1)} Kane credits` : ', replayed at no Kane credit cost'}.`;
  });
}
