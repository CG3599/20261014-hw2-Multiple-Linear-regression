"""Fixed-count diagnostics for the five Cars feature-selection schemes."""
import itertools
import json
import textwrap

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import statsmodels.api as sm
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.feature_selection import RFE, f_regression
from sklearn.linear_model import LinearRegression, LassoCV
from sklearn.model_selection import KFold, cross_val_score, cross_validate


def export_web_curves(combined, notes, output_dir):
    """Publish the same calculated rows for the existing Cars dashboard."""
    docs = output_dir.parent.parent / "docs"
    docs.mkdir(exist_ok=True)
    payload = {"notes": notes, "rows": combined.to_dict(orient="records")}
    (docs / "cars-curves-data.js").write_text(
        "const CARS_CURVES = " + json.dumps(payload, ensure_ascii=False, allow_nan=False) + ";\n",
        encoding="utf-8")
    combined.to_csv(docs / "cars_feature_count_comparison.csv", index=False, encoding="utf-8-sig")


class FixedCountSelector(TransformerMixin, BaseEstimator):
    def __init__(self, method, count, seed=42):
        self.method = method
        self.count = count
        self.seed = seed

    def fit(self, X, y):
        X = np.asarray(X)
        cv = KFold(3, shuffle=True, random_state=self.seed)
        if self.method == "EFS":
            # Same eight-candidate screening pool as the original Cars EFS.
            scores, _ = f_regression(X, y)
            candidates = np.argsort(np.nan_to_num(scores, nan=-np.inf))[::-1][:8]
            best_score = -np.inf
            for subset in itertools.combinations(candidates, self.count):
                score = cross_val_score(
                    LinearRegression(), X[:, list(subset)], y, cv=cv,
                    scoring="neg_root_mean_squared_error", n_jobs=1,
                    error_score="raise"
                ).mean()
                if score > best_score:
                    chosen, best_score = list(subset), score
        elif self.method == "RFECV":
            selector = RFE(LinearRegression(), n_features_to_select=self.count, step=1)
            selector.fit(X, y)
            chosen = np.flatnonzero(selector.support_)
        elif self.method == "Lasso":
            model = LassoCV(alphas=100, cv=cv, max_iter=50000,
                            random_state=self.seed, n_jobs=-1).fit(X, y)
            # OLS weight breaks tied (including zero) Lasso weights deterministically.
            ols_weights = np.abs(LinearRegression().fit(X, y).coef_)
            chosen = np.lexsort((np.arange(X.shape[1]), -ols_weights,
                                 -np.abs(model.coef_)))[:self.count]
        elif self.method == "Backward":
            chosen = list(range(X.shape[1]))
            while len(chosen) > self.count:
                result = sm.OLS(np.asarray(y), sm.add_constant(
                    X[:, chosen], has_constant="add")).fit()
                pvalues = np.nan_to_num(result.pvalues[1:], nan=1.0)
                chosen.pop(int(np.argmax(pvalues)))
        else:
            raise ValueError(self.method)
        self.support_ = np.zeros(X.shape[1], dtype=bool)
        self.support_[chosen] = True
        assert self.support_.sum() == self.count
        return self

    def transform(self, X):
        return np.asarray(X)[:, self.support_]

    def get_support(self):
        return self.support_


