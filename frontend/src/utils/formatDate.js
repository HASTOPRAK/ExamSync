const TZ = "Europe/Istanbul";

export function formatDate(value) {
  if (!value) return "-";

  // Date-only strings ("YYYY-MM-DD") are parsed as UTC midnight by the spec,
  // which can roll back a day in negative-offset zones. Anchor to noon Turkey
  // time so the calendar date is stable everywhere.
  const isDateOnly = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = isDateOnly ? new Date(value + "T12:00:00+03:00") : new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString("en-GB", {
    timeZone: TZ,
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(value) {
  if (!value) return "-";
  return String(value).slice(0, 5);
}
