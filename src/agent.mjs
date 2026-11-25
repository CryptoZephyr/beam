// The agent side of the loop. Uses Claude Code in headless mode by default
// (BEAM_AGENT=claude). Returns plain data; the runner decides what to do with it.
import { spawn } from 'node:child_process';

const AGENT = process.env.BEAM_AGENT || 'claude';

function callAgent(prompt, { timeoutMs = 180_000 } = {}) {
  return new Promise((resolve, reject) => {
    const args = AGENT === 'claude' ? ['-p', prompt, '--output-format', 'json'] : ['exec', prompt];
    // No shell: claude is a real .exe on Windows, and a shell would mangle the prompt's quotes.
    const child = spawn(AGENT, args, { shell: false, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let out = '';
    let err = '';
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.stdout.on('data', (d) => (out += d));
    child.stderr.on('data', (d) => (err += d));
    child.on('error', (e) => { clearTimeout(timer); reject(e); });
    child.on('close', (code) => {
      clearTimeout(timer);
      let text = out;
      try {
        const o = JSON.parse(out);
        if (o.is_error || o.subtype === 'error') return reject(new Error(String(o.result || 'agent error').slice(0, 200)));
        text = o.result ?? out;
      } catch {}
      if (code !== 0 && !text.trim()) return reject(new Error((err || out || `agent exited ${code}`).trim().slice(0, 200)));
      resolve(text);
    });
  });
}

export function extractJson(text) {
  const s = String(text).replace(/```(?:json)?/g, '');
  const start = s.indexOf('{');
  const end = s.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('agent did not return JSON');
  return JSON.parse(s.slice(start, end + 1));
}

export async function askJson(prompt, validate) {
  let lastErr;
  for (let i = 0; i < 2; i++) {
    try {
      const obj = extractJson(await callAgent(prompt));
      const problem = validate(obj);
      if (!problem) return obj;
      lastErr = new Error(problem);
    } catch (e) {
      lastErr = e;
      if (/not logged in|ENOENT|not recognized/i.test(String(e.message))) break;
    }
  }
  throw lastErr;
}

export function repairPrompt(behavior, attempts) {
  return `You write checks for Kane CLI, a tool that runs plain-English test objectives in a real browser.
A wording is RIGHT when Kane passes it on the correct page and fails it on the broken page.

Behavior: ${behavior.title}
What the correct page shows: ${behavior.summary}
How the broken page differs: ${behavior.what_differs}
Steps that run before the check: ${behavior.steps || '(none)'}

Wordings already tried (Kane's results):
${attempts.map((a, i) => `${i + 1}. "${a.text}"
   correct page: ${a.correct || '?'}, broken page: ${a.broken || '?'} => ${a.state}
   Kane's summary on the broken page: ${(a.brokenSummary || '').replace(/\s+/g, ' ').slice(0, 400)}
   Code Kane recorded to read the page: ${a.codeJs || '(none)'}`).join('\n')}

Write up to 2 NEW check sentences with the same intent that Kane is more likely to get right.
Rules:
- One sentence each, starting with "Verify" or "Assert".
- Describe the expected truth only. Never mention the bug or the broken page.
- No extra actions (the steps above already run).
- Prefer wordings that make Kane read the real visible text or state, e.g. "the exact visible text of ...".
Return ONLY JSON: {"wordings":[{"text":"...","why":"..."}]}`;
}

export async function repairWordings(behavior, attempts) {
  const obj = await askJson(repairPrompt(behavior, attempts), (o) => {
    if (!Array.isArray(o.wordings) || !o.wordings.length) return 'no wordings';
    if (o.wordings.some((w) => typeof w.text !== 'string' || !/^(verify|assert)/i.test(w.text.trim()))) return 'each wording must start with Verify or Assert';
    return null;
  });
  const tried = new Set(attempts.map((a) => a.text.trim().toLowerCase()));
  return obj.wordings.map((w) => ({ text: w.text.trim(), why: w.why })).filter((w) => !tried.has(w.text.toLowerCase())).slice(0, 2);
}
