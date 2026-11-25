// Runs a Kane _test.md and turns its NDJSON stream into one plain result object.
import { spawn } from 'node:child_process';
import path from 'node:path';

export function parseStream(text) {
  const out = { overall: null, replayDecisions: null, authorDecisions: null, summary: null, oneLiner: null, reasonCode: null, credits: null, durationS: null, testUrl: null, stored: {}, steps: [], codeJs: null, evidence: [] };
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('{')) continue;
    let o;
    try { o = JSON.parse(line); } catch { continue; }
    if (o.type === 'run_end') {
      out.summary = o.summary ?? out.summary;
      out.oneLiner = o.one_liner ?? out.oneLiner;
      out.reasonCode = o.reason_code ?? out.reasonCode;
      if (typeof o.credits_consumed === 'number') out.credits = (out.credits || 0) + o.credits_consumed;
      out.durationS = o.duration ?? out.durationS;
      out.testUrl = o.test_url ?? out.testUrl;
      const vars = o.final_state?.variables;
      if (vars) for (const [k, v] of Object.entries(vars)) out.stored[k] = typeof v === 'object' && v && 'value' in v ? v.value : v;
    } else if (o.type === 'test_md_summary') {
      out.overall = o.overall_status;
      out.replayDecisions = o.steps?.replay_decisions ?? null;
      out.authorDecisions = o.steps?.author_decisions ?? null;
      if (typeof o.duration_s === 'number' && out.durationS == null) out.durationS = o.duration_s;
    } else if (o.type === 'test_md_done' && !out.overall) {
      out.overall = o.overall_status;
    } else if (o.step !== undefined && o.remark && o.status !== 'running') {
      out.steps.push({ step: o.step, status: o.status, remark: String(o.remark) });
    }
  }
  // Kane records the code it used to read the page; it's the clearest root cause for a false green.
  const codes = [...text.matchAll(/"code_js":"((?:[^"\\]|\\.)*)"/g)].map((m) => JSON.parse(`"${m[1]}"`));
  if (codes.length) out.codeJs = codes[codes.length - 1];
  if (out.summary) out.evidence = out.summary.split('\n').filter((l) => l.startsWith('evidence:')).map((l) => l.slice(9).trim());
  return out;
}

// replay: run with --no-adaptive-heal so a replay measures the recorded check, not a healed one.
export function runTest(kane, file, { replay = false, headed = false, onStep, timeoutMs = 6 * 60_000 } = {}) {
  const args = [kane.entry, 'testmd', 'run', path.basename(file), '--agent'];
  if (!headed) args.push('--headless');
  if (replay) args.push('--no-adaptive-heal');
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: path.dirname(file),
      env: { ...process.env, KANE_CLI_USER_AGENT: 'kane-beam' },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    let stdout = '';
    let stderr = '';
    let buf = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => {
      const s = d.toString();
      stdout += s;
      buf += s;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (onStep && line.startsWith('{')) {
          try {
            const o = JSON.parse(line);
            if (o.remark && o.step !== undefined) onStep(String(o.remark));
            else if (o.type === 'step_end' && o.summary) onStep(String(o.summary));
          } catch {}
        }
      }
    });
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      clearTimeout(timer);
      const parsed = parseStream(stdout);
      resolve({ exitCode: code, version: kane.version, replay, ...parsed, stderrTail: stderr.split('\n').filter(Boolean).slice(-3).join('\n') });
    });
  });
}

export function verdictOf(result) {
  if (result.overall === 'passed') return 'PASS';
  if (result.overall === 'failed') return 'FAIL';
  return 'ERROR';
}
