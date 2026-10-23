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
5. 設定訓練測試切分及隨機種子；固定執行 EFS、RFECV、LassoCV、Backward、SFS 五種方法在 k=1–5 的所有組合。分析完成後使用特徵數滑桿切換檢視。
6. 點選 **執行多元線性迴歸**，一次計算最多 **25 個固定 k 模型**（五方法 × 1–5 特徵）及 1 個 Baseline，並繪製 RMSE 與 R² 兩張曲線；可切換方法並勾選五方法疊圖，下載完整結果 CSV。

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


### 自訂資料分析圖表（對齊 50 Startups 與 Cars）

執行 Custom Dataset 的回歸分析後，結果版面與原有 50 Startups 相同：

- **五種方法分頁**：EFS、RFECV（固定 k RFE 路徑）、LassoCV（L1 簡化）、Backward、SFS。
- **特徵數滑桿**：依編碼後可用欄位數，自動比較 k=1–5。
- **同時比較五種方法**：可勾選疊加五條曲線，當前方法以較粗實線顯示。
- **只保留兩種特徵數曲線**：RMSE 與 R-squared，皆為共同保留測試集上的指標，與既有範例一致。點選曲線圓點可以切換方法與 k。
- **「Backward · 特徵組合與表現」表格**：標題依目前方法變動，列出該方法各個 k 的 Selected Features、Test RMSE 與 Test R²。點選表格列同步更新曲線。
- **「從資料到預測，一步一步重現」**：動態顯示本次上傳資料的 CRISP-DM 六大階段，包括 Target、欄位、資料筆數、編碼後特徵數、訓練測試切分、五種選擇方法，以及目前選取組合的評估分數。
- **完整 CSV 匯出**：五方法所有 k=1–5 的結果，加上 Baseline；僅切換畫面時不會重新訓練模型。

特徵選取只使用訓練資料；圖中 RMSE 與 R² 為 Test 指標。預設顯示 Backward 與 k=2；切換選取不會依測試集成績重新選擇最好的模型。自訂頁仍是受計算上限保護的 JavaScript 實作，與 sklearn 的同名方法不完全等價。

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
├── custom-curves.js         # RMSE 與 R² 特徵數 SVG 曲線（支援五方法疊圖）
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

若本機已安裝 Node.js，可從專案根目錄執行 `node tests/custom-model.test.cjs`，用合成回歸資料與 50 Startups 樣本測試 Baseline、五方法 × k=1–5 的特徵組合、兩張曲線及五方法疊圖的邊界狀況。
