# Beam design system (proposal)

Status: revision 2, 25 November 2026. Revision 2 reworks colour and type from the assay idea, at the owner's request: revision 1's cobalt and JetBrains Mono were too close to generic developer-tool defaults. Proposal. Section 13 lists the decisions that wait for the owner. Nothing in the UI changes until they're locked.

Built the way the owner's earlier systems were built (Fuse: Switchgear Panel; Bulkhead: hull plates and seams): one physical idea taken from the product's meaning, a 60/30/10 palette with every contrast pair computed, status as a word plus a mark, and a banned list. The look itself is new.

## 1. The idea

A **beam** is the bar of a balance. You put the thing on one pan and a known weight on the other, and the beam tells you, without opinion, whether they match. A jeweller's assay balance doesn't care how the gold looks. It reads true or it doesn't.

Beam does that to Kane's verdicts. On one side, Kane's pass or fail. On the other, the known answer for that page. The beam reads level (true) or tipped (false green, false red).

So the look is drawn from a **precision balance**: a graduated scale, a fulcrum, a beam that sits level or tips, calibration marks, and a single signal colour for the parts you operate. Not a lab, not a chart, not a dashboard. An instrument you read.

Meaning, in one sentence: a green only counts when it balances against the truth.

## 2. Who looks at Beam, and what they need in two seconds

