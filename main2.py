
# ============================================================
# Cars Dataset: Multiple Linear Regression
# CRISP-DM + 5 Feature Selection Methods
# ============================================================

# pip install -U pandas numpy matplotlib scikit-learn statsmodels joblib

import itertools
import time
import warnings
import json
import hashlib
from pathlib import Path
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import statsmodels.api as sm
import joblib

from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.feature_selection import (
    RFECV, SequentialFeatureSelector, f_regression
)
from sklearn.linear_model import LinearRegression, LassoCV
from sklearn.model_selection import (
    train_test_split, KFold, cross_val_score, cross_validate
)
from sklearn.metrics import (
    mean_absolute_error, mean_squared_error, r2_score
)

SEED = 42
CV_OUTER = KFold(3, shuffle=True, random_state=SEED)
CV_INNER = KFold(3, shuffle=True, random_state=SEED)
SCORING = "neg_root_mean_squared_error"

NUMERIC = [
    "AWD", "RWD", "Engine Size (l)", "Cyl",
    "Horsepower(HP)", "City Miles Per Gallon",
    "Highway Miles Per Gallon", "Weight",
    "Wheel Base", "Len", "Width"
]
CATEGORICAL = ["Brand", "Type"]


# ============================================================
# 1. BUSINESS UNDERSTANDING
# Goal: Predict Retail Price
# ============================================================

print("1. Business Understanding")
print("Target: Retail Price")
print("Model: Multiple Linear Regression")


# ============================================================
# 2. DATA UNDERSTANDING
# ============================================================

url = (
    "https://raw.githubusercontent.com/"
    "uwdata/draco/master/data/cars.csv"
)

PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = PROJECT_ROOT / "results" / "cars"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DATA_PATH = PROJECT_ROOT / "data" / "cars.csv"
df = pd.read_csv(DATA_PATH if DATA_PATH.exists() else url)

print("\n2. Data Understanding")
print("Dataset Shape:", df.shape)
print("\nMissing Values:\n", df.isna().sum())
print("\nVehicle Types:\n", df["Type"].value_counts())


# ============================================================
# 3. DATA PREPARATION
# ============================================================

# Feature engineering inside Pipeline:
# Name -> Brand, plus data cleaning

class FeatureBuilder(BaseEstimator, TransformerMixin):

    def fit(self, X, y=None):
        return self

    def transform(self, X):
        data = X.copy()

        data["Brand"] = (
            data["Name"]
            .fillna("Unknown")
            .astype(str)
            .str.split()
            .str[0]
        )

        data["Brand"] = data["Brand"].replace({
            "Chrvsler": "Chrysler",
            "Mazda6": "Mazda",
            "Land": "Land Rover"
        })

        data[NUMERIC] = data[NUMERIC].apply(
            pd.to_numeric, errors="coerce"
        )

        invalid_zero = [
            c for c in NUMERIC if c not in ["AWD", "RWD"]
        ]

        data[invalid_zero] = data[
            invalid_zero
        ].replace(0, np.nan)

        return data[NUMERIC + CATEGORICAL]


# Target: Retail Price
# Exclude Dealer Cost to focus on vehicle specifications

y = pd.to_numeric(df["Retail Price"], errors="coerce")
valid = y.notna() & (y > 0)

X = df.loc[valid].drop(
    columns=["Retail Price", "Dealer Cost"]
).copy()
y = y.loc[valid].copy()

X_train, X_test, y_train, y_test = train_test_split(
    X, y,
    test_size=0.20,
    random_state=SEED
)


# ============================================================
# Shared preprocessing
# ============================================================

def build_preprocessor():

    numeric_pipe = Pipeline([
        ("imputer", SimpleImputer(
            strategy="median",
            keep_empty_features=True
        ))
    ])

    category_pipe = Pipeline([
        ("imputer", SimpleImputer(
            strategy="most_frequent"
        )),
        ("onehot", OneHotEncoder(
            drop="first",
            handle_unknown="infrequent_if_exist",
            min_frequency=3,
            sparse_output=False
        ))
    ])

    return ColumnTransformer([
        ("num", numeric_pipe, NUMERIC),
        ("cat", category_pipe, CATEGORICAL)
    ])


# ============================================================
# Shared selector utilities
# ============================================================

