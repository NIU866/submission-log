export const stages = ["已投稿", "技术审查", "编辑处理中", "外审中", "返修", "已重新提交", "已接收", "已拒稿", "已撤稿"];
export const closed = new Set(["已接收", "已拒稿", "已撤稿"]);
const DAY = 86400000;
const encoder = new TextEncoder();

export function localDay() {
  const now = new Date();
  return [now.getFullYear(), now.getMonth() + 1, now.getDate()].map((value, i) => String(value).padStart(i ? 2 : 4, "0")).join("-");
}

export function validDay(date) {
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < "1900-01-01" || date > "9998-12-31") return false;
  const value = Date.parse(date + "T00:00:00Z");
  return Number.isFinite(value) && new Date(value).toISOString().slice(0, 10) === date;
}

export function days(from, until) {
  return Math.max(0, Math.round((Date.parse(until + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / DAY));
}

export function stageLengths(history, until) {
  const totals = new Map();
  history.forEach(({ stage, date }, index) => {
    const end = history[index + 1]?.date ?? (closed.has(stage) ? date : until);
    totals.set(stage, (totals.get(stage) ?? 0) + days(date, end));
  });
  return totals;
}

export function validate(entries) {
  if (!Array.isArray(entries) || entries.length > 400) throw Error("备份格式无效或记录超过 400 条");
  const ids = new Set();
  return entries.map(entry => {
    if (!entry || typeof entry.id !== "string" || !/^[a-z0-9-]{8,64}$/.test(entry.id) || ids.has(entry.id) ||
        typeof entry.title !== "string" || !entry.title.trim() || entry.title.length > 240 ||
        typeof entry.journal !== "string" || !entry.journal.trim() || entry.journal.length > 160 ||
        (entry.due !== "" && !validDay(entry.due)) || !Array.isArray(entry.history) ||
        !entry.history.length || entry.history.length > 500) throw Error("有一条稿件记录格式不正确");
    ids.add(entry.id);
    const history = entry.history.map((item, index) => {
      if (!item || !stages.includes(item.stage) || !validDay(item.date) ||
          (index && item.date < entry.history[index - 1].date)) throw Error("阶段或日期格式不正确");
      return { date: item.date, stage: item.stage };
    });
    return { id: entry.id, title: entry.title, journal: entry.journal, history, due: entry.due };
  });
}

function escape(value) {
  return value.replaceAll("\\", "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/([;,])/g, "\\$1");
}

function fold(line) {
  const pieces = [];
  let piece = "";
  let length = 0;
  for (const character of line) {
    const bytes = encoder.encode(character).length;
    if (length + bytes > 75) {
      pieces.push(piece);
      piece = " ";
      length = 1;
    }
    piece += character;
    length += bytes;
  }
  pieces.push(piece);
  return pieces.join("\r\n");
}

export function calendar(entries, now = new Date()) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Paper Status Tracker//ZH", "CALSCALE:GREGORIAN"];
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  for (const { id, title, journal, due, history } of entries) {
    if (!validDay(due) || closed.has(history.at(-1).stage)) continue;
    const next = new Date(Date.parse(due + "T00:00:00Z") + DAY).toISOString().slice(0, 10);
    lines.push("BEGIN:VEVENT", "UID:" + id + "-revision@paper-status-tracker", "DTSTAMP:" + stamp,
      "DTSTART;VALUE=DATE:" + due.replaceAll("-", ""), "DTEND;VALUE=DATE:" + next.replaceAll("-", ""),
      "SUMMARY:" + escape("返修截止 · " + title), "DESCRIPTION:" + escape(journal), "END:VEVENT");
  }
  return lines.map(fold).join("\r\n") + "\r\nEND:VCALENDAR\r\n";
}
