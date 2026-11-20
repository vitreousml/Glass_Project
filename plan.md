# Admin Portal Plan

A plan for letting a non-technical admin add new prediction models and new elements to the Glass Composition Prediction Platform by drag and drop, with the changes showing up across the whole portal. This is a plan only; no code has been written.

## Goal

The admin drops a model file onto a page. The server checks it, the admin confirms a pre-filled summary, and the model goes live in Seer, Zen, Bank and reports within about 15 seconds. If the model uses an element the portal doesn't support yet, that element is added as part of the same flow. No developer, no redeploy.

"Environment" here means **new elements plus new models for prediction**. It does not mean Python library environments.

## Where things stand today

Adding a model currently needs a developer, because these are fixed in code:

| What | Where |
|---|---|
| Model list `RF, XGB, KNN, SVM` | `backend/app/ml_adapter.py` (`MODELS`) |
| Supported oxides and molar masses | `backend/app/ml_adapter.py` (`OXIDE_MAP`, `MOLAR_MASSES`) |
| One property, Tg | `backend/app/ml_adapter.py` (`PROPERTIES`, `PREDICTORS`) |
| Metrics and display names | `backend/app/ml_adapter.py` (`get_models_metadata`) |
| Checksums for exactly 4 files | `backend/app/ml_adapter.py` (`EXPECTED_HASHES`) |
| Bank summary, ranges, sample count | `backend/app/main.py` (`/api/v1/bank/summary`) |
| Zen search: a fixed SiO2–B2O3–Na2O grid for Tg | `backend/app/main.py` (`/api/v1/zen/discover`) |
| Which elements are selectable | `frontend/src/data/elements.ts` (`supported`, `noModel` flags) |
| Model and oxide names in the UI | `SetupStep.tsx`, `SeerModule.tsx`, `ZenModule.tsx`, `TernaryDiagram.tsx`, `OxideProfile.tsx`, `chem.ts` |
| Model files | Baked into the Docker image (`COPY ml /ml`) |

One thing already helps: each `.pkl` produced by `ml/train_models.py` is a self-describing bundle. It carries `model`, `features`, `feature_min`, `feature_max`, `unit`, `target`, `test_metrics`, `n_samples`, `best_params`, `trained_on` and `composition_sum`. The server can read almost everything it needs from the file itself.

## Architecture

```
Admin browser ──upload──> Cloud Storage (private bucket: model files)
      │                          │
      ▼                          ▼
  FastAPI backend ── Firestore registry (models, properties, oxides, audit log)
      │   ├─ validator (checks every upload before it can go live)
      │   ├─ generic predictor (loads any registered model, caches it)
      │   └─ catalog endpoint (one list of everything that is live)
      ▼
  Next.js frontend: Seer, Zen, Bank and reports all read the catalog
```

- **Model files** live in a private Cloud Storage bucket. Cloud Run's disk is wiped on restart, so uploads cannot be kept in the `ml/` folder.
- **The registry** is a set of Firestore collections, alongside the existing `users` data.
- **The validator** runs every check on an upload before it can be published.
- **The generic predictor** replaces the per-model code paths. It loads any registered model from the bucket, caches it in memory, and predicts.
- **The catalog** is one endpoint that returns the live models, properties and supported oxides. Every page reads it instead of hardcoded lists.
- **The professor's `ml/` code stays untouched.** The generic loader lives in the backend. The 4 current models are copied into the registry as built-ins, and the Docker image keeps them as a fallback if the registry can't be reached.

## What the admin does

### Adding a model

1. **Drop** the model file anywhere on the Models page.
2. **Watch the checks** run as a live checklist, with plain-language errors.
3. **Review** a pre-filled summary: what it predicts, the unit, the input oxides, the training ranges and the accuracy numbers. The admin edits only the display name and description.
4. **Try it** with composition sliders, side by side with the existing models.
5. **Publish.** The model appears across the portal within about 15 seconds.

### Adding a new element

There is no separate step. The model file names its own inputs in its `features` list, so a model trained with `Al2O3` announces the new element itself.

1. The server reads the input list and spots any oxide the portal doesn't have yet.
2. It looks the oxide up in a built-in reference table, which gives the element and the molar mass.
3. The review screen says, for example, "This model adds 1 new element: Aluminium (Al2O3)". The admin confirms.
4. On publish, the element lights up on the periodic table.

If an oxide isn't in the reference table, the admin picks the element on a periodic table and the molar mass is calculated from the formula. The admin never types chemistry data.

### Other admin screens

- **Models home:** all models grouped by property, with status (draft, live, archived).
- **Model detail:** deactivate, roll back to the previous version, set as the default.
- **Properties:** add a new one, such as density, with its unit.
- **Activity log:** who changed what, and when.

Guard rails:
- Models are archived, never deleted, so old predictions and reports still display.
- The portal warns before the last live model for a property is switched off.

## Checks on every upload