class MaskSelector(BaseEstimator, TransformerMixin):

    def transform(self, X):
        return np.asarray(X)[:, self.support_]

    def get_support(self):
        return self.support_

def feature_scores(X, y):
    # Handle constant-feature warnings
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", RuntimeWarning)
        scores, _ = f_regression(X, y)

    return np.nan_to_num(
        scores,
        nan=-np.inf,
        posinf=np.finfo(float).max,
        neginf=-np.inf
    )


# ============================================================
# METHOD 1: Exhaustive Feature Selection (EFS)
# ============================================================

class EFSSelector(MaskSelector):

    def __init__(self, top_k=8, max_size=3):
        self.top_k = top_k
        self.max_size = max_size

    def fit(self, X, y):
        X = np.asarray(X)
        scores = feature_scores(X, y)

        candidates = np.argsort(scores)[::-1][
            :min(self.top_k, X.shape[1])
        ]

        best_rmse = np.inf
        best_indices = None

        for k in range(
            1, min(self.max_size, len(candidates)) + 1
        ):
            for combo in itertools.combinations(
                candidates, k
            ):
                idx = list(combo)

                scores_cv = cross_val_score(
                    LinearRegression(),
                    X[:, idx],
                    y,
                    cv=CV_INNER,
                    scoring=SCORING,
                    n_jobs=1
                )

                rmse = -scores_cv.mean()

                if rmse < best_rmse:
                    best_rmse = rmse
                    best_indices = idx

        self.support_ = np.zeros(
            X.shape[1], dtype=bool
        )
        self.support_[best_indices] = True
        return self


# ============================================================
# METHOD 3: Lasso Feature Selection
# ============================================================

class LassoSelector(MaskSelector):

    def fit(self, X, y):
        self.lasso_ = LassoCV(
            alphas=100,
            cv=CV_INNER,
            max_iter=50000,
            random_state=SEED,
            n_jobs=-1
        )
        self.lasso_.fit(X, y)

        coef = np.abs(self.lasso_.coef_)
        self.support_ = coef > 1e-6

        if not self.support_.any():
            self.support_[np.argmax(coef)] = True

        return self


# ============================================================
# METHOD 4: Backward Elimination
# ============================================================

class BackwardSelector(MaskSelector):

    def __init__(self, threshold=0.05):
        self.threshold = threshold

    def fit(self, X, y):
        X = np.asarray(X, dtype=float)
        remaining = list(range(X.shape[1]))

        while len(remaining) > 1:
            X_ols = sm.add_constant(
                X[:, remaining],
                has_constant="add"
            )

            result = sm.OLS(
                np.asarray(y), X_ols
            ).fit()

            pvalues = np.asarray(
                result.pvalues[1:]
            )
            pvalues = np.nan_to_num(
                pvalues, nan=1.0
            )

            worst = np.argmax(pvalues)

            if pvalues[worst] <= self.threshold:
                break

            remaining.pop(worst)

        self.support_ = np.zeros(
            X.shape[1], dtype=bool
        )
        self.support_[remaining] = True

        return self


# ============================================================
# METHOD 5: Sequential Forward Selection (SFS)
# ============================================================

class SFSSelector(MaskSelector):

    def __init__(self, top_k=15, select_k=8):
        self.top_k = top_k
        self.select_k = select_k

    def fit(self, X, y):
        X = np.asarray(X)

        scores = feature_scores(X, y)

        candidates = np.argsort(scores)[::-1][
            :min(self.top_k, X.shape[1])
        ]

        if len(candidates) <= 1:
            chosen = candidates
        else:
            n_select = min(
                self.select_k,
                len(candidates) - 1
            )

            selector = SequentialFeatureSelector(
                LinearRegression(),
                n_features_to_select=n_select,
                direction="forward",
                scoring=SCORING,
                cv=CV_INNER,
                n_jobs=-1
            )

            selector.fit(X[:, candidates], y)

            chosen = candidates[
                selector.get_support()
            ]

        self.support_ = np.zeros(
            X.shape[1], dtype=bool
        )
        self.support_[chosen] = True

        return self


# ============================================================
# 4. MODELING
# ============================================================

# Every method uses the same final regressor:
# LinearRegression()

