'use strict';

const byId = id => document.getElementById(id);
const storageKey = 'leetcode-journal-v1';
const levels = ['Easy', 'Medium', 'Hard'];
const pad = value => String(value).padStart(2, '0');
const dateKey = date => [date.getFullYear(), pad(date.getMonth() + 1), pad(date.getDate())].join('-');
const asDate = key => new Date(key + 'T12:00:00');
const offsetDay = (key, offset) => {
  const date = asDate(key);
  date.setDate(date.getDate() + offset);
  return dateKey(date);
};
const today = dateKey(new Date());
const tomorrow = offsetDay(today, 1);
const fresh = () => ({version: 1, problems: [], attempts: [], plans: []});
const escape = value => String(value).replace(/[&<>"']/g, character =>
  ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'})[character]);
const tagsFrom = value => [...new Set(value.split(/[,，;；]/).map(tag => tag.trim()).filter(Boolean))];
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && dateKey(asDate(value)) === value;
const validId = value => Number.isInteger(value) && value > 0 && value <= 999999;
const displayDate = key => new Intl.DateTimeFormat('zh-TW', {month:'long', day:'numeric', weekday:'short'}).format(asDate(key));

function validate(data) {
  if (data?.version !== 1 || !['problems','attempts','plans'].every(key => Array.isArray(data[key]))) {
    throw new Error('無法辨識這份備份。');
  }
  const ids = new Set();
  for (const problem of data.problems) {
    if (!problem || !validId(problem.id) || ids.has(problem.id) || typeof problem.title !== 'string' ||
        !problem.title.trim() || !levels.includes(problem.level) || !Array.isArray(problem.tags) ||
        !problem.tags.every(tag => typeof tag === 'string') || !Number.isSafeInteger(problem.unknown) ||
        problem.unknown < 0 || typeof problem.note !== 'string') throw new Error('備份內有無效題目。');
    ids.add(problem.id);
  }
  const planKeys = new Set();
  const firstIds = new Set();
  for (const row of [...data.attempts, ...data.plans]) {
    if (!row || !ids.has(row.id) || !validDate(row.date)) throw new Error('備份內有無效的練習或計畫。');
  }
  for (const row of data.attempts) {
    if (typeof row.note !== 'string' || !['first','repeat'].includes(row.kind) ||
        (row.kind === 'first' && firstIds.has(row.id))) throw new Error('備份內有無效的練習類型。');
    if (row.kind === 'first') firstIds.add(row.id);
  }
  for (const row of data.plans) {
    const key = row.id + ':' + row.date;
    if (planKeys.has(key)) throw new Error('備份內有重複的計畫。');
    planKeys.add(key);
  }
  return data;
}

function load() {
  try {
    const saved = localStorage.getItem(storageKey);
    return saved ? validate(JSON.parse(saved)) : fresh();
  } catch {
    byId('status').textContent = '無法讀取瀏覽器紀錄。請匯入先前下載的備份。';
    return fresh();
  }
}

let data = load();
let selectedDate = today;
let visibleMonth = asDate(today.slice(0, 7) + '-01');
let selectedProblem = data.problems[0]?.id;
const problemsPerPage = 10;
let problemPage = 1;
let editorMode = 'practice';

function commit(next) {
  localStorage.setItem(storageKey, JSON.stringify(next));
  data = next;
  render();
}

function mutate(update) {
  try {
    const next = structuredClone(data);
    update(next);
    commit(next);
  } catch (error) {
    byId('status').textContent = error.message || '儲存失敗。';
  }
}

const getProblem = id => data.problems.find(problem => problem.id === id);
const numberOfAttempts = problem => problem.unknown + data.attempts.filter(row => row.id === problem.id).length;
const nameOf = problem => '#' + problem.id + ' ' + escape(problem.title);
const badges = problem => '<span class="tags"><span class="tag ' + problem.level.toLowerCase() + '">' + problem.level +
  '</span>' + problem.tags.map(tag => '<span class="tag">' + escape(tag) + '</span>').join('') + '</span>';

function selectDate(key) {
  selectedDate = key;
  visibleMonth = asDate(key.slice(0, 7) + '-01');
  renderCalendar();
  renderChart();
}

function renderChart() {
  const window = Array.from({length:30}, (_, index) => offsetDay(today, index - 29));
  const counts = new Map(window.map(key => [key, {first:0, repeat:0}]));
  for (const {date, kind} of data.attempts) {
    if (counts.has(date)) counts.get(date)[kind]++;
  }
  const maximum = Math.max(1, ...[...counts.values()].map(row => row.first + row.repeat));
  byId('chart').innerHTML = window.map(date => {
    const {first, repeat} = counts.get(date);
    const label = date + '，首刷 ' + first + ' 次，重刷 ' + repeat + ' 次';
    const bars = [['first', first], ['repeat', repeat]].filter(([, count]) => count).map(([kind, count]) =>
      '<i class="' + kind + '" style="height:' + (100 * count / maximum) + '%"></i>').join('');
    return '<button type="button" data-day="' + date + '" aria-pressed="' + (date === selectedDate) +
      '" aria-label="' + label + '" title="' + label + '">' + bars + '</button>';
  }).join('');
  const selected = counts.get(selectedDate);
  byId('chart-caption').textContent = selected ? displayDate(selectedDate) + ' · 首刷 ' + selected.first +
    ' 次 · 重刷 ' + selected.repeat + ' 次' : '範圍 ' + window[0] + ' 至 ' + today;
}

function renderStats() {
  const practicedIds = new Set(data.attempts.map(row => row.id));
  const practiced = data.problems.filter(problem => problem.unknown || practicedIds.has(problem.id));
  const difficulties = Object.fromEntries(levels.map(level => [level, 0]));
  const topics = new Map();
  for (const problem of practiced) {
    difficulties[problem.level]++;
    const distinctTags = new Map(problem.tags.map(tag => [tag.toLowerCase(), tag]));
    for (const [key, tag] of distinctTags) {
      const topic = topics.get(key) || {tag, count:0};
      topic.count++;
      topics.set(key, topic);
    }
  }
  let position = 0;
  const segments = [];
  byId('levels').innerHTML = levels.map(level => {
    const count = difficulties[level];
    const cssClass = level.toLowerCase();
    if (count) {
      segments.push('var(--' + cssClass + ') ' + (position / practiced.length * 100) + '% ' +
        ((position + count) / practiced.length * 100) + '%');
      position += count;
    }
    return '<li><span class="tag ' + cssClass + '">' + level + '</span><span>' + count + ' 題</span></li>';
  }).join('');
  byId('donut').style.setProperty('--segments', segments.join(', ') || 'var(--line) 0% 100%');
  byId('donut').innerHTML = '<div><b>' + practiced.length + '</b><small>不同題目</small></div>';
  const ranked = [...topics.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  byId('topic-count').textContent = ranked.length + ' 個類別';
  byId('topics').innerHTML = ranked.map(({tag, count}) => '<li><span>' + escape(tag) +
    '</span><span class="track" aria-hidden="true"><i style="width:' + (100 * count / ranked[0].count) +
    '%"></i></span><span>' + count + ' 題</span></li>').join('') || '<li>記下第一題後，這裡會顯示題型。</li>';
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  byId('month').textContent = year + ' 年 ' + (month + 1) + ' 月';
  const weekdays = ['一','二','三','四','五','六','日'].map(day => '<span class="weekday">' + day + '</span>').join('');
  const leading = '<span></span>'.repeat((visibleMonth.getDay() + 6) % 7);
  const attempted = new Set(data.attempts.map(row => row.date));
  const planned = new Set(data.plans.map(row => row.date));
  const days = Array.from({length:new Date(year, month + 1, 0).getDate()}, (_, index) => {
    const day = index + 1;
    const key = dateKey(new Date(year, month, day));
    const status = (attempted.has(key) ? '，有練習紀錄' : '') + (planned.has(key) ? '，有計畫' : '');
    return '<button type="button" data-day="' + key + '" aria-label="' + key + status + '" aria-pressed="' +
      (key === selectedDate) + '"' + (key === today ? ' aria-current="date"' : '') + '>' + day +
      '<span class="day-marks" aria-hidden="true">' + (attempted.has(key) ? '<i class="dot repeat"></i>' : '') +
      (planned.has(key) ? '<i class="dot planned"></i>' : '') + '</span></button>';
  });
  byId('month-grid').innerHTML = weekdays + leading + days.join('');
  byId('selected-day').textContent = displayDate(selectedDate) + (selectedDate === today ? ' · 今天' : selectedDate === tomorrow ? ' · 明天' : '');
  const attempts = data.attempts.filter(row => row.date === selectedDate);
  const plans = data.plans.filter(row => row.date === selectedDate);
  const actualRows = attempts.map(row => '<li>' + nameOf(getProblem(row.id)) +
    ' <small>· ' + (row.kind === 'first' ? '首刷' : '重刷') + '</small>' + badges(getProblem(row.id)) +
    (row.note ? '<small>' + escape(row.note) + '</small>' : '') + '</li>');
  const planRows = plans.map(row => '<li>' + nameOf(getProblem(row.id)) + badges(getProblem(row.id)) + '<div class="row-actions">' +
    (selectedDate <= today ? '<button type="button" data-done="' + row.id + '">記為已刷</button>' : '') +
    '<button type="button" data-remove="' + row.id + '">取消計畫</button></div></li>');
  byId('agenda').innerHTML = '<h4>已刷 · ' + attempts.length + ' 次</h4>' +
    (actualRows.length ? '<ul>' + actualRows.join('') + '</ul>' : '<small>這天還沒有刷題紀錄。</small>') +
    '<h4>計畫 · ' + plans.length + ' 題</h4>' +
    (planRows.length ? '<ul>' + planRows.join('') + '</ul>' : '<small>這天還沒有排題。</small>');
}

function renderProblems(revealSelection = false) {
  const query = byId('search').value.trim().toLowerCase();
  const matching = data.problems.filter(problem =>
    (problem.id + ' ' + problem.title + ' ' + problem.level + ' ' + problem.tags.join(' ')).toLowerCase().includes(query));
  const pageCount = Math.ceil(matching.length / problemsPerPage);
  if (revealSelection) {
    const index = matching.findIndex(problem => problem.id === selectedProblem);
    if (index >= 0) problemPage = Math.floor(index / problemsPerPage) + 1;
  }
  problemPage = Math.min(Math.max(problemPage, 1), Math.max(pageCount, 1));
  const start = (problemPage - 1) * problemsPerPage;
  const visibleProblems = matching.slice(start, start + problemsPerPage);
  if (!visibleProblems.some(problem => problem.id === selectedProblem)) selectedProblem = visibleProblems[0]?.id;
  byId('problem-pagination').hidden = pageCount <= 1;
  byId('problem-prev').disabled = problemPage <= 1;
  byId('problem-next').disabled = problemPage >= pageCount;
  byId('problem-page-label').textContent = '第 ' + problemPage + ' / ' + pageCount + ' 頁 · ' + matching.length + ' 題';
  byId('problem-list').innerHTML = visibleProblems.map(problem => '<button type="button" class="problem" data-problem="' + problem.id +
    '" aria-pressed="' + (problem.id === selectedProblem) + '"><span class="section-head"><span>' + nameOf(problem) +
    '</span><small>' + numberOfAttempts(problem) + ' 次</small></span>' + badges(problem) + '</button>').join('') ||
    '<p>' + (query ? '沒有符合的題目。' : '記一筆練習或匯入 Notion CSV，開始建立清單。') + '</p>';
  const problem = getProblem(selectedProblem);
  if (!problem) {
    byId('history').innerHTML = '<h3>練習歷史</h3><p>選擇題目後查看紀錄。</p>';
    return;
  }
  const history = data.attempts.filter(row => row.id === problem.id).sort((a, b) => b.date.localeCompare(a.date));
  const entries = history.map(row => '<li><time datetime="' + row.date + '">' + row.date + '</time> <small>· ' +
    (row.kind === 'first' ? '首刷' : '重刷') + '</small>' + (row.note ? '<br><small>' + escape(row.note) + '</small>' : '') + '</li>');
  byId('history').innerHTML = '<h3>練習歷史</h3><p>' + nameOf(problem) + '</p>' + badges(problem) +
    '<small>共 ' + numberOfAttempts(problem) + ' 次 · ' + history.length + ' 次有日期</small><ul>' +
    entries.join('') + (problem.unknown ? '<li><small>' + problem.unknown + ' 次日期未記錄</small></li>' : '') + '</ul>' +
    (problem.note ? '<p>題目備註 · ' + escape(problem.note) + '</p>' : '') +
    '<div class="data-actions"><button type="button" data-review="' + problem.id + '">再刷一次</button>' +
    (problem.unknown ? '<button type="button" data-backfill="' + problem.id + '">補日期</button>' : '') + '</div>';
}

function render() {
  renderChart();
  renderStats();
  renderCalendar();
  renderProblems();
  byId('demo').hidden = data.problems.length > 0;
  byId('clear-demo').hidden = !data.demo;
  byId('import-csv').disabled = Boolean(data.demo);
  byId('import-csv').title = data.demo ? '請先清除示範資料再匯入真實紀錄。' : '';
}

function recordAttempt(next, problem, date, note, backfill) {
  const hasHistory = next.attempts.some(row => row.id === problem.id);
  const kind = !hasHistory && problem.unknown === 0 ? 'first' : 'repeat';
  if (backfill) problem.unknown--;
  next.attempts.push({id:problem.id, date, note, kind});
  next.plans = next.plans.filter(row => row.id !== problem.id || row.date !== date);
}

const editor = byId('editor');
const form = byId('editor-form');
const fields = form.elements;
function syncEditor() {
  const isNew = fields.existing.value === '';
  byId('new-fields').hidden = !isNew;
  fields.id.required = isNew;
  fields.title.required = isNew;
  const problem = getProblem(Number(fields.existing.value));
  const allowBackfill = editorMode === 'practice' && Boolean(problem?.unknown);
  byId('unknown-field').hidden = !allowBackfill;
  if (!allowBackfill) fields.backfill.checked = false;
}

function openEditor(mode, date, id, backfill = false) {
  editorMode = mode;
  form.reset();
  byId('editor-error').textContent = '';
  byId('editor-title').textContent = mode === 'plan' ? '安排刷題' : '記錄練習';
  byId('note-field').hidden = mode === 'plan';
  fields.date.value = date;
  fields.date.max = mode === 'practice' ? today : '';
  fields.existing.innerHTML = '<option value="">新增題目</option>' + data.problems.map(problem =>
    '<option value="' + problem.id + '">' + nameOf(problem) + '</option>').join('');
  fields.existing.value = id ? String(id) : '';
  fields.backfill.checked = backfill;
  syncEditor();
  editor.showModal();
}

form.addEventListener('submit', event => {
  event.preventDefault();
  try {
    const next = structuredClone(data);
    const date = fields.date.value;
    const id = Number(fields.existing.value || fields.id.value);
    if (!validId(id) || !validDate(date)) throw new Error('請確認題號和日期。');
    if (editorMode === 'practice' && date > today) throw new Error('練習日期須為今天或更早。');
    let problem = next.problems.find(item => item.id === id);
    if (!fields.existing.value) {
      if (problem) throw new Error('這個題號已存在，請在上方選擇。');
      const title = fields.title.value.trim();
      if (!title) throw new Error('請填寫題目名稱。');
      problem = {id, title, level:fields.level.value, tags:tagsFrom(fields.tags.value), note:'', unknown:0};
      next.problems.push(problem);
    }
    if (editorMode === 'plan') {
      if (next.plans.some(row => row.id === id && row.date === date)) throw new Error('這題已在當天的計畫中。');
      next.plans.push({id, date});
    } else {
      recordAttempt(next, problem, date, fields.note.value.trim(), fields.backfill.checked && problem.unknown > 0);
    }
    commit(next);
    selectedProblem = id;
    selectDate(date);
    renderProblems(true);
    editor.close();
  } catch (error) {
    byId('editor-error').textContent = error.message;
  }
});

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') {
        field += '"';
        index++;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
    } else if (character === '"' && field === '') {
      quoted = true;
    } else if (character === ',') {
      row.push(field);
      field = '';
    } else if (character === '\n' || character === '\r') {
      if (character === '\r' && input[index + 1] === '\n') index++;
      rows.push([...row, field]);
      row = [];
      field = '';
    } else {
      field += character;
    }
  }
  if (quoted) throw new Error('CSV 有尚未結束的引號。');
  if (row.length || field) rows.push([...row, field]);
  return rows.filter(cells => cells.some(cell => cell.trim()));
}

