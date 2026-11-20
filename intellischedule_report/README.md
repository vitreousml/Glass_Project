# IntelliSchedule report (Overleaf sources)

## Uploading to Overleaf

1. In your Overleaf project, keep `tietreport.cls` (and any logo files) as they are.
2. Replace `main.tex` and `references.bib` with the two files in this folder.
3. Compiler: pdfLaTeX (the default). Bibliography: Biber (the template already uses `backend=biber`).
4. Recompile. Overleaf runs Biber automatically; if references show as `[?]`, use "Recompile from scratch".

The report uses only standard TeX Live packages: amsmath, amssymb, booktabs, tabularx, tikz, pgfplots, algorithm, algpseudocode.
All figures are drawn in TikZ/pgfplots, so there are no image files to upload.

## Before submitting

Search `main.tex` for `TODO` and fill in:
- the course code and title (`\TitlePageHeader`)
- names and roll numbers (`\author`)
- group number and year (`\TitlePageSubText`)
- supervisor (`\AdvisorName`)
- "Mid-Semester Evaluation" in the footer, if this is for a different evaluation

## evidence/

Raw outputs behind every number in Chapter 4, measured on commit `cfca8da` of
https://github.com/Uddeshya112/project (Windows 11, Intel Core i5-1340P, 16 GB, Node.js 22.23.5):

| File | What it is |
| --- | --- |
| `project_unit_and_e2e.txt` | `npm test`: 24/24 unit tests, 53/54 end-to-end checks |
| `project_security_suite.txt` | `npm run test:security`: 18/20 |
| `project_solver_suite.txt` | `npm run test:solver` |
| `bench.mts` | Our measurement harness (imports the engine unchanged) |
| `bench_final_log.txt` | Run used for Table 4.3 (Phase A/B), diversity, and violation classification |
| `bench_final2_log.txt`, `bench_final2.json` | Run used for scaling, room sweep, recovery, bcrypt, default routines |
| `tight2.mts` | Follow-up room sweep at 33/32/31/30/28 rooms |

To rerun: copy `bench.mts` (and `tight2.mts`) into the repository's `scripts/` folder, run `npm install`, then from the repository root:
`node --import tsx scripts/bench.mts results.json`
