# Frontend revamp brief: Glass Studio

You are redesigning the frontend of a research tool. Read this whole brief, then read the code, before changing anything. The owner's two requirements are: **motion on every screen and every state change**, and **it must not look AI-generated**. Everything below serves those two.

## 1. What this product is

Glass Studio is the web front end of a funded research project at TIET Patiala (COE-DSAI, project DSAI2025-EE-1018: *Physics-Informed Machine Learning to Accelerate the Discovery of Novel Glass Compositions for Energy-Harvesting Applications*). Its users are glass researchers and students, on laptops, who already know the chemistry.

It predicts the **glass transition temperature (Tg)** of sodium borosilicate glasses (SiO₂–B₂O₃–Na₂O) with four trained models (Random Forest, XGBoost, KNN, SVM; 480 training glasses).

| Screen | What the user does |
|---|---|
| **Sign in** | Email, Google, or one-click demo access |
| **Seer** (predict) | Pick elements on a periodic table → panel slides in from the right → choose oxides, property, model → enter composition in mol % or wt % → see Tg |
| **Bank** (explore) | See what the training data covers (ranges only; the dataset is private) |
| **Zen** (discover) | Enter a target Tg and tolerance → get candidate compositions |
| **Profile** | Account details |

## 2. Code you are working in

- `frontend/`: Next.js 16.4.6 (App Router), React 19.3, Tailwind 4.3.3, lucide-react, Firebase Auth. No animation library is installed yet.
- **This Next.js version has breaking changes from what you know.** `frontend/AGENTS.md` requires reading the relevant guide in `frontend/node_modules/next/dist/docs/` before writing code. Do that for fonts, view transitions, and anything in `next.config.ts` you touch.
- The whole app is one client page: `src/app/page.tsx` switches screens with `useState`. Screens are `src/components/{Seer,Bank,Zen,Profile}Module.tsx`. All styling is hand-written "clay" classes in `src/app/globals.css`.
- The working tree has **uncommitted changes that are the baseline** (the new Seer flow, wt % support, the full 118-element table). Build on them; do not revert them.
- Both dev servers are usually already running (frontend `:3000`, backend `:8000`); check before starting new ones. "One-Click Demo Access" signs you in without real credentials and predictions work with it.

Two traps already hit in this repo:
- Tailwind 4's `translate-x-*` and `scale-*` set the `translate` / `scale` CSS properties, not `transform`. A `transition: transform` rule will silently not animate them.
- On this Windows machine the dev server sometimes misses a CSS edit. If a style change doesn't appear, check the served stylesheet and re-save the file before debugging anything else.

## 3. Do not change

- Anything in `backend/` or `ml/`, `.env*` files, `src/lib/firebase.ts`.
- The function signatures and request shapes in `src/lib/api.ts`, and the sign-in logic in `src/context/AuthContext.tsx` (you may replace its `alert()` calls with inline error UI).
- **The Seer flow.** The owner specified it and it must survive the redesign:
  1. The periodic table is the first thing shown and fits the screen with **no page scroll** (check 1440×860 and 1366×768).
  2. After elements are selected, a panel **emerges from the right**.
  3. The panel offers oxides, ML model, and properties.
  4. Then composition entry in **mol % or weight %**.
  5. The backend calculates in Kelvin; the screen shows **°C** (Kelvin stays visible as secondary text).
- The private dataset stays private: never render individual training rows.
- Regression check: Si+B+Na, 60/20/20 mol %, Random Forest → **569.2 °C** (842.4 K). The same glass as 57.8/22.3/19.9 wt % gives the same answer.

## 4. What is wrong today

Look at the running app first and take screenshots. You will see:

- Raw LaTeX in the UI: `$T_g$` appears as literal text on the sign-in card, sidebar, Bank, Zen and Profile.
- Every piece of text is `font-black`, much of it at 10–11 px. Nothing has hierarchy because everything shouts.
- Every surface is the same puffy double-shadow card in a different pastel, and every screen opens with the same icon-in-a-box banner.
- A purple gradient is the accent for every button and active state.
- Filler content: Profile lists two invented projects, a "Save" button that saves nothing, and "badge" cards ("Verified Units", "Models Loaded") that say nothing. Bank is three cards restating constants.
- Zen swallows errors (`console.error`) and cannot tell "not run yet" from "no matches".
- Units are inconsistent: Seer shows °C; Bank, Zen and the sidebar still show Kelvin.
- No web fonts, default create-next-app SVGs in `public/`, and the theme flashes light before switching to dark on load.
- Almost no motion: a few hover transforms and the Seer panel slide.

