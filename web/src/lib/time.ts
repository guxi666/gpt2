"use client";

function normalizeToUtcInput(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(" ", "T");
  if (/([zZ]|[+\-]\d{2}:\d{2})$/.test(normalized)) {
    return normalized;
  }
  return `${normalized}Z`;
}

export function parseDateAsUtc(value?: string | null) {
  if (!value) {
    return null;
  }
  const date = new Date(normalizeToUtcInput(value));
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
}

export function formatBeijingDateTime(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = parseDateAsUtc(value);
  if (!date) {
    return String(value);
  }
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}
