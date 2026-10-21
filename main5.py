
# ============================================================
# Toyota Corolla Dataset: Multiple Linear Regression
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

EXCLUDED_INPUTS = ["model", "cylinders", "mfg_month", "mfg_year"]
CATEGORICAL = ["fuel_type", "color"]
NUMERIC = [
    "age_08_04", "km", "hp", "met_color", "automatic", "cc", "doors",
    "gears", "quarterly_tax", "weight", "mfr_guarantee", "bovag_guarantee",
    "guarantee_period", "abs", "airbag_1", "airbag_2", "airco",
    "automatic_airco", "boardcomputer", "cd_player", "central_lock",
    "powered_windows", "power_steering", "radio", "mistlamps", "sport_model",
    "backseat_divider", "metallic_rim", "radio_cassette",
    "parking_assistant", "tow_bar"
]
assert len(NUMERIC) + len(CATEGORICAL) == 33


# ============================================================
# 1. BUSINESS UNDERSTANDING
# Goal: Predict price
# ============================================================

print("1. Business Understanding")
print("Target: price")
print("Model: Multiple Linear Regression")


# ============================================================
# 2. DATA UNDERSTANDING
# ============================================================

PROJECT_ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = PROJECT_ROOT / "results" / "toyota_corolla"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
DATA_PATH = PROJECT_ROOT.parent / "ToyotaCorolla.csv"
url = str(DATA_PATH)
df = pd.read_csv(DATA_PATH)
RAW_COUNT = len(df)
df = df.drop_duplicates().copy()
DEDUPLICATED_COUNT = len(df)
print(f"Raw rows: {RAW_COUNT}; after deduplication: {len(df)}")

print("\n2. Data Understanding")
print("Dataset Shape:", df.shape)
print("\nMissing Values:\n", df.isna().sum())
print("\nVehicle Types:\n", df["fuel_type"].value_counts())


# ============================================================
# 3. DATA PREPARATION
# ============================================================

# Feature engineering inside Pipeline:
# Parse units and unknown values; retain the 16 original inputs

class FeatureBuilder(BaseEstimator, TransformerMixin):
    def fit(self, X, y=None):
        return self

    def transform(self, X):
        data = X.copy()
        data[NUMERIC] = data[NUMERIC].apply(pd.to_numeric, errors="coerce")
        return data[NUMERIC + CATEGORICAL]


class ClipSpecifications(BaseEstimator, TransformerMixin):
    """Clip three numeric specifications using training-fold quantiles only."""
    def __init__(self, lower=0.005, upper=0.995):
        self.lower = lower
        self.upper = upper

    def fit(self, X, y=None):
        X = np.asarray(X, dtype=float)
        self.lower_ = np.full(X.shape[1], -np.inf)
        self.upper_ = np.full(X.shape[1], np.inf)
        for name in ("cc", "weight", "hp"):
            column = NUMERIC.index(name)
            self.lower_[column] = np.quantile(X[:, column], self.lower)
            self.upper_[column] = np.quantile(X[:, column], self.upper)
        return self

    def transform(self, X):
        return np.clip(np.asarray(X, dtype=float), self.lower_, self.upper_)

    def get_feature_names_out(self, input_features=None):
        return np.asarray(input_features if input_features is not None else NUMERIC,
                          dtype=object)


# Target: price
# Exclude ID to focus on vehicle specifications

y = pd.to_numeric(df["price"], errors="coerce")
valid = y.notna() & (y > 0)

