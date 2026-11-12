# LeetCode Practice Journal

A browser-local journal for LeetCode practice, review plans, and cumulative statistics. The site is plain HTML, CSS, and JavaScript.

## Run locally

From the repository root, run `python -m http.server 8000` and open `http://localhost:8000`. These files can also be hosted as a static site, including on GitHub Pages.

## Data

- Browser storage holds problems, dated attempts, undated attempts, and scheduled reviews. Download a JSON backup to move the journal between browsers.
- Notion CSV import supports `Leetcode No.`, `Level`, `多選`, `日期`, `次數`, `Hint`, and `文字`. A value such as `1111` is four attempts. The original date becomes a dated attempt, with remaining attempts kept as undated. Import merges by LeetCode problem number.
- To enter dates from Notion comments, open the problem's history and choose 補日期. This moves an undated attempt onto the calendar without increasing its total.
- Difficulty and topic statistics count distinct practiced problems. A problem can contribute once to each of several topics.
