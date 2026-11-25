// Runs behaviors through Kane: record each wording once on the correct twin with the reference
// version, then replay (heal off) on both twins for every installed version. One run at a time.
import { EventEmitter } from 'node:events';
import { setTwin, precheck } from './fixture-server.mjs';
import { writeTest, hasRecording } from './testfile.mjs';
import { runTest, verdictOf } from './kane.mjs';
import { gradeWording } from './grade.mjs';
import { loadResults, saveResults, appendHistory, slimRun, setRun } from './results.mjs';
import { saveManifest } from './behaviors.mjs';

export class Runner extends EventEmitter {
  constructor({ kanes, budget = 300, headed = false, force = false, repair = null } = {}) {
    super();
    this.kanes = kanes; // [{version, entry, reference}], reference first
    this.budget = budget;
    this.headed = headed;
    this.force = force;
    this.repair = repair; // async (behavior, attempts) => [{text}] | null
    this.spent = 0;
    this.stopped = false;
    this.results = loadResults();
  }

  stop() { this.stopped = true; }

  async run(behaviors) {
    const started = new Date().toISOString();
    this.emit('run:start', { behaviors: behaviors.map((b) => b.id), versions: this.kanes.map((k) => k.version), budget: this.budget });
    for (const behavior of behaviors) {
      if (this.stopped) break;
      await this.runBehavior(behavior);
    }
    this.results.runs = [...(this.results.runs || []), { started, finished: new Date().toISOString(), credits: round(this.spent), versions: this.kanes.map((k) => k.version) }].slice(-50);
    saveResults(this.results);
    this.emit('run:done', { credits: round(this.spent), stopped: this.stopped });
    return this.results;
  }

  async runBehavior(behavior) {
    this.emit('behavior:start', { id: behavior.id });
    const pc = await precheck(behavior.id);
    if (!pc.ok) {
      this.emit('behavior:skip', { id: behavior.id, reason: pc.reason });
      return;
    }
    for (const wording of [...behavior.wordings]) {
      if (this.stopped) return;
      await this.runWording(behavior, wording);
    }
    // Closed loop: if no wording is right on the reference version, ask the agent for new ones.
    const ref = this.kanes[0].version;
    const states = this.wordingStates(behavior, ref);
    const anyCorrect = Object.values(states).includes('CORRECT');
    const agentTried = behavior.wordings.some((w) => w.origin === 'agent');
    if (!anyCorrect && this.repair && !agentTried && !this.stopped) {
      this.emit('agent:start', { id: behavior.id });
      let proposed = [];
      try {
        proposed = (await this.repair(behavior, this.attemptsFor(behavior, ref))) || [];
      } catch (e) {
        this.emit('agent:error', { id: behavior.id, error: String(e.message || e) });
      }
      proposed = proposed.slice(0, 2);
      this.emit('agent:wordings', { id: behavior.id, wordings: proposed.map((p) => p.text) });
      for (const p of proposed) {
        const n = behavior.wordings.length + 1;
        const wording = { id: `w${n}`, origin: 'agent', text: p.text };
        behavior.wordings.push(wording);
        saveManifest(behavior);
        await this.runWording(behavior, wording);
        if (this.wordingStates(behavior, ref)[wording.id] === 'CORRECT') break;
      }
    }
    this.emit('behavior:done', { id: behavior.id, states: this.wordingStates(behavior, ref) });
  }

  async runWording(behavior, wording) {
    const { file, changed } = writeTest(behavior, wording);
    for (const kane of this.kanes) {
      for (const twin of ['correct', 'broken']) {
        if (this.stopped) return;
        const existing = this.results.behaviors[behavior.id]?.wordings[wording.id]?.versions[kane.version]?.[twin];
        if (existing && existing.verdict !== 'ERROR' && !changed && !this.force) continue;
        const recording = kane.reference && twin === 'correct' && (changed || !hasRecording(behavior.id, wording.id));
        if (!kane.reference && !hasRecording(behavior.id, wording.id)) continue; // other versions only replay
        if (recording && this.spent >= this.budget) {
          this.emit('budget:stop', { spent: round(this.spent), budget: this.budget });
          this.stopped = true;
          return;
        }
        await setTwin(behavior.id, twin);
        this.emit('cell:start', { id: behavior.id, wording: wording.id, version: kane.version, twin, recording });
        const go = () => runTest(kane, file, { replay: !recording, headed: this.headed, onStep: (remark) => this.emit('kane:step', { id: behavior.id, wording: wording.id, version: kane.version, twin, remark }) });
        let r = await go();
        // Exit 2 means auth or infra. Kane's server sometimes fails once ("TMS did not return an
        // org_id") while the login is fine, so wait and retry once before stopping the run.
        if (r.exitCode === 2 && !r.overall) {
          this.emit('kane:retry', { message: r.stderrTail });
          await new Promise((res) => setTimeout(res, 20_000));
          r = await go();
        }
        if (r.exitCode === 2 && !r.overall) this.emit('kane:not-ready', { message: r.stderrTail });
        const verdict = verdictOf(r);
        this.spent += r.credits || 0;
        const run = slimRun(r, verdict);
        const v = setRun(this.results, { behavior, wording, version: kane.version, twin, run });
        v.state = gradeWording({ correct: v.correct?.verdict, broken: v.broken?.verdict }, behavior.expected);
        appendHistory({ id: behavior.id, wording: wording.id, text: wording.text, version: kane.version, twin, ...run });
        saveResults(this.results);
        this.emit('cell:done', { id: behavior.id, wording: wording.id, version: kane.version, twin, verdict, state: v.state, credits: r.credits || 0, spent: round(this.spent) });
        if (r.exitCode === 2 && !r.overall) { this.stopped = true; return; }
      }
    }
  }

  wordingStates(behavior, version) {
    const out = {};
    for (const w of behavior.wordings) out[w.id] = this.results.behaviors[behavior.id]?.wordings[w.id]?.versions[version]?.state || 'NOT_RUN';
    return out;
  }

  attemptsFor(behavior, version) {
    return behavior.wordings.map((w) => {
      const v = this.results.behaviors[behavior.id]?.wordings[w.id]?.versions[version] || {};
      return { text: w.text, state: v.state, correct: v.correct?.verdict, broken: v.broken?.verdict, brokenSummary: v.broken?.summary, correctSummary: v.correct?.summary, codeJs: v.broken?.codeJs || v.correct?.codeJs };
    });
  }
}

const round = (n) => Math.round(n * 100) / 100;
