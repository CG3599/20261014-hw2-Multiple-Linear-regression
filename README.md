# Feature Lab · 特徵選擇實驗室

多元線性迴歸（Multiple Linear Regression）與五種特徵選擇方法的互動式網站。採 GitHub Pages 靜態部署，資料集與結果均可在瀏覽器檢視。

## Dataset 來源連結與 RAW CSV 匯入

**Cars** 與 **50 Startups** 頁面右上角設有三個資料來源按鈕：Kaggle、Dataset · GitHub（供人閱讀的檔案頁）、Dataset · RAW（直接取得 CSV）。原本的「專案 GitHub」按鈕仍保留，與資料來源分開標示。

- Cars Kaggle：<https://www.kaggle.com/datasets/vishakhdapat/price-of-used-toyota-corolla-cars>
- Cars Dataset：<https://github.com/reisanar/datasets/blob/master/ToyotaCorolla.csv>
- Cars RAW：<https://raw.githubusercontent.com/reisanar/datasets/refs/heads/master/ToyotaCorolla.csv>
- 50 Startups Kaggle：<https://www.kaggle.com/datasets/abhishek14398/50startups>
- 50 Startups Dataset：<https://github.com/Avik-Jain/100-Days-Of-ML-Code/blob/master/datasets/50_Startups.csv>
- 50 Startups RAW：<https://raw.githubusercontent.com/Avik-Jain/100-Days-Of-ML-Code/refs/heads/master/datasets/50_Startups.csv>

Custom Dataset 的「URL 匯入」請填 **RAW CSV/TSV 檔案直接網址**，例如 `raw.githubusercontent.com`，而不是 GitHub 的 `/blob/` 瀏覽頁或 Kaggle 資料集頁；且網址需允許 CORS。此提醒顯示在輸入欄位旁。

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
3. 檢視前五列預覽、原始欄數、所選輸入特徵數與 One-Hot 後特徵數的估算。
4. 選擇數值型 **Target**。在「建議分析設定」查看目前 / 建議的原始特徵數及 One-Hot 編碼後欄數、建議排除欄位與原因；可按「套用建議排除欄位」一鍵處理，亦可保留手動編輯權。ID、常數欄、類別數超過 12、缺失率高以及讓編碼數超過 40 的欄位都會提供說明。
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
- 分析最多 **3,000 筆有效資料**、**120 個原始欄位**、**60 個選取的原始 Features**、**80 個編碼後 Features**，且**編碼後數量不可超過訓練筆數減 10**。
- 類別特徵超過 **12 種不同類別**，請排除或自行整理；One-Hot 使用移除第一個類別的表示方式。
- Target 須為可轉為數值的欄位；缺漏的 Target 列會移除。前處理統計由訓練集決定。
- 網站仍提示原始特徵是否落在 HW2 的 **14–39 個輸入特徵**要求內；這只是作業檢查提示，不再是程式的 39 個特徵硬限制。若實際編碼特徵數超過訓練筆數三分之一，網站會提醒過擬合風險。
- 若運算較慢，請縮小資料筆數或排除不必要的候選欄位；本頁固定執行五方法的整組曲線，瀏覽器計算不適合大型 EFS。


### 自動分析設定建議

「建議分析設定」位於 **Target / 訓練切分**設定下方、完整欄位勾選清單上方，匯入成功後即顯示。其建議是為了讓模型能在本網站運算上限內執行，並非為某資料集尋找最佳測試分數：

- 原始欄名看似 **ID / 流水號**（例如 `car_ID`）時建議排除。
- **類別值超過 12 種**（例如 `CarName`）的欄位會註明原因，避免高維 One-Hot。
- **只有 0–1 種有效值或缺失值超過一半**的欄位會提醒使用者。
- 如果選取欄位超過 60 個原始 Features、One-Hot 後預計超過 80 個 Features，或編碼數超過預估訓練筆數減 10，會優先建議排除最增加編碼欄數的欄位。新版 Car Price 的 `fuelsystem` 可以保留，除非其他選取欄位使運算預算超標。
- 顯示目前的選取數與按建議套用後的數量；**按鈕只會取消建議排除的勾選**，不會自動改動 Target 或重新選回使用者已取消的特徵。切換 Target、手動更改欄位勾選或型態時，建議會重新計算。

**注意：** 建議是依名稱與基本欄位統計推估，**不保證 RMSE 最低或 R² 最高**。編碼後數量的預估使用完整匯入資料，真正的編碼欄數以模型訓練資料為準。120 欄僅為**匯入上限**，不是可同時投入模型的特徵數上限。編碼特徵數大於訓練資料三分之一時，網站會顯示過擬合風險提示，但仍允許在硬性運算上限內分析。URL 匯入若因格式或欄數不符而失敗，現在會與網路 / CORS 失敗分開顯示。

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

### 預測結果與不確定性（Prediction Results & Uncertainty）

