export type ShiftChoice = "07:00" | "15:30" | "whole_day" | "other";

export const SHIFT_CHOICES: Array<{
  value: ShiftChoice;
  label: string;
  description: string;
}> = [
  { value: "07:00", label: "7:00", description: "Morning start" },
  { value: "15:30", label: "15:30", description: "Afternoon start" },
  { value: "whole_day", label: "Whole day", description: "Available all day" },
  { value: "other", label: "Other", description: "Set a custom range" },
];

const LEGACY_LABELS: Record<string, string> = {
  first: "First shift (legacy)",
  second: "Second shift (legacy)",
  third: "Third shift (legacy)",
  off: "Day off (legacy)",
};

export function encodeCustomShift(start: string, end: string) {
  return `other|${start}|${end}`;
}

export function parseCustomShift(value: string | null | undefined) {
  if (!value?.startsWith("other|")) return null;

  const [, start, end] = value.split("|");
  if (!start || !end) return null;

  return { start, end };
}

export function getShiftLabel(value: string | null | undefined) {
  if (!value) return "Not set";

  const custom = parseCustomShift(value);
  if (custom) return `${custom.start}–${custom.end}`;

  if (value === "07:00") return "7:00";
  if (value === "15:30") return "15:30";
  if (value === "whole_day") return "Whole day";
  if (value === "other") return "Custom time";

  return LEGACY_LABELS[value] ?? value;
}

export function getShiftTone(value: string | null | undefined) {
  if (value === "07:00" || value === "first") {
    return "border-sky-400/20 bg-sky-400/10 text-sky-300";
  }

  if (value === "15:30" || value === "second") {
    return "border-emerald-400/20 bg-emerald-400/10 text-emerald-300";
  }

  if (value === "whole_day" || value === "third") {
    return "border-violet-400/20 bg-violet-400/10 text-violet-300";
  }

  if (value?.startsWith("other|")) {
    return "border-amber-400/20 bg-amber-400/10 text-amber-300";
  }

  return "border-slate-400/20 bg-slate-400/10 text-slate-300";
}
