---
name: kane-beam
description: Use whenever you are about to write or edit a Kane CLI check (a `kane-cli run` objective, or a step in a `*_test.md` file). Beam lists which Kane check wordings are measured to be right, and which pass broken pages (false greens), so you can pick the wording Kane gets right.
---

# Beam: write Kane checks that are actually right

Kane CLI turns plain-English checks into browser actions. **The wording changes what Kane checks.** For example, `Verify the todo counter reads "1 item left".` passes a page that says "1 items left", while `Verify the exact visible text of the todo counter is "1 item left".` catches it. Beam measures this on pages with known answers and records the results in `beam.json`, next to this file.

## When you write a Kane check

1. Read `beam.json` in this folder. Each entry in `behaviors` has `title`, `summary`, `tags`, `state`, `recommendedWording`, `avoidWordings`, and `limitation`.
2. Find entries whose title, summary or tags match what your check is about (for example a counter label, a page reload, a toast, a value saved to localStorage, text in an iframe).
3. If one matches:
   - If `recommendedWording` is set, write your check in that style: same structure, your own values and element names.
   - Never use a wording listed in `avoidWordings`. They're measured to pass broken pages.
   - If `limitation` is true, keep the Kane check, and also add a second check that doesn't depend on Kane (a unit test, or a direct DOM or storage assertion in your test framework). Say why in one line.
4. Tell the user in one line, only when Beam changed what you wrote, for example:
   `Beam: used the "exact visible text" wording. The shorter wording passes plural bugs.`
5. If nothing matches, write the check normally and say nothing about Beam.

## General patterns Beam has measured

- To check text, ask for the **exact visible text** of the element, not what it "reads" or "shows".
- When the result depends on an action, put the action in the steps and keep the check sentence about the expected truth only.
- Don't describe the bug in the check. Describe what the correct page shows.

You can lint a wording from the terminal with `npx kane-beam check "<objective>"` (exit code 1 means it's a known false green). Full results, the test pages and the Kane runs behind each entry: https://kane-beam.vercel.app