X = df.loc[valid].drop(
    columns=["price"] + EXCLUDED_INPUTS
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
        )),
        ("clip", ClipSpecifications())
    ])

    category_pipe = Pipeline([
        ("imputer", SimpleImputer(
            strategy="most_frequent"
        )),
        ("onehot", OneHotEncoder(
            drop="first",
            handle_unknown="infrequent_if_exist",
            min_frequency=3,
            max_categories=10,
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
            n_jobs=1
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
                n_jobs=1
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
            n_jobs=1
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
plt.ylabel("CV RMSE (€)")
plt.xticks(rotation=30)
plt.grid(axis="y", alpha=0.3)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "method_cv_comparison.png", dpi=180)
plt.close()


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
plt.savefig(OUTPUT_DIR / "selected_feature_counts.png", dpi=180)
plt.close()


# ============================================================
# Visualization 3: Actual vs Predicted
# ============================================================

plt.figure(figsize=(7, 6))
plt.scatter(y_test, y_pred, alpha=0.7)

low = min(y_test.min(), y_pred.min())
high = max(y_test.max(), y_pred.max())

plt.plot([low, high], [low, high], "r--")
plt.title(f"Actual vs Predicted - {best_method}")
plt.xlabel("Actual price ($)")
plt.ylabel("Predicted price ($)")
plt.grid(alpha=0.3)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "actual_vs_predicted.png", dpi=180)
plt.close()


# ============================================================
# Visualization 4: Residual Plot
# ============================================================

residuals = y_test.to_numpy() - y_pred

plt.figure(figsize=(7, 5))
plt.scatter(y_pred, residuals, alpha=0.7)
plt.axhline(0, color="red", linestyle="--")

plt.title("Residual Plot")
plt.xlabel("Predicted Price (€)")
plt.ylabel("Residual (€)")
plt.grid(alpha=0.3)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "residuals.png", dpi=180)
plt.close()


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

# Export reproducible experiment metadata and held-out predictions.
# Keep the original model-selection protocol: only the CV winner is tested.
features_by_method = {row["Method"]: row["Selected_Features"] for row in feature_records}
experiment = {
    "source": url,
    "data_sha256": hashlib.sha256(DATA_PATH.read_bytes()).hexdigest() if DATA_PATH.exists() else None,
    "seed": SEED,
    "raw_count": RAW_COUNT,
    "deduplicated_count": DEDUPLICATED_COUNT,
    "category_cap": 10,
    "excluded_inputs": EXCLUDED_INPUTS,
    "clipped_specifications": ["cc", "weight", "hp"],
    "clip_quantiles": [0.005, 0.995],
    "price_policy": "Keep every positive price; no target-based outlier removal",
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
        {"name": str(df.loc[X_test.index[i], "model"]), "actual": float(actual),
         "predicted": float(predicted), "residual": float(actual - predicted)}
        for i, (actual, predicted) in enumerate(zip(y_test, y_pred))
    ],
}
payload = json.dumps(experiment, ensure_ascii=False, indent=2, allow_nan=False)
(OUTPUT_DIR / "experiment.json").write_text(payload + "\n", encoding="utf-8")
web_experiment = dict(experiment, source="ToyotaCorolla.csv", currency="EUR")
(PROJECT_ROOT / "docs" / "cars-data.js").write_text(
    "const CARS_EXPERIMENT = " + json.dumps(web_experiment, ensure_ascii=False, indent=2, allow_nan=False) + ";\n", encoding="utf-8"
)
print("Exported Toyota Corolla experiment and Cars dashboard data.")


# Fixed-count diagnostics for all five schemes (training CV only).
from cars_feature_curves import export_feature_curves

export_feature_curves(make_pipeline, X_train, y_train, CV_OUTER, OUTPUT_DIR,
                      dataset_label="Toyota Corolla")

# Include dataset-specific choices alongside the reusable curve report.
report_path = OUTPUT_DIR / "cars_feature_count_report.html"
context = (
    f"<p>原始 {RAW_COUNT:,} 筆，去重後 {len(X):,} 筆；"
    f"訓練 {len(X_train):,} 筆、測試 {len(X_test):,} 筆。"
    "CSV 原有 37 個輸入欄位，排除 model、固定值 cylinders、"
    "以及與車齡重複的 mfg_month／mfg_year 後，使用 33 個原始輸入欄位。"
    "cc、weight、hp 依每個訓練折的 0.5%–99.5% 分位數截尾；"
    "驗證折與測試集只套用已擬合的門檻。所有價格均保留。"
    "類別欄位以訓練折擬合 One-Hot Encoding，圖表的 1–5 個特徵"
    "指編碼後欄位，而非原始欄位。內層選擇 CV 使用已在外層訓練折"
    "完成前處理的資料；外層驗證與最終測試仍隔離。</p>"
)
report_path.write_text(
    report_path.read_text(encoding="utf-8").replace("<nav>", context + "<nav>", 1),
    encoding="utf-8"
)
