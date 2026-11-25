import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIXTURES_DIR = path.join(ROOT, 'fixtures');
export const RUNS_DIR = path.join(ROOT, 'runs');
export const RESULTS_DIR = path.join(ROOT, 'results');
export const KANE_DIR = path.join(ROOT, 'kane');
export const SITE_DIR = path.join(ROOT, 'site');
export const DATA_FILE = path.join(ROOT, 'beam.json');
