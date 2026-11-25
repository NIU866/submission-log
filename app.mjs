import { calendar, closed, days, localDay, stages, stageLengths, validate, validDay } from "./records.mjs";

const $ = id => document.getElementById(id);
const key = "paper-status-tracker:v1";
const editor = $("editor");
let entries = [];
let selected = null;
let editing = null;
try {
  entries = validate(JSON.parse(localStorage.getItem(key) ?? "[]"));
} catch {
  $("status").textContent = "无法读取浏览器中的记录。可尝试导入已有备份。";
}
selected = entries[0]?.id ?? null;

function save(message) {
  try {
    localStorage.setItem(key, JSON.stringify(entries));
    $("status").textContent = message;
  } catch {
    $("status").textContent = "浏览器保存失败。请导出 JSON 备份以保存本次修改。";
  }
  render();
}

function addElement(parent, tag, text) {
  const el = document.createElement(tag);
  if (text) el.textContent = text;
  parent.append(el);
  return el;
}

function renderPapers() {
  const query = $("query").value.trim().toLowerCase();
  const matches = entries.filter(({ title, journal }) => (title + " " + journal).toLowerCase().includes(query));
  $("papers").replaceChildren();
  for (const paper of matches) {
    const button = addElement(addElement($("papers"), "li"), "button");
    button.type = "button";
    button.className = "paper-button";
    if (paper.id === selected) button.setAttribute("aria-current", "true");
    addElement(button, "strong", paper.title);
    addElement(button, "small", paper.journal + " · " + paper.history.at(-1).stage);
    button.addEventListener("click", () => { selected = paper.id; render(); });
  }
  if (!matches.length) addElement($("papers"), "li", query ? "没有匹配的稿件" : "暂无稿件");
}

function render() {
  renderPapers();
  const active = entries.filter(paper => !closed.has(paper.history.at(-1).stage));
  const due = active.filter(paper => paper.due);
  $("summary").textContent = entries.length + " 篇稿件 · " + active.length + " 篇处理中";
  $("calendar").disabled = !due.length;
  $("backup").disabled = !entries.length;
  const paper = entries.find(item => item.id === selected);
  $("record").hidden = !paper;
  $("empty").hidden = Boolean(paper);
  if (!paper) return;
  const today = localDay();
  const first = paper.history[0];
  const latest = paper.history.at(-1);
  const ended = closed.has(latest.stage);
  $("detail-title").textContent = paper.title;
  $("journal").textContent = paper.journal + " · 投稿于 " + first.date;
  $("current").textContent = latest.stage;
  $("age").textContent = days(first.date, ended ? latest.date : today) + " 天";
  $("due-summary").textContent = paper.due ? paper.due + (ended ? "" : paper.due < today ? "（已过期）" : paper.due === today ? "（今天）" : "") : "未设置";
  $("stage").value = stages[Math.min(stages.indexOf(latest.stage) + 1, stages.length - 1)];
  $("stage-date").min = latest.date;
  $("stage-date").max = today;
  $("stage-date").value = today;
  $("due").value = paper.due;
  $("timeline").replaceChildren();
  $("durations").replaceChildren();
  for (const { stage, date } of [...paper.history].reverse()) {
    const row = addElement($("timeline"), "li");
    const time = addElement(row, "time", date);
    time.dateTime = date;
    addElement(row, "span", stage);
  }
  for (const [stage, count] of stageLengths(paper.history, today)) {
    addElement($("durations"), "dt", stage);
    addElement($("durations"), "dd", count + " 天");
  }
}

function showEditor(paper) {
  editing = paper?.id ?? null;
  $("editor-title").textContent = paper ? "编辑稿件" : "新增稿件";
  $("paper-title").value = paper?.title ?? "";
  $("paper-journal").value = paper?.journal ?? "";
  $("submitted-label").hidden = Boolean(paper);
  $("submitted").disabled = Boolean(paper);
  $("submitted").value = localDay();
  $("submitted").min = "1900-01-01";
  $("submitted").max = localDay();
  $("remove").hidden = !paper;
  editor.showModal();
  $("paper-title").focus();
}

for (const stage of stages) addElement($("stage"), "option", stage);
$("add").addEventListener("click", () => showEditor());
$("edit").addEventListener("click", () => showEditor(entries.find(item => item.id === selected)));
$("cancel").addEventListener("click", () => editor.close());
$("query").addEventListener("input", renderPapers);
$("paper-form").addEventListener("submit", event => {
  event.preventDefault();
  const title = $("paper-title").value.trim();
  const journal = $("paper-journal").value.trim();
  if (!title || !journal) return;
  if (editing) {
    const existing = entries.find(paper => paper.id === editing);
    Object.assign(existing, { title, journal });
  } else {
    if (entries.length >= 400) { alert("稿件已达 400 篇，请先导出备份并整理旧稿件。"); return; }
    const date = $("submitted").value;
    if (!validDay(date)) return;
    selected = crypto.randomUUID();
    entries.unshift({ id:selected, title, journal, history:[{ stage:"已投稿", date }], due:"" });
    $("query").value = "";
  }
  editor.close();
  save("稿件已保存。");
});
$("remove").addEventListener("click", () => {
  if (!editing || !confirm("删除此稿件及其阶段记录？导出的备份仍可使用。")) return;
  entries = entries.filter(paper => paper.id !== editing);
  selected = entries[0]?.id ?? null;
  editor.close();
  save("稿件已删除。");
});
$("event-form").addEventListener("submit", event => {
  event.preventDefault();
  const paper = entries.find(item => item.id === selected);
  const stage = $("stage").value;
  const date = $("stage-date").value;
  const latest = paper?.history.at(-1);
  if (!latest || !stages.includes(stage) || !validDay(date) || date < latest.date || date > localDay()) return;
  if (paper.history.length >= 500) { $("status").textContent = "单篇稿件最多记录 500 次变更。"; return; }
  if (latest.stage === stage && latest.date === date) { $("status").textContent = "此阶段已在该日期记录。"; return; }
  paper.history.push({ stage, date });
  save("阶段变更已保存。");
});
$("deadline-form").addEventListener("submit", event => {
  event.preventDefault();
  const paper = entries.find(item => item.id === selected);
  const date = $("due").value;
  if (paper && (date === "" || validDay(date))) { paper.due = date; save(date ? "返修日期已保存。" : "返修日期已清除。"); }
});

function download(text, name, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

$("calendar").addEventListener("click", () => download(calendar(entries), "论文返修日历.ics", "text/calendar;charset=utf-8"));
$("backup").addEventListener("click", () => download(JSON.stringify({ version:1, entries }, null, 2), "论文投稿备份.json", "application/json"));
$("restore").addEventListener("click", () => $("backup-file").click());
$("backup-file").addEventListener("change", async () => {
  const file = $("backup-file").files[0];
  $("backup-file").value = "";
  if (!file) return;
  try {
    if (file.size > 4 * 1024 ** 2) throw Error("备份文件最多 4 MB");
    const backup = JSON.parse(await file.text());
    if (backup?.version !== 1) throw Error("备份版本不支持");
    const loaded = validate(backup.entries).filter(entry => !entries.some(old => old.id === entry.id));
    if (entries.length + loaded.length > 400) throw Error("合并后稿件超过 400 篇");
    entries.unshift(...loaded);
    selected ??= entries[0]?.id ?? null;
    save("已导入 " + loaded.length + " 篇新稿件，已有记录保留。");
  } catch (error) {
    $("status").textContent = "无法导入 · " + error.message;
  }
});
render();
