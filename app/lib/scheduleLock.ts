const LJUBLJANA_TIME_ZONE = "Europe/Ljubljana";

type LjubljanaParts = {
  date: string;
  hour: number;
  minute: number;
};

function getLjubljanaParts(now: Date): LjubljanaParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LJUBLJANA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);

  const values = new Map(parts.map((part) => [part.type, part.value]));
  return {
    date: `${values.get("year")}-${values.get("month")}-${values.get("day")}`,
    hour: Number(values.get("hour") || 0),
    minute: Number(values.get("minute") || 0),
  };
}

function addCalendarDays(date: string, amount: number) {
  const [year, month, day] = date.split("-").map(Number);
  const result = new Date(Date.UTC(year, month - 1, day + amount, 12));
  return result.toISOString().slice(0, 10);
}

export type ScheduleLockState = {
  locked: boolean;
  reason: "past" | "today" | "tomorrow-cutoff" | null;
  message: string;
  isTomorrow: boolean;
};

export function getScheduleLockState(
  workDate: string,
  now = new Date()
): ScheduleLockState {
  const local = getLjubljanaParts(now);
  const tomorrow = addCalendarDays(local.date, 1);

  if (workDate < local.date) {
    return {
      locked: true,
      reason: "past",
      message: "Past days cannot be edited.",
      isTomorrow: false,
    };
  }

  if (workDate === local.date) {
    return {
      locked: true,
      reason: "today",
      message: "Today is locked. Changes start from tomorrow.",
      isTomorrow: false,
    };
  }

  if (workDate === tomorrow) {
    const afterCutoff = local.hour > 16 || (local.hour === 16 && local.minute >= 30);
    return {
      locked: afterCutoff,
      reason: afterCutoff ? "tomorrow-cutoff" : null,
      message: afterCutoff
        ? "Tomorrow is locked because the 16:30 deadline has passed."
        : "Tomorrow can be changed until 16:30 today.",
      isTomorrow: true,
    };
  }

  return {
    locked: false,
    reason: null,
    message: "This day is open.",
    isTomorrow: false,
  };
}

