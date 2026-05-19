export function formatLocalDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getLocalDayRange(dateInput = new Date()) {
  const date = typeof dateInput === "string" ? parseLocalDate(dateInput) : dateInput;
  const since = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const until = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);

  return {
    date: formatLocalDate(date),
    since,
    until,
  };
}

function parseLocalDate(value) {
  const match = /^(?<year>\d{4})-(?<month>\d{2})-(?<day>\d{2})$/.exec(value);
  if (!match?.groups) {
    throw new Error(`Invalid date "${value}". Use YYYY-MM-DD.`);
  }

  const year = Number(match.groups.year);
  const monthIndex = Number(match.groups.month) - 1;
  const day = Number(match.groups.day);
  const date = new Date(year, monthIndex, day, 12, 0, 0, 0);

  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    throw new Error(`Invalid date "${value}". Use a real calendar date.`);
  }

  return date;
}