def export_feature_curves(make_pipeline, X_train, y_train, cv, output_dir, dataset_label="Cars"):
    notes = {
        "EFS": "先以訓練資料 F 分數篩出 8 個候選特徵，再以內層交叉驗證窮舉各固定數量的組合。",
        "RFECV": "固定數量曲線採用 RFE 逐一遞迴刪除；原本 RFECV 自動選取數量的實驗保留不變。",
        "Lasso": "依 LassoCV 的標準化係數絕對值取前 k 個；相同或零係數以標準化 OLS 係數排序，再以線性迴歸擬合。",
        "Backward": "每次刪除 OLS p 值最大的特徵，直到剩下 k 個；固定數量比較不使用 0.05 提前停止規則。",
        "SFS": "沿用原有 SFS：先篩出 15 個候選特徵，再以內層交叉驗證向前選取 k 個。",
    }
    all_frames, sections = [], []
    for method, note in notes.items():
        rows = []
        for count in range(1, 6):
            model = make_pipeline(method)
            if method == "SFS":
                model.set_params(selection__select_k=count)
            else:
                model.set_params(selection=FixedCountSelector(method, count))
            scores = cross_validate(
                model, X_train, y_train, cv=cv,
                scoring={"rmse": "neg_root_mean_squared_error", "r2": "r2"},
                n_jobs=1, error_score="raise"
            )
            model.fit(X_train, y_train)
            names = model.named_steps["preprocess"].get_feature_names_out()
            chosen = names[model.named_steps["selection"].get_support()]
            assert len(chosen) == count
            rows.append({
                "Number of Features": count,
                "Selected Features": "[" + ", ".join(n.split("__", 1)[-1] for n in chosen) + "]",
                "RMSE": -scores["test_rmse"].mean(),
                "R-squared": scores["test_r2"].mean(),
            })
            print(f"{method}: {count}/5 complete", flush=True)
        frame = pd.DataFrame(rows)
        all_frames.append(frame.assign(Method=method))
        prefix = f"cars_{method}_feature_count"
        frame.to_csv(output_dir / f"{prefix}.csv", index=False, encoding="utf-8-sig")
        print(frame.to_string(index=False, float_format="%.6f"))
        fig, axes = plt.subplots(1, 2, figsize=(12, 5))
        for ax, metric in zip(axes, ["RMSE", "R-squared"]):
            ax.plot(frame["Number of Features"], frame[metric], marker="o")
            ax.set(title=f"{metric} by Number of Features",
                   xlabel="Number of Features", ylabel=metric, xticks=range(1, 6))
        fig.suptitle(f"{dataset_label} | {method} | Mean training cross-validation scores")
        fig.tight_layout()
        fig.savefig(output_dir / f"{prefix}_metrics.png", dpi=180)
        plt.close(fig)
        fig, ax = plt.subplots(figsize=(16, 5.2))
        ax.axis("off")
        table_rows = [[str(r["Number of Features"]),
                       textwrap.fill(r["Selected Features"], width=68),
                       f'{r["RMSE"]:.6f}', f'{r["R-squared"]:.6f}'] for r in rows]
        table = ax.table(cellText=table_rows, colLabels=frame.columns,
                         colWidths=[.14, .60, .13, .13], cellLoc="left", bbox=[0, 0, 1, 1])
        table.auto_set_font_size(False)
        table.set_fontsize(10)
        for (row, col), cell in table.get_celld().items():
            cell.set_linewidth(0)
            cell.set_facecolor("#f4f4f4" if row % 2 else "white")
            if row == 0:
                cell.set_text_props(weight="bold")
        ax.set_title(method, fontweight="bold", pad=18)
        fig.savefig(output_dir / f"{prefix}_table.png", dpi=180, bbox_inches="tight")
        plt.close(fig)
        sections.append(f'<section id="{method}"><h2>{method}</h2><p>{note}</p>'
                        + frame.to_html(index=False, border=0, float_format=lambda x: f"{x:.6f}")
                        + f'<img src="{prefix}_metrics.png" alt="{method} 指標折線圖"></section>')
    combined = pd.concat(all_frames, ignore_index=True)
    assert len(combined) == 25
    assert np.isfinite(combined[["RMSE", "R-squared"]].to_numpy()).all()
    combined.to_csv(output_dir / "cars_feature_count_comparison.csv", index=False, encoding="utf-8-sig")
    export_web_curves(combined, notes, output_dir)
    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    for frame in all_frames:
        for ax, metric in zip(axes, ["RMSE", "R-squared"]):
            ax.plot(frame["Number of Features"], frame[metric], marker="o", label=frame["Method"].iloc[0])
    for ax, metric in zip(axes, ["RMSE", "R-squared"]):
        ax.set(title=f"{metric} by Number of Features", xlabel="Number of Features",
               ylabel=metric, xticks=range(1, 6))
        ax.legend()
    fig.suptitle(f"{dataset_label} | All five schemes | Mean training cross-validation scores")
    fig.tight_layout()
    fig.savefig(output_dir / "cars_feature_count_metrics.png", dpi=180)
    plt.close(fig)
    (output_dir / "cars_feature_count_report.html").write_text('''<!doctype html>
<html lang="zh-Hant"><meta charset="utf-8"><title>五種特徵選擇方法比較</title>
<style>body{font-family:Arial,"Microsoft JhengHei",sans-serif;max-width:1200px;margin:40px auto;padding:0 24px;color:#222}
table{border-collapse:collapse;width:100%}th,td{padding:14px;text-align:left}th{border-bottom:1px solid}
tbody tr:nth-child(odd){background:#f5f5f5}img{width:100%;height:auto}p{line-height:1.7}section{margin:48px 0}</style>
<h1>汽車售價：五種方法 × 1–5 個特徵</h1>
<p>RMSE 與 R² 為相同訓練資料外層三折交叉驗證的平均分數，每折重新執行前處理和特徵選擇。
表格列出完整訓練集選出的特徵，各折特徵可能不同。此比較不使用測試集、不改變原本模型選擇。
固定數量版本的差異註明於各方法下方。RMSE 越低越好，R² 越高越好，負值會如實保留。</p>
<nav>''' + " | ".join(f'<a href="#{m}">{m}</a>' for m in notes)
        + f'</nav><p>資料集：{dataset_label}</p><img src="cars_feature_count_metrics.png" alt="五種方法總覽">'
        + "".join(sections) + '</html>', encoding="utf-8")
    print("Exported all five schemes: 25 rows, 5 tables, 5 chart pairs and combined report.")
