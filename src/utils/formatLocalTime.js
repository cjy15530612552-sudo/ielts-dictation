export function formatLocalTime(timestamp, now = new Date()) {
  if (!timestamp) return "尚未完成";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "—";
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const days = Math.round((startToday - startDate) / 86400000);
  const time = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
  if (days === 0) return `今天 ${time}`;
  if (days === 1) return `昨天 ${time}`;
  const calendar = new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  return `${calendar} ${time}`;
}
