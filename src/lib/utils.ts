export function intFromForm(value: FormDataEntryValue | null) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

export function textFromForm(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export function wordCount(text?: string | null) {
  if (!text) return 0;
  const compact = text.replace(/\s/g, "");
  return Array.from(compact).length;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