function importDate(value) {
  const raw = value.trim();
  const yearFirst = raw.match(/^(\d{4})[-/.年]\s*(\d{1,2})[-/.月]\s*(\d{1,2})日?(?:\s|T|$)/);
  if (yearFirst) {
    const [, year, month, day] = yearFirst;
    const key = [year, pad(month), pad(day)].join('-');
    return validDate(key) ? key : '';
  }
  const us = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s|$)/);
  if (us) return importDate(us[3] + '-' + us[1] + '-' + us[2]);
  if (!/^(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s*\d{4}$/i.test(raw)) return '';
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : dateKey(parsed);
}

function mergeNotion(current, text) {
  const [header, ...rows] = parseCsv(text);
  if (!header) throw new Error('CSV 內容是空的。');
  const keys = header.map(name => name.trim().toLowerCase());
  const column = (...aliases) => keys.findIndex(name => aliases.includes(name));
  const titleIndex = column('leetcode no.', 'leetcode no', 'leetcode', '題目', 'problem', 'name', 'title');
  const levelIndex = column('level', '難度', 'difficulty');
  if (titleIndex < 0 || levelIndex < 0) throw new Error('找不到「Leetcode No.」或「Level」欄位。');
  const numberIndex = column('題號', 'problem number', 'leetcode id');
  const dateIndex = column('日期', 'date', 'first solved');
  const countIndex = column('次數', 'count', 'attempts');
  const tagIndex = column('多選', '題型', 'tags', 'topics');
  const hintIndex = column('hint');
  const noteIndex = column('文字', 'note', '備註', 'notes');
  const next = structuredClone(current);
  let imported = 0;
  let skipped = 0;
  let unreadableDates = 0;
  for (const row of rows) {
    const cell = index => row[index]?.trim() || '';
    const rawTitle = cell(titleIndex);
    const combined = rawTitle.match(/^#?(\d+)[.、):：\s-]+(.+)$/);
    const id = Number(combined?.[1] || cell(numberIndex));
    const title = (combined?.[2] || rawTitle).trim();
    const level = levels.find(item => item.toLowerCase() === cell(levelIndex).toLowerCase());
    if (!validId(id) || !title || !level) {
      skipped++;
      continue;
    }
    const tags = tagsFrom(cell(tagIndex));
    const note = [cell(hintIndex), cell(noteIndex)].filter(Boolean).join('\n');
    let problem = next.problems.find(item => item.id === id);
    if (!problem) {
      problem = {id, title, level, tags, note, unknown:0};
      next.problems.push(problem);
    } else {
      problem.tags = [...new Set([...problem.tags, ...tags])];
      if (!problem.note) problem.note = note;
    }
    const rawDate = cell(dateIndex);
    const date = importDate(rawDate);
    if (rawDate && !date) unreadableDates++;
    const marks = cell(countIndex);
    const total = /^1+$/.test(marks) ? marks.length : Number(marks);
    const prior = next.attempts.filter(item => item.id === id);
    if (date && !prior.some(item => item.date === date)) {
      const first = prior.find(item => item.kind === 'first');
      const kind = !first || date < first.date ? 'first' : 'repeat';
      if (kind === 'first' && first) first.kind = 'repeat';
      const fillsUnknown = problem.unknown > 0 && !first;
      next.attempts.push({id, date, note:'', kind});
      if (fillsUnknown) problem.unknown--;
      prior.push(next.attempts.at(-1));
    }
    if (date) {
      const sameDay = prior.find(item => item.date === date);
      const first = prior.find(item => item.kind === 'first');
      if (sameDay && (!first || date < first.date)) {
        if (first) first.kind = 'repeat';
        sameDay.kind = 'first';
      }
    }
    const stated = Number.isSafeInteger(total) && total > 0 ? total : 0;
    problem.unknown = Math.max(problem.unknown, Math.max(stated, rawDate ? 1 : 0) - prior.length);
    imported++;
  }
  return {next, imported, skipped, unreadableDates};
}

function downloadBackup() {
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'leetcode-journal-' + today + '.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function readInput(event, action) {
  const file = event.target.files[0];
  event.target.value = '';
  if (!file) return;
  try {
    if (file.size > 5 * 1024 * 1024) throw new Error('檔案超過 5 MB，請選擇較小的檔案。');
    action(await file.text());
  } catch (error) {
    byId('status').textContent = error.message || '讀取檔案失敗。';
  }
}

function loadDemo() {
  if (data.problems.length) return;
  if (!confirm('示範資料會存入這個瀏覽器。之後可在資料管理移除示範。要載入嗎？')) return;
  mutate(next => {
    next.demo = true;
    next.problems = [
      {id:153,title:'Find Minimum in Rotated Sorted Array',level:'Medium',tags:['Array','Binary Search'],unknown:1,note:'切一半，比大小'},
      {id:704,title:'Binary Search',level:'Easy',tags:['Array','Binary Search'],unknown:0,note:''},
      {id:51,title:'N-Queens',level:'Hard',tags:['Backtracking'],unknown:0,note:''},
      {id:70,title:'Climbing Stairs',level:'Easy',tags:['Dynamic Programming'],unknown:0,note:''},
      {id:424,title:'Longest Repeating Character Replacement',level:'Medium',tags:['Sliding Window','Hash Table'],unknown:0,note:''}
    ];
    const examples = [[153,-12,'first'],[153,-7,'repeat'],[704,-7,'first'],[51,-5,'first'],[70,-3,'first'],[153,-1,'repeat']];
    next.attempts = examples.map(([id, offset, kind]) => ({id, date:offsetDay(today, offset), kind, note:''}));
    next.plans = [{id:424,date:tomorrow}];
    selectedProblem = 153;
  });
}

byId('today').textContent = displayDate(today);
byId('demo').addEventListener('click', loadDemo);
byId('clear-demo').addEventListener('click', () => {
  if (!data.demo || !confirm('這會清除示範模式中的全部資料。要先保留請下載 JSON 備份。確定清除？')) return;
  mutate(next => {
    delete next.demo;
    Object.assign(next, fresh());
    selectedProblem = undefined;
  });
});
byId('add-practice').addEventListener('click', () => openEditor('practice', today));
byId('add-plan').addEventListener('click', () => openEditor('plan', selectedDate));
byId('close-editor').addEventListener('click', () => editor.close());
fields.existing.addEventListener('change', syncEditor);
byId('tomorrow').addEventListener('click', () => selectDate(tomorrow));
for (const [id, offset] of [['prev', -1], ['next', 1]]) {
  byId(id).addEventListener('click', () => selectDate(dateKey(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1))));
}
for (const id of ['chart', 'month-grid']) {
  byId(id).addEventListener('click', event => {
    const button = event.target.closest('[data-day]');
    if (!button) return;
    const key = button.dataset.day;
    selectDate(key);
    byId(id).querySelector('[data-day="' + key + '"]')?.focus();
  });
}
byId('agenda').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.done && selectedDate <= today) {
    const id = Number(button.dataset.done);
    mutate(next => recordAttempt(next, next.problems.find(item => item.id === id), selectedDate, '', false));
  }
  if (button.dataset.remove) {
    const id = Number(button.dataset.remove);
    mutate(next => { next.plans = next.plans.filter(row => row.id !== id || row.date !== selectedDate); });
  }
});
byId('problem-list').addEventListener('click', event => {
  const button = event.target.closest('[data-problem]');
  if (!button) return;
  selectedProblem = Number(button.dataset.problem);
  renderProblems();
  byId('problem-list').querySelector('[data-problem="' + selectedProblem + '"]')?.focus();
});
byId('search').addEventListener('input', () => {
  problemPage = 1;
  renderProblems();
});
for (const [id, offset] of [['problem-prev', -1], ['problem-next', 1]]) {
  byId(id).addEventListener('click', () => {
    problemPage += offset;
    renderProblems();
    if (byId(id).disabled) byId('problem-list').querySelector('[data-problem]')?.focus();
  });
}
byId('history').addEventListener('click', event => {
  const button = event.target.closest('button');
  if (!button) return;
  if (button.dataset.review) openEditor('practice', today, Number(button.dataset.review));
  if (button.dataset.backfill) openEditor('practice', today, Number(button.dataset.backfill), true);
});
byId('import-csv').addEventListener('click', () => byId('csv-file').click());
byId('restore').addEventListener('click', () => byId('json-file').click());
byId('backup').addEventListener('click', downloadBackup);
byId('csv-file').addEventListener('change', event => readInput(event, text => {
  const {next, imported, skipped, unreadableDates} = mergeNotion(data, text);
  if (!imported) throw new Error('沒有可匯入的題目。請確認題號格式和難度欄位。');
  selectedProblem = next.problems[0]?.id;
  problemPage = 1;
  commit(next);
  byId('status').textContent = '已處理 ' + imported + ' 筆題目' +
    (skipped ? '，略過 ' + skipped + ' 筆無法辨識的資料' : '') +
    (unreadableDates ? '，有 ' + unreadableDates + ' 筆日期需手動補記' : '') + '。';
}));
byId('json-file').addEventListener('change', event => readInput(event, text => {
  const next = validate(JSON.parse(text));
  if (!confirm('這會用備份取代此瀏覽器目前的紀錄。要繼續嗎？')) return;
  selectedProblem = next.problems[0]?.id;
  problemPage = 1;
  commit(next);
  byId('status').textContent = '已還原備份。';
}));
render();