def make_pipeline(method):

    if method == "Baseline":
        selector = "passthrough"

    elif method == "EFS":
        selector = EFSSelector(top_k=8, max_size=3)

    elif method == "RFECV":
        selector = RFECV(
            LinearRegression(),
            step=3,
            min_features_to_select=2,
            cv=CV_INNER,
            scoring=SCORING,
            n_jobs=-1
        )

    elif method == "Lasso":
        selector = LassoSelector()

    elif method == "Backward":
        selector = BackwardSelector(threshold=0.05)

    elif method == "SFS":
        selector = SFSSelector(
            top_k=15, select_k=8
        )

    else:
        raise ValueError("Unknown method: " + method)

    return Pipeline([
        ("features", FeatureBuilder()),
        ("preprocess", build_preprocessor()),
        ("scaler", StandardScaler()),
        ("selection", selector),
        ("regressor", LinearRegression())
    ])


methods = [
    "Baseline",
    "EFS",
    "RFECV",
    "Lasso",
    "Backward",
    "SFS"
]


# ============================================================
# 5. EVALUATION
# Compare methods using training CV only
# ============================================================

print("\n5. Cross-Validation Comparison")

records = []

for method in methods:

    start = time.perf_counter()
    model = make_pipeline(method)

    # Each outer fold fits preprocessing and selector again.
    cv_scores = cross_val_score(
        model,
        X_train,
        y_train,
        cv=CV_OUTER,
        scoring=SCORING,
        n_jobs=1,
        error_score="raise"
    )

    rmse_values = -cv_scores
    elapsed = time.perf_counter() - start

    records.append({
        "Method": method,
        "CV_RMSE": rmse_values.mean(),
        "CV_STD": rmse_values.std(),
        "Seconds": elapsed
    })

    print(
        f"{method:10s} | "
        f"RMSE: {rmse_values.mean():.2f} | "
        f"Time: {elapsed:.1f}s"
    )

comparison = pd.DataFrame(records)
comparison = comparison.sort_values(
    "CV_RMSE"
).reset_index(drop=True)

print("\n===== CV Comparison =====")
print(comparison.round(2).to_string(index=False))


# ============================================================
# Fit all methods on full training data
# Report selected features without looking at test set
# ============================================================

fitted_models = {}
feature_records = []

for method in methods:

    model = make_pipeline(method)
    model.fit(X_train, y_train)

    fitted_models[method] = model

    names = model.named_steps[
        "preprocess"
    ].get_feature_names_out()

    selector = model.named_steps["selection"]

    if selector == "passthrough":
        chosen = names
    else:
        chosen = names[selector.get_support()]

    feature_records.append({
        "Method": method,
        "Selected_Count": len(chosen),
        "Selected_Features": list(chosen)
    })

    print(f"\n===== {method} =====")
    print("Selected Count:", len(chosen))
    print("Features:", list(chosen))

feature_df = pd.DataFrame(feature_records)

comparison = comparison.merge(
    feature_df[["Method", "Selected_Count"]],
    on="Method"
)

print("\n===== Final Training Summary =====")
print(
    comparison.round(2).to_string(index=False)
)


# ============================================================
# Final evaluation on untouched test set
# ============================================================

# Choose using CV RMSE, NOT Test RMSE
best_method = comparison.iloc[0]["Method"]
best_model = fitted_models[best_method]

y_pred = best_model.predict(X_test)

mae = mean_absolute_error(y_test, y_pred)
rmse = np.sqrt(mean_squared_error(y_test, y_pred))
r2 = r2_score(y_test, y_pred)

print("\n===== Final Test Results =====")
print("Best Method:", best_method)
print("Selected Features:",
      comparison.iloc[0]["Selected_Count"])
print(f"Test MAE : {mae:.2f}")
print(f"Test RMSE: {rmse:.2f}")
print(f"Test R2  : {r2:.4f}")


# ============================================================
# Visualization 1: CV RMSE Comparison
# ============================================================

plt.figure(figsize=(10, 5))

plt.bar(
    comparison["Method"],
    comparison["CV_RMSE"]
)

plt.errorbar(
    comparison["Method"],
    comparison["CV_RMSE"],
    yerr=comparison["CV_STD"],
    fmt="none",
    capsize=4,
    color="black"
)

