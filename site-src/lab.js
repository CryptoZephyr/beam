// Lab mode client: run panel, add-from-issue review, live cell updates over SSE.
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const LABEL = { CORRECT: 'Correct', FIXED_BY_WORDING: 'Fixed by wording', FALSE_GREEN: 'Wrong: false green', FALSE_RED: 'Wrong: false red', ERROR: "Couldn't run", NOT_RUN: 'Not run' };
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
const running = (d) => `<span class="pill s-RUNNING">Running · ${esc(d.twin || '')} page</span><span class="cellstep">${esc(d.remark || (d.recording ? 'Recording the check' : 'Replaying the check'))}</span>`;

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
  setCell(d.id, d.version, s ? `<span class="pill s-${s}">${LABEL[s]}</span><span class="cellstep">${esc(d.wording)} · ${d.twin} page ${d.verdict === 'PASS' ? 'passed' : d.verdict === 'FAIL' ? 'failed' : "couldn't run"}</span>` : `<span class="pill s-RUNNING">Waiting for the broken page</span><span class="cellstep">${esc(d.wording)} · correct page ${d.verdict === 'PASS' ? 'passed' : 'failed'}</span>`);
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
