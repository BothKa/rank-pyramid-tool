# Agent Notes

最後更新：2026-06-05

## 專案狀態

- 專案名稱：階級三角形定位系統
- 公開網址：https://bothka.github.io/rank-pyramid-tool/
- GitHub repo：BothKa/rank-pyramid-tool
- 主要檔案：`index.html`、`styles.css`、`app.js`、`tests/calc.test.js`

## 已實作重點

- 隊長金額輸入後會即時更新狀態，不重建輸入欄位。
- 手機版狀態列放在隊長金額下方，不固定覆蓋底部介面。
- 隊長可以看到：
  - 隊長個人定位
  - 自己輪迴
  - 團隊輪迴
  - 先得後修 / 實得實修
- 隊員卡片會直接顯示個別狀態。
- 五大輪迴已加入：
  - 小輪迴：個人關 / 家庭關，13 個 2.2 萬 + 3 個 8.8 萬 = 55 萬
  - 中輪迴：事業關 / 社會關，13 個 22 萬 + 3 個 88 萬 = 550 萬
  - 大輪迴、極輪迴、極極輪迴依此倍率類推。

## 工作規則

- 每次完成修改、部署、或重要驗證後，都要同步更新 `agent.md` 和 `claude.md`。
- 修改前先確認遠端 `origin/main`，避免覆蓋 GitHub 上的新 commit。
- 本機 `main` 曾經落後遠端；若要推送，優先從 `origin/main` 建臨時 worktree 或先安全同步。
- 不要用 `git reset --hard` 或直接覆蓋未確認的使用者變更。

## 驗證方式

- 語法檢查：`node --check app.js`
- 計算測試：`node tests/calc.test.js`
- 手機版至少確認：
  - `scrollWidth <= innerWidth`
  - 狀態列沒有蓋住輸入區
  - 隊員卡片有個別狀態
  - 五大輪迴表有 5 列

## 部署備註

- GitHub Pages 會從 `main` 自動部署。
- 目前最新功能 commit：`2c6ca69`，訊息為 `Add five-cycle status tracking`。
- 若手機看到舊版，通常是快取；重新整理或改 query string 可驗證新版。