plt.title("Feature Selection - Cross Validation RMSE")
plt.xlabel("Method")
plt.ylabel("CV RMSE ($)")
plt.xticks(rotation=30)
plt.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.show()


# ============================================================
# Visualization 2: Feature Count
# ============================================================

plt.figure(figsize=(10, 5))

plt.bar(
    comparison["Method"],
    comparison["Selected_Count"]
)

plt.title("Number of Selected Features")
plt.xlabel("Method")
plt.ylabel("Feature Count")
plt.xticks(rotation=30)
plt.tight_layout()
plt.show()


# ============================================================
# Visualization 3: Actual vs Predicted
# ============================================================

plt.figure(figsize=(7, 6))
plt.scatter(y_test, y_pred, alpha=0.7)

low = min(y_test.min(), y_pred.min())
high = max(y_test.max(), y_pred.max())

plt.plot([low, high], [low, high], "r--")
plt.title(f"Actual vs Predicted - {best_method}")
plt.xlabel("Actual Retail Price ($)")
plt.ylabel("Predicted Retail Price ($)")
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()


# ============================================================
# Visualization 4: Residual Plot
# ============================================================

residuals = y_test.to_numpy() - y_pred

plt.figure(figsize=(7, 5))
plt.scatter(y_pred, residuals, alpha=0.7)
plt.axhline(0, color="red", linestyle="--")

plt.title("Residual Plot")
plt.xlabel("Predicted Price ($)")
plt.ylabel("Residual ($)")
plt.grid(alpha=0.3)
plt.tight_layout()
plt.show()


# ============================================================
# 6. DEPLOYMENT
# ============================================================

# Save complete pipeline (including feature engineering)
joblib.dump(
    best_model,
    OUTPUT_DIR / "cars_best_mlr_pipeline.pkl"
)

comparison.to_csv(
    OUTPUT_DIR / "cars_method_comparison.csv",
    index=False
)

feature_df.to_csv(
    OUTPUT_DIR / "cars_selected_features.csv",
    index=False
)

print("\n6. Deployment")
print("Best method:", best_method)
print("Model and comparison results saved.")

# Export the actual experiment outputs for the static GitHub Pages dashboard.
# Keep the original model-selection protocol: only the CV winner is tested.
features_by_method = {row["Method"]: row["Selected_Features"] for row in feature_records}
experiment = {
    "source": url,
    "data_sha256": hashlib.sha256(DATA_PATH.read_bytes()).hexdigest() if DATA_PATH.exists() else None,
    "seed": SEED,
    "raw_count": len(df),
    "valid_count": len(X),
    "train_count": len(X_train),
    "test_count": len(X_test),
    "input_count": len(NUMERIC) + len(CATEGORICAL),
    "encoded_count": len(fitted_models["Baseline"].named_steps["preprocess"].get_feature_names_out()),
    "methods": [
        {
            "method": row["Method"],
            "cv_rmse": float(row["CV_RMSE"]),
            "cv_std": float(row["CV_STD"]),
            "seconds": float(row["Seconds"]),
            "count": int(row["Selected_Count"]),
            "features": features_by_method[row["Method"]],
        }
        for row in comparison.to_dict(orient="records")
    ],
    "best_method": best_method,
    "test": {"mae": float(mae), "rmse": float(rmse), "r2": float(r2)},
    "predictions": [
        {"name": str(X_test.iloc[i]["Name"]), "actual": float(actual),
         "predicted": float(predicted), "residual": float(actual - predicted)}
        for i, (actual, predicted) in enumerate(zip(y_test, y_pred))
    ],
}
payload = json.dumps(experiment, ensure_ascii=False, indent=2, allow_nan=False)
(OUTPUT_DIR / "experiment.json").write_text(payload + "\n", encoding="utf-8")
(PROJECT_ROOT / "docs" / "cars-data.js").write_text(
    "const CARS_EXPERIMENT = " + payload + ";\n", encoding="utf-8"
)
print("Exported Cars dashboard data.")


# Fixed-count diagnostics for all five schemes (training CV only).
from cars_feature_curves import export_feature_curves

export_feature_curves(make_pipeline, X_train, y_train, CV_OUTER, OUTPUT_DIR)
