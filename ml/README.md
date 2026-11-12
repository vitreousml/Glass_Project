# ML Assets Registry & Verification

Frozen on: November 12, 2026  
Status: **READ-ONLY / FROZEN** (No retraining, no modification of model files)

## Project Parameters & Units Confirmed

- **Project Name**: Glass Composition Prediction Platform (temporary placeholder)
- **Target Property**: Glass Transition Temperature ($T_g$)
- **Unit for $T_g$**: **Kelvin (K)** (Confirmed)
- **Composition Basis**: **mol %** (Confirmed)
- **Active Modules**: Seer (Prediction), Bank (Explore), Zen (Inverse Design)
- **Dataset Visibility**: Private (`glass_data.csv` stays strictly on the server; predictions visible only to signed-in users)
- **Attribution**: Pending verification of original publication citation
- **Hosting Strategy**: Free-tier only (Cloud Run free tier, Firebase Auth free tier, no paid storage, scale-to-zero)

## Verified SHA-256 Checksums

| File | SHA-256 Checksum |
|---|---|
| `glass_data.csv` | `218B6EB440249B95E60F7DE97A4C51D7EB1DF0CC2844205A236123B8999F1086` |
| `predict_tg.py` | `18107CECB9366200751173AF9ABCB4196E31DA2B7252DEBF10D27B1BE9418810` |
| `train_models.py` | `9A6A15C37A6F0853EAD8C6A59D95805F5546FABCDF5A89C6F1CA6B1D9989DDD1` |
| `models/Tg_RF.pkl` | `39F888306D108A8948B84B6312E48753D598F3A09AF7B1E1D76620376DBE487F` |
| `models/Tg_XGB.pkl` | `95BCE93450D8F54A63F98426C30209542679137FFA8A8CC1CD5884CE0C28FDEF` |
| `models/Tg_KNN.pkl` | `D2535C29F3B19D2C20C2FA4C48DC9AA3B1722A345C658A0BEB8EF3F4EDDA6DE3` |
| `models/Tg_SVM.pkl` | `B92C3B9877D5599339F6E172C0ACED6112784CB9F565BB107516998F0DF761A2` |
| `models/model_performance.csv` | `8A141285F9DF2DD881C57C9EA2CB3621A2C991236BFA36550D32BA81CE010154` |
| `models/requirements.txt` | `74F652DB2B304E06E7E04E4BCE28935E725DA7BE6FE56980A727E76A7D624DCE` |

## Model Performance Summary (80/20 Test Split)

| Model | MAE (K) | RMSE (K) | $R^2$ |
|---|---|---|---|
| Random Forest (RF) | 14.85 | 21.78 | 0.878 |
| XGBoost (XGB) | 15.75 | 22.24 | 0.873 |
| K-Nearest Neighbors (KNN) | 17.82 | 24.98 | 0.840 |
| Support Vector Machine (SVM) | 22.37 | 28.94 | 0.785 |
