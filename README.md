# Glass Composition Prediction Platform

A PyGGi-style platform with authentication, interactive periodic table, and ML-based Glass Transition Temperature ($T_g$) prediction.

## Monorepo Layout

- **`frontend/`**: Next.js 14+ (App Router, Tailwind CSS, Lucide icons).
  - Authentication flow (Email/Password & Google login).
  - 3 Modules: **Seer** (Periodic table element picker, composition sliders, model selector, prediction cards), **Bank** (Explore compositions and parameter envelopes), **Zen** (Inverse design).
- **`backend/`**: FastAPI service wrapping the frozen ML models.
  - Endpoints: `/api/v1/predict`, `/api/v1/elements`, `/api/v1/models/info`, `/api/v1/bank/summary`, `/api/v1/zen/discover`.
  - Checksum verification for all `.pkl` models at startup.
- **`ml/`**: Read-only directory containing `glass_data.csv` (kept private), `predict_tg.py`, `train_models.py`, and the saved models (`Tg_RF.pkl`, `Tg_XGB.pkl`, `Tg_KNN.pkl`, `Tg_SVM.pkl`).

## Local Development

### 1. Start FastAPI Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

The API docs will be available at `http://127.0.0.1:8000/docs`.

### 2. Start Next.js Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.