| Check | What it catches |
|---|---|
| File type, size limit, duplicate hash | Wrong or repeated file |
| Loads in an isolated process with a time and memory limit | Broken or hostile file |
| Bundle has the required fields | Model not exported the standard way |
| Library versions match the server | A scikit-learn or xgboost mismatch |
| Inputs are oxide percentages the portal can identify | Inputs a user could never type in |
| Test predictions are finite and in a plausible range | A model that loads but gives nonsense |
| Metrics read from the bundle, re-scored if a reference dataset exists | Overstated accuracy |

Failures are shown in plain language, for example: "This file was made with scikit-learn 1.5. The portal runs 1.8. Ask the person who trained it to re-export it."

## What gets stored

| Collection | Holds |
|---|---|
| `models` | Name, short code, property, input oxides and training ranges, unit, metrics, file path, hash, status, version, who uploaded it |
| `properties` | Name, unit, unit type (so K to °C conversion applies only to temperatures), plausible range |
| `oxides` | Reference table: formula, element, molar mass |
| `datasets` | Optional training CSVs for Bank and for re-checking accuracy |
| `auditLog` | Every admin action with before and after values |
| `registry/meta` | A version counter that tells servers and browsers to refresh |

Model status moves through: draft → checking → ready → live → archived. A failed check stops at "failed" with its report attached.

## Making it reflect everywhere

- **Backend constants** (`MODELS`, `PROPERTIES`, `OXIDE_MAP`, `MOLAR_MASSES`, the bank summary, the model-name validation) are replaced by lookups in the catalog.
- **Seer:** an element is selectable when any live model uses its oxide. The hand-set `supported` and `noModel` flags in `elements.ts` become automatic.
- **Matching models to the selection:** models will cover different oxide sets. Seer shows only the models that cover every oxide the user picked. An oxide the user left out is sent as 0, with a warning if 0 is outside that model's training range.
- **Weight % conversion** uses molar masses from the oxide reference table.
- **Zen:** the fixed three-oxide grid becomes a sampled search over whichever oxides the chosen model uses, within its training ranges, for any property.
- **Charts:** the ternary diagram only fits three oxides. Systems with more need a table or another view.
- **Bank:** it only has data for the three current oxides. The admin can optionally drop the training CSV alongside the model, so Bank shows the new data.
- **Saved predictions and reports** store the model's ID, version and name at the time, so history survives a model being archived.
- **Refresh:** each server instance caches loaded models and re-checks the registry version counter every few seconds. The frontend re-fetches the catalog when the counter changes. This is where the 15 seconds comes from.

## Rules for whoever trains the models

The no-code experience depends on these.

- **Use the standard bundle format** produced by `ml/train_models.py`, or export to ONNX.
- **Inputs must be oxide percentages only.** The dataset has structural columns (Q4…B0). If a future model needs those as inputs, a user can't type them, so the model file must calculate them internally.
- **Use the same library versions as the server** (scikit-learn 1.8.0, xgboost 3.1.2, pandas 2.3.3, numpy 2.4.0, joblib 1.5.3), or export to ONNX. A mismatched file is rejected at upload.

## Security

- **Admin role:** a Firebase custom claim, checked by the backend on every admin endpoint. The current `role` field in the user record is only display text.
- **Fix first, mock login:** `backend/app/firebase_auth.py` accepts any token starting with `mock_dev_token_`, with no check that the server is in development. Today that lets anyone call the signed-in endpoints. It must be limited to development, and must never carry the admin role.
- **Fix first, CORS:** `backend/app/main.py` allows every origin. Restrict it to the portal's domain.
- **Pickle risk:** a `.pkl` file can run code when it is loaded, so an admin account is effectively server access. Only admins can upload, files load in an isolated process, and every upload is logged. ONNX files don't carry this risk.
- **Bucket access:** private, readable and writable only by the backend's service account. Browsers upload through short-lived signed links.
- **Registry writes** go only through the backend. Browsers never write to the registry directly.

## Build order

Estimates are rough guesses for one developer.

| Phase | Work | Estimate |
|---|---|---|
| 0 | Security fixes, admin role | 1–2 days |
| 1 | Registry, catalog, oxide reference table, generic predictor, the 4 models migrated, frontend reading the catalog | 1.5 weeks |
| 2 | Admin portal: drop a model, checks, new-element detection, publish, roll back, audit log | 2 weeks |
| 3 | Zen for any oxide set, non-ternary charts, Bank dataset upload, new properties | 2 weeks |

After Phase 1 nothing looks different to users, but the portal no longer depends on hardcoded lists. After Phase 2 the admin can add models and elements. Phase 3 makes every module work fully with them.

## Open questions

- **Hosting:** the plan assumes the backend runs on Cloud Run. Confirm, because storage and refresh are designed around it.
- **Admins:** who gets the admin role, and how many people.
- **Model format:** confirm the people training models can deliver the standard bundle or ONNX.
- **Out-of-range inputs:** whether Seer should warn or block when a composition is outside a model's training range.
