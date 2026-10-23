# Feature Lab · 特徵選擇實驗室

多元線性迴歸（Multiple Linear Regression）與五種特徵選擇方法的互動式網站。採 GitHub Pages 靜態部署，資料集與結果均可在瀏覽器檢視。

## 入口與資料集

| 頁面 | URL | 說明 |
| --- | --- | --- |
| Cars · 汽車售價（首頁） | [Cars](https://cg3599.github.io/20261014-hw2-Multiple-Linear-regression/) | Toyota Corolla，保留原本 Python sklearn 離線計算成果 |
| 50 Startups · 創業獲利 | [50 Startups](https://cg3599.github.io/20261014-hw2-Multiple-Linear-regression/startups.html) | 50 Startups，保留原有五方法的互動圖表 |
| Custom Dataset · 自訂資料集 | [Custom Dataset](https://cg3599.github.io/20261014-hw2-Multiple-Linear-regression/custom.html) | 自行匯入、選擇 Target 與 Features、進行瀏覽器端迴歸分析 |

三頁共用左側「切換實驗 / DATASET」選單、首頁連結與明暗模式。舊 `cars.html` 導向 Cars 首頁。

## 自訂 Dataset 操作

1. 切換至 **Custom Dataset**。
2. 選擇輸入來源：
   - **CSV / TSV / Excel (.xlsx / .xls)** 本機檔案上傳或拖曳。
   - **公開 CSV / TSV 直接網址**，須允許 CORS；Kaggle 介紹頁不是原始 CSV 網址。
   - **貼上 CSV / TSV**：支援 Excel 複製貼上及有引號的 CSV。
   - **範例**：可直接開啟 Cars 或 50 Startups 既有展示頁，也可在自訂頁一鍵載入原始 `50_Startups.csv`。
3. 檢視前五列預覽、原始欄數、所選輸入特徵數、One-Hot 後特徵數的估算。
4. 選擇數值型 **Target**，排除 ID 欄及不適合的 Features，可手動切換欄位數值／類別型態。
5. 設定訓練測試切分及隨機種子；固定執行 EFS、RFECV、LassoCV、Backward、SFS 五種方法在 k=1–5 的所有組合。k 下拉選單用於切換檢視。
6. 點選 **執行多元線性迴歸**，一次計算最多 **25 個固定 k 模型**（五方法 × 1–5 特徵）及 1 個 Baseline，並繪製五張曲線；可切換 Train CV RMSE、Test RMSE、Test R²，下載完整結果 CSV。

這一頁使用原生 JavaScript 在**本機瀏覽器**進行回歸與特徵選擇，資料不會傳送至本專案伺服器。Excel 解析會另外載入官方 SheetJS 0.20.3 函式庫，若無網路或第三方函式庫被阻擋，請另存成 CSV 上傳。匯入公開網址時，瀏覽器會向使用者所填的網址發出請求。

### 五種方法（自訂頁的有限計算版本）

| 方法 | 執行方式 |
| --- | --- |
| EFS | 最多預選 8 個候選特徵，窮舉指定 k 個特徵的組合，以訓練資料三折 CV RMSE 評估 |
| RFECV / RFE | 先預選最多 15 個候選，依 OLS 係數遞迴消除；固定 k 曲線使用 RFE 路徑，不是 RFECV 自動決定特徵數 |
| LassoCV (L1) | 以 JavaScript 的 L1 係數比較不同懲罰強度，依係數大小選出 k 個特徵，再以 OLS 重訓；非 sklearn 原生 LassoCV |
| Backward | 最多預選 18 個候選，反覆刪除 OLS 係數絕對值最小的特徵，直到 k 個 |
| SFS | 最多預選 12 個候選，依訓練 CV 逐輪加入對表現最有幫助的特徵，直到 k 個 |

**重要**：自訂頁是運算量受限的 JavaScript 版本，並非原版 `sklearn` 的完全等價實作。Backwards 使用係數排名，而不是原有 Python 版本的 p-value 刪除策略。RFECV 固定 k 曲線使用 RFE 消除路徑，不等於 RFECV 自動選擇 k。自訂頁以訓練資料擬合補值及編碼，接著在編碼好的訓練集上執行三折 CV；內層預處理未完全隔離，CV 分數可能偏樂觀。獨立測試集不參與特徵選擇。**正式報告應以 sklearn Pipeline 的訓練折內前處理和完整巢狀交叉驗證為準。**

### 限制與注意事項

- 匯入檔案大小上限 **5 MB**；預覽至多讀取 **6,000 列**。
- 分析最多 **3,000 筆有效資料**、**60 個原始欄位**、**39 個選取的原始 Features**、**40 個編碼後 Features**。
- 類別特徵超過 **12 種不同類別**，請排除或自行整理；One-Hot 使用移除第一個類別的表示方式。
- Target 須為可轉為數值的欄位；缺漏的 Target 列會移除。前處理統計由訓練集決定。
- 右側會提示原始特徵是否落在 HW2 的 **14–39 個輸入特徵**要求內；這是作業檢查提示。
- 若運算較慢，請縮小資料筆數或排除不必要的候選欄位；本頁固定執行五方法的整組曲線，瀏覽器計算不適合大型 EFS。


### 自訂資料分析圖表

執行 Custom Dataset 後，網站會顯示 **五張特徵選取曲線**（EFS、RFECV、LassoCV、Backward、SFS），各自可查看 k=1–5 的 RMSE 與 R²。另外保留：

- **RMSE 比較圖**：各方法的 Train CV RMSE 與 Test RMSE（兩種顏色的長條圖）。
- **Test R² 比較圖**：各方法在保留測試集上的 R²，包含可能出現的負值。
- **Actual vs Predicted 散佈圖**：測試集實際目標值與模型預測值，虛線代表完美預測。
- **Residual Plot（殘差圖）**：Residual = Actual − Predicted，以 0 水平線判讀模型誤差。

圖表使用不依賴外部函式庫的 SVG。可以在診斷圖切換 Baseline、EFS、RFECV、LassoCV、Backward 或 SFS，也能點選曲線資料點或全部 25 組結果表格列，同步切換方法與 k。預設使用 **訓練 CV RMSE 最低**的模型作為診斷圖，不依測試集成績選模型。測試集如果超過 220 個點，散佈圖會等間距抽樣顯示，但各種指標仍使用完整測試集計算。結果 CSV 包含五方法全部固定 k 組合的分數與選取特徵，以及 Baseline。

## 原有 Python 範例實驗

### Cars — Toyota Corolla

`main5.py` 用 ToyotaCorolla.csv 預測 Price（歐元）。原始 1,436 筆、去重後 1,435 筆；使用 **33 個原始輸入特徵**，編碼後完整模型為 42 欄。切分訓練 1,148 筆／測試 287 筆，固定特徵數曲線比較 1–5 個編碼特徵的訓練三折 CV。首頁保留 Baseline、EFS、RFECV、Lasso、Backward、SFS 的原始結果。原先 `data/cars.csv` 與 `main2.py` 是舊版 Draco Cars 練習，不是目前首頁 Toyota Corolla 的模型資料來源。

### 50 Startups

`main.py` 使用 `50_Startups.csv` 預測 Profit。原始四個 Features：R&D Spend、Administration、Marketing Spend、State；One-Hot 後五個輸入特徵。採 80/20 切分，原網頁的固定 1–5 個特徵曲線展示既有 Python 計算的保留測試集結果。兩個既有範例均展示 CRISP-DM 六大階段及五種特徵選擇方法。

## 本機啟動

```sh
python -m http.server 8000 --directory docs
```

開啟 `http://localhost:8000/`，即可使用三個頁面。Python 範例的額外依賴列於 `requirements.txt`；Custom Dataset 不需要在 GitHub Pages 部署 Python 後端。

## 專案主要檔案

```text
docs/
├── index.html               # Cars 首頁
├── startups.html            # 50 Startups
├── custom.html              # 自訂 Dataset UI
├── custom.css               # 自訂介面排版
├── custom.js                # 匯入 / 預覽 / 設定 / 匯出
├── custom-curves.js         # 五張固定 k 特徵數 SVG 曲線
├── custom-charts.js         # RMSE / R² / 模型診斷圖
├── custom-model.js          # 瀏覽器端 OLS 和五方法特徵選擇
├── sample-startups.csv      # 可一鍵載入的原始範例
├── pages.js / pages.css     # 共用導覽
├── cars-data.js             # Cars Python 結果
├── cars-curves-data.js      # Cars 固定特徵數結果
├── data.js                  # 50 Startups Python 結果
├── style.css / theme.css    # Feature Lab 網站風格
main.py                      # 50 Startups Python
main5.py                     # Toyota Corolla Python
50_Startups.csv              # 原始資料
```

GitHub Pages 使用 `main` 分支的 `/docs` 目錄；提交後需等 GitHub Pages 完成部署才能看到更新。

## 自動化檢查

若本機已安裝 Node.js，可從專案根目錄執行 `node tests/custom-model.test.cjs`，用合成回歸資料與 50 Startups 樣本測試 Baseline、25 組固定 k 輸出、五張曲線與四種評估 SVG 圖表。
