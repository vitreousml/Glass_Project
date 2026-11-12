# Glass Composition Prediction Platform (Glass_Project)

A physics-informed machine learning platform for Glass Transition Temperature ($T_g$) prediction, featuring an interactive periodic table, inverse design, and strict authentication.

## Modules

- **Seer (Predict)**: Interactive 118-element periodic table, composition sliders in mol %, model selection across Random Forest, XGBoost, KNN, and SVM, and prediction in Kelvin (K).
- **Bank (Explore)**: Exploration of glass systems (Na₂O - B₂O₃ - SiO₂) and property envelopes without exposing private dataset rows.
- **Zen (Discover)**: Inverse design screening compositions for a target $T_g$.
- **User Profile**: Researcher workspace and project management.

## Monorepo Layout

- **`frontend/`**: Next.js 14+ (App Router, TypeScript, Tailwind CSS with Pastel Claymorphism and Light/Dark themes, Lucide icons, Firebase Auth).
- **`backend/`**: FastAPI REST API service with Firebase Admin ID token authentication, Firestore integration, and Docker containerization ready for Cloud Run.
- **`ml/`**: Read-only directory containing `glass_data.csv` (kept private), `predict_tg.py`, `train_models.py`, and pickled ML models with SHA-256 integrity verification.

## Local Development

### 1. Start FastAPI Backend

```bash
cd backend
venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

The interactive OpenAPI docs will be available at `http://127.0.0.1:8000/docs`.

### 2. Start Next.js Frontend

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.