三頁都在「方法比較與選取特徵」後、CRISP-DM 六階段說明前，新增同樣設計的「**實際值 vs 預測值**」散點圖；橫軸是預測值，縱軸是實際值。每筆樣本的垂直誤差棒顯示 **95% 預測區間（Prediction Interval）**，而不是僅對平均值的信賴區間；額外提供名目涵蓋率、實際測試涵蓋率、區間估計方法與限制。

- **Cars**：重用原先的最佳 Baseline 模型對 287 筆測試資料的已儲存預測。將其預測拆成 143 筆區間校準資料、144 筆展示資料，使用 **split-conformal 95% 預測區間**（校準絕對殘差的 \`ceil((n+1) × 0.95)\` 階順序統計量）。區間寬度未使用展示資料調整。原本 Test RMSE、Test R² 仍基於原先全部 287 筆，不可與新圖的 144 筆區間驗證結果混為一談。Conformal 的覆蓋保證需假設資料可交換，是**邊際**保證而非每個車價區間的條件保證。
- **50 Startups**：使用 sklearn \`train_test_split(test_size=0.2, random_state=42)\` 的原始分割，40 筆訓練、10 筆測試；重現最佳 **Backward k=1（R&D Spend）** 的 OLS 模型，Test RMSE 與原本結果吻合。使用 \`Student-t(df=38)\`、訓練殘差變異及槓桿值計算**參數式 95% 個別預測區間**。此方法依賴線性關係、獨立、等變異與常態誤差假設。使用預先計算的 \`docs/startups-prediction-data.js\`。
- **Custom Dataset**：每次使用者分析資料時，依目前方法與 k 值計算並繪製**近似 95% OLS 預測區間**：從訓練資料的殘差變異、設計矩陣的逆矩陣（槓桿值）和 Student-t 臨界值近似推得。**測試資料僅用於展示及實測涵蓋率，不會用來計算區間寬度**。網站的線性回歸使用微小正則化以提高數值穩定性，故區間為參數式近似而非分布無關保證；當矩陣無法可靠求逆、樣本太少時，顯示無法估計區間，不虛構數值。

三頁共用 \`docs/prediction-uncertainty.js\` 和 \`docs/pages.css\` 的圖表與配色。圖上綠點代表實際值落在 95% 區間內、橘點代表落在區間外；虛線是理想預測值等於實際值。若樣本較多會減少可視的垂直誤差棒數量以保持圖表清晰，但涵蓋率統計仍計算**完整展示樣本**。

### 三頁統一的六方法比較表

三個頁面都在「特徵數曲線／特徵組合」之後、**CRISP-DM 六階段說明之前**放置「方法比較與選取特徵」表格。表格標題、順序與六欄完全一致：

`Method | 特徵數 | Selected Features | CV RMSE ↓ | Test RMSE ↓ | Test R² ↑`

- **Cars**：六種方法皆使用現有 Python 匯出選定的特徵與 CV RMSE；原始檔只有以訓練 CV 選出的 **Baseline** 儲存 Test RMSE／Test R²，其他五種方法顯示 `—`，絕不以 CV 代填測試分數。CV 標準差仍在選取方法的明細中。
- **50 Startups**：把原先 CRISP-DM 折疊內的「原始自動選擇方法的比較」移到同一位置；六方法有 CV 與 Test 指標，選取特徵則依同方法、同特徵數、同 Test RMSE 的既有曲線資料對應。
- **Custom Dataset**：Baseline 使用所有編碼特徵，其餘五方法各從 **k=1–5** 中選訓練 CV RMSE 最小的模型做摘要，**不是**原生 sklearn 自動特徵選擇；不以 Test RMSE／R² 選模型。上方的固定 k 曲線與每方法特徵組合表格仍保留。
- 選取特徵過多時先顯示前四個，按「展開其餘 N 個特徵」查看完整清單。三頁共用 `docs/method-comparison.js` 與 `docs/pages.css` 的同一套表格渲染與版面。

注意：**三份 Dataset 的目標變數、資料切分與 CV 設定不盡相同**，不同資料集的 RMSE 數值不可直接橫向排名。尚未提供的 Test 分數會標示為 `—`，避免誤導。

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
├── method-comparison.js     # 三頁共用六種方法的表格比較
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

建議也執行 `node tests/prediction-uncertainty.test.cjs` 驗證三頁預測區間的來源、覆蓋率和頁面區塊位置，再執行 `node tests/method-comparison.test.cjs`，檢查三頁表格欄位、方法分數、特徵名稱、資料來源與區塊順序。

若本機已安裝 Node.js，可從專案根目錄執行 `node tests/custom-model.test.cjs`，驗證 Baseline、五方法 × k=1–5、RMSE／R² 曲線及五方法疊圖；再執行 `node tests/custom-advisor.test.cjs`，檢查 120 欄上限、ID／高類別數判定、超額 One-Hot 的一鍵建議及 50 Startups 範例。
