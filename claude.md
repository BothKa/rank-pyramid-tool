# Claude Notes — 階級三角形定位系統（v1.0 十關版）

最後更新：2026-06-08

## 專案狀態

- **分支：** `claude/affectionate-dhawan-93b110`（從 main b519b2d 建立）
- **此分支版本：** v1.0 十關卡級聯版
- **主目錄版本：** 五關主軸版（未 commit，見主目錄 claude.md）
- 主要檔案：`index.html`、`styles.css`、`app.js`、`tests/calc.test.js`

## 此版本特色（十關卡 v1.0）

- 10 個關卡：個人關（2.2萬）到外太空關（88000萬）
- 隊長金額可多筆輸入，總額用於級聯計算
- 隊員最多 13 人，各自可多筆金額，取最高值定位
- 三色金字塔 SVG：實得（solid）/ 先得（nominal）/ 未觸及（muted）
- 級聯計算表顯示每關狀態、覆蓋人數、補額、剩餘
- localStorage 持久化

## 已實作功能

- **即時輸入驗證提示（2026-06-08）：**
  - 輸入非空但無法解析的值（如中文、負數、純符號）時，輸入框顯示紅色邊框
  - `aria-invalid="true"` 同步設置，符合無障礙標準
  - 在渲染時（renderAmountList）與即時輸入時（handleFieldEdit）同步更新
  - 空值不觸發錯誤，不影響結果計算

## 計算邏輯摘要

- `toWan(v)` 解析金額；`> 10000` 視為元自動換算
- `gateFor(wan)` 取最高通過的關卡
- `calcCascade` 從個人關逐關推進，不足時隊長補額
- `xianGate`：先得後修定位；`shiGate`：實得上限（隊員最高 +2）
- 隊員定位取多筆金額中的最高值（`maxWanOf`）

## 驗證方式

```bash
node --check app.js
node tests/calc.test.js
```

## 工作規則

- 修改後同步更新本 `claude.md` 與主目錄 `agent.md`
- 不要用 `git reset --hard`
- 推送前確認 `origin/main` 狀態
