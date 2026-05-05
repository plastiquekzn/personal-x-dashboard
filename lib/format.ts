const utcDateTimeFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "UTC"
});

const utcDateFormatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeZone: "UTC"
});

const utcTimeFormatter = new Intl.DateTimeFormat("en", {
  timeStyle: "short",
  timeZone: "UTC"
});

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return utcDateTimeFormatter.format(date);
}

export function formatDateOnly(value: string | null) {
  if (!value) {
    return "Unknown";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return utcDateFormatter.format(date);
}

export function formatTimeOnly(value: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return utcTimeFormatter.format(date);
}

export function formatCompactNumber(value: number | null) {
  if (value === null || Number.isNaN(value)) {
    return "-";
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(value);
}

export function toDateTimeInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (part: number) => String(part).padStart(2, "0");

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}`;
}

export function fromDateTimeInputValue(value: string) {
  if (!value) {
    return "";
  }

  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);

  if (!match) {
    return "";
  }

  const [, yearPart, monthPart, dayPart, hoursPart, minutesPart] = match;
  const year = Number.parseInt(yearPart, 10);
  const month = Number.parseInt(monthPart, 10);
  const day = Number.parseInt(dayPart, 10);
  const hours = Number.parseInt(hoursPart, 10);
  const minutes = Number.parseInt(minutesPart, 10);

  const utcTimestamp = Date.UTC(year, month - 1, day, hours, minutes, 0);
  const date = new Date(utcTimestamp);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
