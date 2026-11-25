# 尾牙遊戲競賽網站

公司尾牙俄羅斯方塊比賽的網站，放在 GitHub Pages。

| 頁面 | 檔案 |
| --- | --- |
| 已報名名單 | `index.html`（資料每 60 秒從 Apps Script 更新） |
| 賽程表 | `schedule.html`（日期改 `assets/schedule-data.js`） |
| 三分鐘試玩 | `play.html`（全部在瀏覽器執行） |

## 資料從哪裡來

報名名單由 Apps Script 讀 Google 表單回應試算表，網址在 `assets/config.js`：

```
<API_URL>?api=registrations  →  { teams: [...], checkedAt: "..." }
```

網頁用 `fetch(..., { credentials: 'omit' })` 讀資料，不帶 Google 登入資訊。
這樣同時登入多個 Google 帳號的瀏覽器，也不會遇到 Apps Script 的 `/u/1/` 404 問題。

## 本機預覽

```
npx serve .
```
