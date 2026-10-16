# Feature Lab · 特徵選擇實驗室

## 多資料集頁面

透過每頁左側的「切換實驗 / DATASET」下拉選單（手機版位於頂部），可自由切換：

- [50 Startups · 創業獲利](https://cg3599.github.io/20261014-hw2-Multiple-Linear-regression/)
- [Cars · 汽車售價](https://cg3599.github.io/20261014-hw2-Multiple-Linear-regression/cars.html)

兩頁共用版型、配色與持久化明暗模式。Cars 頁面呈現 `main2.py` 實際輸出：Baseline 與五種選擇方法的 CV RMSE / 標準差、特徵數與明細、CV 最佳模型的頂部測試摘要。頁面已移除六方法長條圖區與最佳模型預測診斷區；點選方法比較表格可切換特徵明細，並可下載方法比較 CSV。

Cars 資料快照儲存在 `data/cars.csv`，來源為 [uwdata/draco](https://github.com/uwdata/draco/blob/master/data/cars.csv)。共 387 筆，309 筆訓練、78 筆測試；本次由訓練 CV 選出 SFS。測試 R² 為 -9.8159，網頁忠實保留負值與離群預測，未依測試表現重新挑選模型。

重新產生 Cars 結果（需先安裝下方 requirements）：

```powershell
$env:MPLBACKEND = 'Agg'
.\.venv\Scripts\python.exe main2.py
```

結果寫入 `results/cars/`，網站資料自動寫入 `docs/cars-data.js`；提交並推送後由 GitHub Pages 發布。`main2.py` 的模型設定保持原樣，只新增本機資料快照讀取及靜態頁面資料匯出。Python 模型不在 GitHub Pages 伺服器執行。

`main2.py` 另外產生 EFS、RFECV、Lasso、Backward、SFS 五種方法各自的 1–5 個特徵比較（共 25 筆）：中文報告 `results/cars/cars_feature_count_report.html`、合併 CSV `cars_feature_count_comparison.csv`、五方法總覽圖 `cars_feature_count_metrics.png`，以及每種方法的 `cars_{方法}_feature_count.csv`、`cars_{方法}_feature_count_table.png`、`cars_{方法}_feature_count_metrics.png`。固定數量 RFECV 使用 RFE 路徑，Lasso 使用係數排名（同分以 OLS 係數排序），Backward 刪除到指定數量；EFS 在 8 個候選內窮舉，SFS 在 15 個候選內選取。RMSE 與 R² 是訓練資料外層三折交叉驗證的平均值，每折重新選取特徵；表內特徵名稱則來自完整訓練集。此額外比較不使用測試集，也不改變原本最佳模型的選擇。

Cars 頁面新增固定特徵數互動區：方法切換、1–5 特徵滑桿、五方法疊圖、RMSE／R² 曲線與特徵明細，以及 25 組 CSV 下載。`cars_feature_curves.py` 同步匯出 `docs/cars-curves-data.js` 與下載 CSV，沿用既有版型及明暗模式。

未來新增實驗頁面時，在新頁載入 `pages.js`、`pages.css` 並保留 `aside nav`；將頁面路徑與名稱加入 `docs/pages.js` 的 `experimentPages`，所有頁面的選單就會同步更新。

---

使用 **50 Startups** 資料集進行多元線性迴歸，將五種特徵選擇方法的結果轉換成互動式網頁。透過曲線、表格與特徵組合，觀察「增加特徵是否真的讓模型更好？」

## 🌐 Live View

**[立即開啟互動式網站 →](https://cg3599.github.io/20261014-hw/?v=2)**

網站已部署於 GitHub Pages，支援桌面與手機瀏覽，無需安裝 Python 即可探索結果。

[查看 EFS 的 2 個特徵結果](https://cg3599.github.io/20261014-hw/?v=2&method=EFS&k=2&compare=0) · [比較全部五種方法](https://cg3599.github.io/20261014-hw/?v=2&method=Backward&k=2&compare=1)

## 📸 網站截圖

以下為網站黑暗模式下，EFS 選取 2 個特徵的畫面。可看到測試 RMSE、R²、特徵數滑桿與兩張比較曲線。

[![Feature Lab 黑暗模式：EFS 特徵選擇與 RMSE、R² 曲線](assets/site-dark.png)](https://cg3599.github.io/20261014-hw/?v=2&method=EFS&k=2&compare=0)

## 網站介紹與功能

| 功能 | 說明 |
| --- | --- |
| 五種方法切換 | EFS、RFECV、LassoCV、Backward、SFS 各自提供 1–5 個特徵的結果，共 25 筆組合。 |
| 互動式曲線 | 查看特徵數與 RMSE、R² 的關係；點選圓點可連動顯示該組合。 |
| 特徵組合表格 | 列出 Selected Features、RMSE 與 R-squared，點選資料列可更新圖表選取狀態。 |
| 多方法比較 | 勾選「同時比較五種方法」，將五條曲線疊加顯示。 |
| 明亮／黑暗模式 | 右上角切換主題；首次開啟跟隨系統設定，手動選擇後會保留偏好。 |
| CSV 下載 | 一鍵下載全部 25 筆固定特徵數的結果。 |
| 分享指定視圖 | URL 保留方法、特徵數與比較模式，可直接分享目前視圖。 |
| 自動選擇結果 | 展開頁面下方區塊，查看原始自動選擇方法的 nested CV 比較。 |

## 使用方式

1. 開啟 [Live View](https://cg3599.github.io/20261014-hw/?v=2)，選擇一種特徵選擇方法。
2. 拖動滑桿，或點選曲線圓點／表格資料列，查看 1–5 個特徵的結果。
3. 勾選「同時比較五種方法」，比較各方法的曲線。
4. 使用右上角按鈕切換明亮／黑暗模式，或點選「下載 CSV」取得結果。

**RMSE 越低越好；R² 越高越好。** R² 可以小於 0，表示該模型在測試資料上的表現，比直接使用測試目標平均值預測更差。

## 資料與實驗方法

- 資料集：`50_Startups.csv`，共 50 筆、5 個原始欄位，預測目標為 `Profit`。
- 原始輸入：`R&D Spend`、`Administration`、`Marketing Spend`、`State`。
- 編碼後輸入：三個數值特徵，加上 `State_New York` 與 `State_California`，共五個特徵；Florida 為州別基準類別。
- 資料切分：40 筆訓練、10 筆測試（80/20），`random_state=42`。
- 特徵選擇只使用訓練資料；所有固定特徵數組合使用同一份測試資料評估。
- 自動方法比較使用訓練資料的 nested cross-validation，依 CV RMSE 選擇方法。

| 方法 | 固定 1–5 個特徵時的做法 |
| --- | --- |
| EFS | 窮舉指定數量的特徵組合，以訓練 CV RMSE 選擇組合。 |
| RFECV | 展示 RFECV 所依據的固定數量 RFE 移除路徑，保留原程式未標準化的係數設定。 |
| LassoCV | 依標準化 LassoCV 係數絕對值排序，同分／零值以標準化 OLS 係數排序，再以選取的特徵重訓線性迴歸。 |
| Backward | 逐步移除 OLS p-value 最大的特徵，直到剩下指定數量。 |
| SFS | 向前逐步選擇特徵，每一步依訓練 CV RMSE 決定。 |

固定特徵數曲線是診斷比較，與原始方法自動決定特徵數的結果不同；Backward 在固定數量比較中不使用 0.05 停止條件。RFECV 的未標準化係數會受到特徵單位影響。網頁展示既有計算結果，不會重新訓練模型。

## 技術與專案結構

前端使用 HTML、CSS、原生 JavaScript 與 SVG，無需建置工具或外部 JavaScript 套件。Python 計算使用 pandas、NumPy、scikit-learn、statsmodels 與 Matplotlib。

```text
20261014-hw/
├── docs/
│   ├── index.html          # 網站主頁
│   ├── style.css           # 版面與響應式樣式
│   ├── theme.css           # 明亮／黑暗模式
│   ├── app.js              # 圖表、表格與主題互動
│   └── data.js             # 展示用結果資料
├── assets/site-dark.png    # README 網站截圖
├── results/                # 原始計算結果 CSV
├── main.py                 # 迴歸與特徵選擇程式
├── 50_Startups.csv          # 資料集
└── requirements.txt        # Python 套件版本
```

## 本機預覽

```sh
python -m http.server 8000 --directory docs
```

開啟 `http://localhost:8000`。網站為靜態頁面，Python 僅用來提供本機 HTTP 伺服器。

## 重現 Python 計算

Windows PowerShell：

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe main.py
```

macOS / Linux：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
.venv/bin/python main.py
```

重新計算後，若要更新網頁數值，需要同步更新 `docs/data.js`；網頁不會自動讀取 Python 輸出的 CSV。

## 部署

GitHub Pages 使用 `main` 分支的 `/docs` 資料夾。更新網站檔案並推送至 `main` 後，GitHub 會自動重新發布。
