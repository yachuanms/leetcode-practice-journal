# LeetCode Practice Journal｜LeetCode 刷題日誌

A browser-based dashboard for tracking LeetCode attempts, scheduling reviews, and visualizing progress by difficulty and topic. Built with HTML, CSS, and JavaScript.

## Features

- **Practice dashboard** — View first attempts and repeat attempts over the past 30 days, plus cumulative difficulty and topic breakdowns.
- **Practice calendar** — See what you practiced each day, schedule upcoming problems, and mark planned problems as practiced.
- **Searchable problem list** — Find problems by number, title, difficulty, or topic. Browse 10 problems per page and view each problem’s practice history and notes.
- **Import and backup** — Import Notion CSV records and use JSON backups to move your data between browsers.

## Run locally

From the repository root, run the following command and open `http://localhost:8000`:

```bash
python -m http.server 8000
```

## Data and statistics

- Records are stored in your browser. Export a JSON backup to move them to another browser or device.
- A Notion attempt count such as `1111` represents four attempts. The CSV date becomes the first practice date. You can add missing dates later without increasing the total.
- Cumulative statistics count distinct practiced problems. A problem with multiple topic tags contributes once to each topic.

## 中文介紹

用來記錄 LeetCode 刷題歷史、安排複習，並查看練習進度的網頁工具。使用 HTML、CSS 和 JavaScript 開發。

- **刷題總覽**：查看最近 30 天的首刷與重刷次數，以及累計的難度圓環圖和題型分布。
- **刷題日曆**：按日期查看刷過的題目、安排接下來要刷的題，並在完成後標記為已刷。
- **題目清單**：支援依題號、題名、難度或題型搜尋，每頁顯示 10 題。點選題目可查看練習歷史和備註。
- **匯入與備份**：支援匯入 Notion CSV，也可以用 JSON 匯出和還原紀錄。

### 在本機執行

在專案資料夾執行 `python -m http.server 8000`，再用瀏覽器開啟 `http://localhost:8000`。

### 紀錄與統計方式

- 資料存在目前使用的瀏覽器。換瀏覽器或裝置時，可以先匯出 JSON 備份，再到新的瀏覽器匯入。
- Notion 的 `1111` 會匯入為四次練習。CSV 的日期會當作首刷日期，其餘日期可以在題目歷史使用「補日期」補上，總次數不會增加。
- 累計圖表以不同題目計算。同一題重刷多次，難度統計仍算一題。有多個題型標籤時，會各計入對應的題型。