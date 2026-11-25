#!/usr/bin/env node
import { main } from '../src/installer.mjs';

main(process.argv.slice(2)).then((code) => process.exit(code ?? 0), (e) => {
  console.error(e.message || e);
  process.exit(1);
});