## 5. Design direction

**Concept: a lab instrument, not a dashboard.** The reference points are a well-made scientific instrument panel and a figure from a good journal: calm, precise, dense where data is, quiet everywhere else. Personality comes from the subject matter, not from decoration.

Three visuals come straight from glass science. They are the identity; use them instead of stock icons and illustrations.

1. **The cooling curve.** The textbook definition of Tg is the kink where the liquid line bends into the glass line on a volume-vs-temperature plot. Use it as the brand mark and the sign-in visual (the line draws itself, the kink is marked T<sub>g</sub>).
2. **The ternary diagram.** A three-oxide glass is a point in a triangle. Use one `TernaryDiagram` component in Seer (a dot that moves as the composition changes), Bank (the region the training data covers), and Zen (candidates plotted, target-closest highlighted).
3. **The temperature scale.** Show a predicted Tg as a marker on a horizontal °C axis with its error band (± the model's test MAE) and the training range (223–725 °C) shaded. "Compare all 4 models" becomes four markers on one axis, which reads far better than four cards.

Draw these as hand-written SVG. Do not add a chart library.

**Colour.** Keep butter yellow `#FFEE8C`; the owner chose it. Make it mean something: it is the hot end of a thermal ramp (ember red → orange → butter) used **only** to encode temperature. Interactive accent is a single dark ink, not purple. Backgrounds are warm paper in light mode and kiln charcoal in dark mode (not violet-black). Retire the six-pastel rotation; colour should mark meaning (selected, hot/cold, warning), never just distinguish one card from the next.

**Type.** Load two families with `next/font`: one sans with some character for UI and headings, one mono with tabular figures for every number. Do not use Inter, Space Grotesk, Poppins or Instrument Serif. Build a real scale (roughly 12/13/15/18/24/36), use weight 400–500 for body and 600 for emphasis, and keep 800+ for at most one element per screen. Minimum text size 12 px.

**Surfaces.** Flat panels with hairline borders. One elevation level, reserved for things that float (the Seer panel, popovers, toasts). Smaller radii (6–12 px). Remove the clay double shadows and the per-screen banner cards.

**Copy.** Sentence case. Chemistry typeset properly: a `<Tg />` component rendering T<sub>g</sub>, subscripts in SiO₂/B₂O₃/Na₂O. Labels say what a thing is; no marketing voice, no "Physics-Informed" tagline except the project credit line. Keep the names Glass Studio, Seer, Bank, Zen.

**Units.** Show temperatures in °C everywhere with K as secondary text, through one shared formatter. In Zen the user types the target in °C and you convert to K before calling the API (a tolerance of ±20 is the same in both).

**What "AI slop" means here, so you can avoid it:** purple/indigo gradients; glassmorphism or claymorphism on every surface; gradient text; sparkle icons; emoji; a grid of identical rounded cards each with an icon, a title and a sentence; everything bold; centred hero with a tagline; invented stats, names or testimonials; every element fading up on scroll with the same timing; bouncy hover scaling on everything. If a screen could belong to any SaaS product after swapping the logo, redo it.

## 6. Motion

Add the `motion` package (import from `motion/react`; confirm it supports React 19.3 before installing). Define the system once in `src/lib/motion.ts` and use only those tokens:

- Durations: 120 ms (press, hover), 200 ms (small state change), 320 ms (panels, screen changes), 600 ms (data drawing, count-ups).
- One standard ease-out curve for entrances, a faster ease-in for exits, and one spring for things the user directly manipulates.
- Stagger at most 30 ms per item and 400 ms in total.

**Coverage rule:** no state change is an instant swap. **Discipline rule:** every animation must show where something came from or what changed. If you cannot say what it explains, cut it. No looping ambient animation except while loading.

Choreography by screen:

- **App load / sign in.** Cooling curve draws, form fields settle in once. Errors appear inline with a short shake of the field, not an `alert()`. Signing in transitions into the app rather than cutting.
- **Shell.** The active-nav indicator slides between items. Screens cross-slide in the direction of the nav order. The theme toggle is a real transition (view transition or crossfade), and dark mode no longer flashes on load.
- **Seer table.** First visit only: cells arrive in a wave across periods (under 600 ms in total), with Si, B and Na landing last so the eye ends on them. Hover lifts a selectable cell. Selecting presses and springs, and its chip grows into the selection bar; removing reverses it. The Continue button wakes up once when it becomes available.
- **Seer panel.** Slides from the right with the backdrop; the table stays visible behind it. Step 1 ↔ step 2 slide horizontally in the direction of travel. Oxide chips reflow with layout animation. Dragging one slider makes the others glide, and the ternary dot follows. Switching mol % ↔ wt % slides the toggle thumb and rolls the numbers to their converted values.
- **Seer result.** The Predict button becomes the progress indicator. The value counts up, the marker travels along the temperature scale to its place, and the error band opens around it. With all four models, markers land in a short stagger. When inputs change afterwards, the result visibly goes stale (desaturates) until re-run. Warnings slide in below.
- **Bank.** Range bars grow from zero, the ternary coverage region draws its outline then fills, counts tick up. Loading uses skeletons shaped like the content.
- **Zen.** While searching, sweep the ternary diagram to show the grid being screened. Candidates stagger in, closest first; hovering a row highlights its point and vice versa. Give "not run yet", "no matches" and "error" their own states.
- **Profile.** Field edits and confirmations animate in place.

Performance and access:

- Animate `transform`, `opacity`, `translate`, `scale` and SVG stroke properties only. Never animate layout properties on the 118 table cells.
- All motion is interruptible and never blocks input.
- Honour `prefers-reduced-motion`: replace movement with short fades or instant changes, and skip count-ups and the table wave.
- Keyboard works throughout: visible focus rings, arrow keys move between selectable elements, Escape closes the panel, focus moves into and back out of the panel.
- Text contrast meets WCAG AA in both themes.

## 7. Structure

`SeerModule.tsx` (about 790 lines) and `page.tsx` should be split. Suggested layout:

```
src/components/ui/      Button, SegmentedToggle, Slider, NumberField, Drawer, Skeleton
src/components/viz/     TernaryDiagram, TemperatureScale, CoolingCurve
src/components/shell/   AppShell, Nav, SignIn
src/components/seer/    PeriodicTable, SetupPanel, CompositionStep, Results
src/lib/                motion.ts, units.ts, chem.ts
```

Put design tokens in Tailwind 4's `@theme` block in `globals.css`. Delete the `clay-*` classes once nothing uses them. Remove the unused default SVGs in `public/`.

**Content honesty:** do not invent data. Profile shows only what is real (name, email, plan from the API, sign out). Remove the fake projects, the fake Save and the badge cards rather than restyling them, and list what you removed in your final report.

**Responsive:** desktop first. On tablets the nav collapses to icons. On phones the periodic table shrinks to symbols only and still fits the width with no horizontal scroll; the Seer panel becomes full-screen.

**Dependencies:** `motion` and fonts via `next/font` only. Ask before adding anything else.

## 8. How to work

1. **Look first.** Read the files in section 2, run the app, screenshot every screen in both themes.
2. **Foundations.** Tokens, fonts, motion tokens, the `ui/` primitives, the three `viz/` components.
3. **Seer end to end** on the new foundations, with all its motion.
4. **Stop and show the owner** screenshots of sign-in and Seer (light and dark) and a short note on the choices you made. Wait for a go-ahead, because the rest of the app inherits this look.
5. **Shell, Bank, Zen, Profile, sign-in polish.**
6. **Verify, then report.**

Verify in a real browser, not by reading code:

- Every screen at 1440×860, 1366×768, 768×1024 and 375×812, in light and dark.
- Seer has no page scroll at the two desktop sizes.
- The regression prediction in section 3 gives 569.2 °C from both mol % and wt % input.
- Zen returns candidates for a 577 °C target (850 K) ± 20.
- Reduced-motion mode works and nothing is broken by it.
- No console errors. `npx tsc --noEmit` and `npx eslint src` pass in `frontend/`.

Do not commit or push; leave that to the owner. Finish with a short report: what changed, what you removed, anything you could not verify, and any decision you want the owner to confirm.
