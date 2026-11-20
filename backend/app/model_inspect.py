"""
model_inspect.py
----------------
Opens one uploaded model file in its own process and reports what is inside,
as JSON on stdout. The server runs this with a time limit (and, on Linux, a
memory limit), so a broken or hostile file can't hang or crash the server.

    python -I model_inspect.py <model file> [<reference csv>]
"""

import json
import math
import random
import sys
import warnings

META_KEYS = [
    "model_name", "target", "unit", "features", "feature_min", "feature_max",
    "composition_sum", "test_metrics", "n_samples", "best_params", "trained_on", "versions",
]


def jsonable(value):
    try:
        json.dumps(value)
        return value
    except TypeError:
        if isinstance(value, dict):
            return {str(k): jsonable(v) for k, v in value.items()}
        if isinstance(value, (list, tuple)):
            return [jsonable(v) for v in value]
        try:
            return float(value)
        except Exception:
            return str(value)


def test_rows(features, fmin, fmax, total):
    """A few compositions inside the training ranges (fixed seed, so results repeat)."""
    rng = random.Random(7)
    rows = []
    for i in range(6):
        row = []
        for f in features:
            lo, hi = float(fmin.get(f, 0.0)), float(fmax.get(f, 100.0))
            row.append((lo + hi) / 2 if i == 0 else rng.uniform(lo, hi))
        s = sum(row)
        if total and s > 0:
            row = [v * total / s for v in row]
        rows.append(row)
    return rows


def main():
    out = {"ok": False}
    try:  # Linux only: cap memory at 2 GB
        import resource

        limit = 2 * 1024 ** 3
        resource.setrlimit(resource.RLIMIT_AS, (limit, limit))
    except Exception:
        pass

    path = sys.argv[1]
    ref_csv = sys.argv[2] if len(sys.argv) > 2 else ""

    import joblib

    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        try:
            bundle = joblib.load(path)
        except Exception as e:
            out.update({"stage": "load", "error": f"{type(e).__name__}: {e}"})
            print(json.dumps(out))
            return
    out["load_warnings"] = [f"{type(w.message).__name__}: {w.message}" for w in caught][:10]

    if not isinstance(bundle, dict):
        out.update({"ok": True, "is_bundle": False, "type": type(bundle).__name__})
        print(json.dumps(out))
        return

    model = bundle.get("model")
    out.update({
        "ok": True,
        "is_bundle": True,
        "keys": sorted(str(k) for k in bundle.keys()),
        "meta": {k: jsonable(bundle.get(k)) for k in META_KEYS if k in bundle},
        "estimator": type(model).__name__ if model is not None else None,
        "has_predict": callable(getattr(model, "predict", None)),
    })

    features = bundle.get("features")
    if out["has_predict"] and isinstance(features, (list, tuple)) and features:
        import pandas as pd

        features = [str(f) for f in features]
        fmin = bundle.get("feature_min") or {}
        fmax = bundle.get("feature_max") or {}
        try:
            rows = test_rows(features, fmin, fmax, bundle.get("composition_sum") or 100.0)
            preds = model.predict(pd.DataFrame(rows, columns=features))
            out["test_predictions"] = [float(p) for p in preds]
        except Exception as e:
            out["predict_error"] = f"{type(e).__name__}: {e}"

        target = bundle.get("target")
        if ref_csv and target and "predict_error" not in out:
            try:
                df = pd.read_csv(ref_csv)
                if all(f in df.columns for f in features) and target in df.columns:
                    df = df.dropna(subset=features + [target])
                    if len(df):
                        pred = model.predict(df[features].astype(float))
                        errors = [abs(float(p) - float(t)) for p, t in zip(pred, df[target])]
                        out["reference"] = {
                            "n": len(errors),
                            "mae": sum(errors) / len(errors),
                            "finite": all(math.isfinite(e) for e in errors),
                        }
            except Exception as e:
                out["reference_error"] = f"{type(e).__name__}: {e}"

    print(json.dumps(out))


if __name__ == "__main__":
    main()