- **Developer looking up a check (site, behavior page):** Does Kane get this right? If not, what do I write instead? (State word plus the beam mark, then the recommended wording with a copy action.)
- **Judge or visitor from a post (home):** What is this, and is it real? (The #254 contrast: the same check worded two ways, opposite results, measured. Then the matrix with real versions and a last-run time.)
- **Kane engineer (matrix, version columns):** What changed between releases, and how do I reproduce it? (Changed cells marked, the issue link, the fixture and the command.)
- **Maintainer in the lab:** What is Kane doing right now, and what did it cost? (A live reading per cell with Kane's current step, credits spent.)

If a screen doesn't help one of these four, cut it.

## 3. The owner's rules (kept from earlier projects)

- 60/30/10 colour, never a near-white app.
- No screen confuses anyone: where am I, what's happening, what do I do next.
- Status is always a word and a mark, never colour alone.
- Motion follows real state. Nothing shows as done before Kane has returned.
- Numbers only from real runs: Kane versions, credits, verdicts, timestamps. No invented counts.
- No generic kits: no component libraries, icon packs or animation libraries. Glyphs are drawn for Beam.
- Mono only for real code. Beam's wordings are Kane objectives, which are inputs a developer copies into a test, so they count as code and use mono. Labels, nav and headings never do.
- Every state designed in light and dark, at phone and desktop width.

## 4. Banned

A screen with any of these fails review.

- Pills. States are drawn as readings (section 7), not rounded badges. (The current build uses pills. They go.)
- Coloured left stripes on panels or notes. (The current "What your agent will do" panel has one. It goes.)
- Blurred drop shadows. Depth comes from colour and rules only.
- Status by colour alone.
- Count-up number tickers, pulsing "live" dots, fake progress.
- Gradients, glow, glass, neon.
- Badges or tags beside headings.
- Em dashes anywhere in UI copy or docs.
- Apology or demo text on product surfaces.
- Any wording or verdict that didn't come from a Kane run.

## 5. Colour

Revision 2: the palette comes from what an assayer actually uses, not from developer-tool defaults. See `site/_brand/palettes.html` in a local build for the live sheet. Contrast computed 25 Nov (WCAG 2.2).

### Option T: Touchstone (recommended), dark first

An assayer rubs gold on a black touchstone and reads the streak it leaves. The page is the stone. The gold streak marks what you operate.

- 60%, Basanite #141619 (the touchstone).
- 30%, Stone #22262B (frames: top bar, command frames, run panel, footer).
- 10%, Streak #E9B824 (the gold streak): button fills, the copy action, focus, the live reading needle, and the mark on "True with wording". Button labels are Basanite on Streak, 9.8:1.
- Text #E9E7E2 (14.7:1 on Basanite, 12.3:1 on Stone). Muted #A7ACB2 (7.9:1, 6.7:1).
- Readings: True #5CCB8A (8.9:1), False #FF7A85 (7.2:1), Couldn't run #8E959C (6.0:1). Streak as text 9.8:1.
- No amber state. "True with wording" is the True colour plus a small Streak mark on the glyph, so the accent and a state never compete.

Light mode (assay paper): Paper #E7E9E6 (60%), Basanite #141619 frames (30%), Streak #E9B824 fills only (1.5:1 on paper, so never text or a thin mark on paper). Streak as text becomes #7A5A00 (5.2:1). Readings: True #17663D 5.7, False #B0173A 5.7, Couldn't run #59616A 5.1, Muted #4B5157 6.6, Ink 14.8.

Why it isn't generic: dark-first with a gold streak is drawn from the touchstone test itself, and gold appears only as a streak or fill, never as a gradient, glow or "luxury" brass. Not the AI-default cobalt/violet, and not the banned beige-and-brass family (Basanite is cool near-black, not espresso; Streak is a clean yellow, not brass #b08947).

### Option R: Assay certificate, light first

Navy ink on cool paper, with verdigris (the green patina on tested metal) as the stamp colour. Paper #E6E9EC, Navy #122033 (13.5:1), Verdigris #0F7C74 (white label 5.1:1, as text #0B6660 5.6:1).

Risk: verdigris is green, so it competes with the True reading, the same conflict Bulkhead had with Kelp. Kept as the runner-up.

## 6. Type

One font per role, all open licence (OFL), self-hosted at build. Revision 2 drops JetBrains Mono and Source Sans 3 as too common on developer sites.

| Role | Proposal (D2) | Why |
|---|---|---|
| Headings | Big Shoulders Display, 700 to 800 | Condensed and punched, like the letters struck into a hallmark. h1 to h3 only |
| Body | Atkinson Hyperlegible Next, 400 and 600 | Designed for legibility (Braille Institute), and it doesn't look like every other SaaS body face |
| Mono | Martian Mono, 400 | Kane wordings, commands, recorded code_js and fixture source only. Wide and engineered |

Alternative heading (if Big Shoulders reads too loud): Schibsted Grotesk 700. Rejected: Martian Grotesk (proprietary licence, checked 25 Nov), Inter, Geist and Space Grotesk (the owner's banned list).

Scale (desktop / phone): h1 48/34 (Big Shoulders runs narrow, so it sits larger), h2 26/22, h3 19/18, body 17/16, small 14, label 13 in sentence case. Numbers are tabular.

## 7. The beam reading (the signature element)

Every state is drawn as a small **beam glyph** plus its word. The glyph is a 20×12 drawing: a fulcrum triangle and a beam bar.

| State | Glyph | Word |
|---|---|---|
| True (Correct) | Beam level, both pans even | **True** |
| Fixed by wording | Beam level, with a small Streak mark on the right pan (the better wording) | **True with wording** |
| False green | Beam tipped down to the left (the pass side heavy) | **False green** |
| False red | Beam tipped down to the right | **False red** |
| Couldn't run | Beam drawn as a dashed outline | **Couldn't run** |
| Running (lab) | Beam level, the bar drawn in Streak, a needle that settles once when the result arrives | **Reading…** |
| Not run | Empty fulcrum, no beam | **Not run** |

Readings sit on a 2px hairline baseline, with no fill and no rounded container. Colour is the reading colour on text and glyph only. This replaces the pills.

Naming change (D3): the cell states read **True / True with wording / False green / False red / Couldn't run**. "Correct" and "Fixed by wording" become those words, so the whole site speaks the product's one idea.

## 8. Surfaces and rules

- **Frames:** Stone surfaces with a 4px radius, flat. Used for the top bar, hero contrast, command boxes, run panel and footer.
- **Scale rule:** the signature line. A 1px rule in the text colour at 40% opacity with calibration ticks every 8px (taller every 40px) runs under the top bar and above section headings. It's the only decoration in the system, and it says "instrument".
- **Sheets:** Sheets for tables, inputs and code: Stone in dark, #F3F4F2 in light, with a 1px #3A4047 (dark) or #C5C9C4 (light) border, 4px radius.
- **Radii:** 4px everywhere (frames, sheets, buttons, inputs). No other radius.
- **Shadows:** none.

## 9. Components

- **Top bar:** Stone frame, the Beam mark (D4) plus the wordmark in Big Shoulders Display, nav in body, the scale rule under it. Lab mode adds "Lab" as plain text next to the wordmark and two actions on the right (Run, Add from issue).
- **Hero:** left-aligned. Headline (max 2 lines), one sentence of sub-text, then the **contrast frame**: a Stone frame with the two wordings, each with its reading against the broken page. Then the install command frame. No other text in the hero. The scope line moves under the hero as plain muted text.
- **Command frame:** Stone, mono text, a Streak "Copy" button. Commands stay on one line and scroll. Wordings wrap.
- **Matrix:** a Sheet table. The behavior column is pinned on scroll. Each version column header shows the exact version and its run date. Cells hold a reading (glyph plus word). A changed cell gets a Streak tick above the glyph and "changed since 0.10.8" in its title.
- **Filter:** a segmented control on a single 1px frame (not chips): All, True, True with wording, False. A search field to the left, with its label above it.
- **Behavior page:** title, reading, issue link (plain link, not a badge). Then "What your agent will do" as a Sheet with a Stone heading bar (no left stripe): Use (wording frame plus Copy), Avoid (list). Then results, how Kane read the page (code pairs side by side, each with its reading), the two pages, and reproduce.
- **Results table:** rows grouped by wording, with a hairline between groups only (no rule on every row).
- **Buttons:** primary is a Streak fill with a Basanite label, 44px tall. Secondary is a Stone outline. Pressed state: one shade darker and 1px down, 120ms. One primary per view.
- **Lab run panel:** a dialog (Sheet) with a Stone heading bar, behaviors and versions as checkboxes, budget, show browser, and the estimate from real costs.
- **Lab live cell:** the running glyph plus "Reading 0.10.9 · broken page" and Kane's latest step underneath in muted body text.
- **Run status:** a Stone frame bottom-right with the last 5 events as text. No toast stack, no spinner.
- **Footer:** Stone frame. "© 2026 Beam. MIT Licensed." plus Source and beam.json links. "Not affiliated with TestMu AI."

## 10. Motion

- Only two motions in the whole site. The needle settles once when a lab reading arrives (240ms, ease-out, a single small overshoot). Buttons press (120ms).
- No entrance animations, no scroll effects.
- Reduced motion: the needle appears in place.

## 11. States to design (each in light and dark, phone and desktop)

Home (data, no data yet), matrix (filtered empty, search empty), behavior page (True / True with wording / False / Couldn't run / Not run), install page, about page, lab (idle, running, budget stop, Kane not signed in, agent unavailable, draft review, draft error).

## 12. Mark

**LOCKED** on 25 November 2026 by the owner (D4 resolved: concept B1 with B3 as the small cut). The files are copied, never retyped, traced, redrawn or simplified. Any change needs the owner's approval and a new hash.

![Beam mark](brand/mark/beam-mark.svg)

**Meaning:** an assay hallmark. Assay offices stamp gold that tested true, and Beam marks the Kane checks that tested true. Inside the stamp is a balance: a beam on a post and base, with a pan hanging from each end. A green only counts when it balances against the truth.

**Geometry:** a 24×24 viewBox. The stamp is a square with 4-unit chamfered corners and a 2-unit wall. The beam spans 6 to 18 at 1.5 units thick, the post is 1.5 wide, the base is 7 wide. The pans are half-discs of radius 2.5 on 1.2-unit stems. One path, even-odd fill, no overlapping sub-paths.

**Small cut** (`beam-mark-small.svg`) for 16 to 48 px: a 2.5-unit stamp wall, a 2-unit beam and post, solid pans with no stems. Used for the favicon and anything under 48 px. At 16 px it reads as a stamped balance. The full mark is used from 48 px up.

**Files** (`docs/brand/mark/`): `beam-mark.svg`, `beam-mark-small.svg`, and PNGs at 16, 32 and 48 (small cut) and 180 (full mark). The 512 px PNG gets exported at the palette lock.

**SHA-256:**
- `beam-mark.svg`: c9de07588ffe8ee85b7dbccaaef32894740223d27094675355be2ffee2fbd589
- `beam-mark-small.svg`: 08f4c2441528069cfdccad453a69717b17d468a694283aebb3095c9f2a18f42b

**Colour:** a single fill and nothing else. Frame colour on the page, on-frame colour on a frame. The final values follow the palette lock (D1). Never gradients, outlines, shadows, a second colour, or pulling the parts apart.

**Usage:** the mark alone for the favicon, app icon and avatar. The lockup is the mark plus "Beam" as live text in the heading font, with the gap equal to half the mark's width. The concepts in `docs/brand/concepts/` are retired.

## 13. Decisions for the owner

- **D1 Palette:** T Touchstone (recommended) or R Assay certificate.
- **D2 Type:** Big Shoulders Display, Atkinson Hyperlegible Next and Martian Mono (recommended), or Schibsted Grotesk as the heading face.
- **D3 State names:** True / True with wording / False green / False red / Couldn't run, instead of Correct / Fixed by wording / Wrong.
- **D4 Mark:** LOCKED 25 Nov (B1 + B3 small cut, section 12).
- **D5 Dark mode:** follow the device with no toggle (recommended), or add a toggle.
- **D6 Scale rule:** keep the calibration-tick rule as the one decoration, or drop it for plain 1px rules.
