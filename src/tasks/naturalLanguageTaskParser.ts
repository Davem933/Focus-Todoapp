export type ParsedTaskInput = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  message: string | null;
  hasConflict: boolean;
};

type ParsedToken = {
  end: number;
  isUncertain?: boolean;
  start: number;
  value: string;
};

const WEEKDAY_INDEX_BY_NAME: Record<string, number> = {
  pondeli: 1,
  pondělí: 1,
  utery: 2,
  úterý: 2,
  stredu: 3,
  středu: 3,
  ctvrtek: 4,
  čtvrtek: 4,
  patek: 5,
  pátek: 5,
  sobotu: 6,
  nedeli: 0,
  neděli: 0,
};

const DAY_PART_TIME_BY_NAME: Record<string, string> = {
  ráno: "09:00",
  rano: "09:00",
  dopoledne: "10:00",
  poledne: "12:00",
  odpoledne: "15:00",
  večer: "19:00",
  vecer: "19:00",
  noc: "21:00",
};

export function parseTaskInput(input: string, now = new Date()): ParsedTaskInput {
  const trimmedInput = input.trim();

  if (!trimmedInput) {
    return {
      title: "",
      dueDate: null,
      dueTime: null,
      message: null,
      hasConflict: false,
    };
  }

  const dateTokens = findDateTokens(trimmedInput, now);
  const timeTokens = findTimeTokens(trimmedInput, dateTokens);
  const dayPartTokens = findDayPartTokens(trimmedInput);
  const preciseTime = timeTokens[0]?.value ?? null;
  const dayPartTime = dateTokens.length === 1 ? dayPartTokens[0]?.value ?? null : null;

  if (
    dateTokens.length > 1 ||
    timeTokens.length > 1 ||
    dayPartTokens.length > 1 ||
    dateTokens.some((token) => token.isUncertain)
  ) {
    return {
      title: trimmedInput,
      dueDate: null,
      dueTime: null,
      message:
        "Termín není jednoznačný. Metadata nebyla automaticky použita.",
      hasConflict: true,
    };
  }

  const dueDate = dateTokens[0]?.value ?? null;
  const dueTime = preciseTime ?? dayPartTime;
  const title = cleanTitle(trimmedInput, [
    ...dateTokens,
    ...timeTokens,
    ...dayPartTokens,
  ]);
  const message = getParserMessage(dueDate, dueTime);

  return {
    title: title || trimmedInput,
    dueDate,
    dueTime,
    message,
    hasConflict: false,
  };
}

function findDateTokens(input: string, now: Date) {
  const tokens: ParsedToken[] = [];
  const relativeDatePattern = /\b(dnes|zítra|zitra|pozítří|pozitri|včera|vcera)\b/giu;
  const weekdayPattern =
    /\b(?:v|ve)\s+(pondělí|pondeli|úterý|utery|středu|stredu|čtvrtek|ctvrtek|pátek|patek|sobotu|neděli|nedeli)\b/giu;
  const ambiguousWeekdayPattern =
    /\b(pondělí|pondeli|úterý|utery|středa|streda|středu|stredu|čtvrtek|ctvrtek|pátek|patek|sobota|sobotu|neděle|nedele|neděli|nedeli)\s+nebo\s+(pondělí|pondeli|úterý|utery|středa|streda|středu|stredu|čtvrtek|ctvrtek|pátek|patek|sobota|sobotu|neděle|nedele|neděli|nedeli)\b/giu;
  const unsupportedPastWeekdayPattern =
    /\b(?:minulý|minuly|minulou)\s+(pondělí|pondeli|úterý|utery|středu|stredu|čtvrtek|ctvrtek|pátek|patek|sobotu|neděli|nedeli)\b/giu;
  const absoluteDatePattern =
    /\b(\d{1,2})\s*[./]\s*(\d{1,2})(?:\s*[./]\s*(\d{4}))?\.?/gu;

  for (const match of input.matchAll(ambiguousWeekdayPattern)) {
    const matchedText = match[0];
    const start = match.index ?? 0;

    tokens.push({
      start,
      end: start + matchedText.length,
      value: "ambiguous-weekday",
      isUncertain: true,
    });
  }

  for (const match of input.matchAll(unsupportedPastWeekdayPattern)) {
    const matchedText = match[0];
    const start = match.index ?? 0;

    tokens.push({
      start,
      end: start + matchedText.length,
      value: "unsupported-past-weekday",
      isUncertain: true,
    });
  }

  for (const match of input.matchAll(relativeDatePattern)) {
    const matchedText = match[0];
    const start = match.index ?? 0;

    tokens.push({
      start,
      end: start + matchedText.length,
      value: getRelativeDateValue(matchedText.toLocaleLowerCase("cs-CZ"), now),
    });
  }

  for (const match of input.matchAll(weekdayPattern)) {
    const matchedText = match[0];
    const weekdayName = match[1].toLocaleLowerCase("cs-CZ");
    const weekdayIndex = WEEKDAY_INDEX_BY_NAME[weekdayName];
    const start = match.index ?? 0;

    tokens.push({
      start,
      end: start + matchedText.length,
      value: getNextWeekdayDateValue(now, weekdayIndex),
    });
  }

  for (const match of input.matchAll(absoluteDatePattern)) {
    const matchedText = match[0];
    const start = match.index ?? 0;
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = match[3] ? Number(match[3]) : now.getFullYear();
    const date = new Date(year, month - 1, day);
    const isValidDate =
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day;

    tokens.push({
      start,
      end: start + matchedText.length,
      value: isValidDate ? formatDateValue(date) : "invalid-date",
      isUncertain: !isValidDate,
    });
  }

  return tokens;
}

function findDayPartTokens(input: string) {
  const tokens: ParsedToken[] = [];
  const dayPartPattern =
    /\b(ráno|rano|dopoledne|poledne|odpoledne|večer|vecer|noc)\b/giu;

  for (const match of input.matchAll(dayPartPattern)) {
    const matchedText = match[0];
    const dayPartName = matchedText.toLocaleLowerCase("cs-CZ");
    const start = match.index ?? 0;

    tokens.push({
      start,
      end: start + matchedText.length,
      value: DAY_PART_TIME_BY_NAME[dayPartName],
    });
  }

  return tokens;
}

function findTimeTokens(input: string, dateTokens: ParsedToken[]) {
  const tokens: ParsedToken[] = [];
  const timeWithPrepositionPattern =
    /\bv\s+([01]?\d|2[0-3])(?:([:.])([0-5]\d))?\b/giu;
  const timeWithSeparatorPattern = /\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/gu;

  for (const match of input.matchAll(timeWithPrepositionPattern)) {
    const matchedText = match[0];
    const start = match.index ?? 0;
    const end = start + matchedText.length;
    const hour = match[1].padStart(2, "0");
    const minute = match[3] ?? "00";

    if (
      overlapsAnyToken(start, end, dateTokens) ||
      (!match[3] && /^\s*[./]\s*\d/.test(input.slice(end)))
    ) {
      continue;
    }

    tokens.push({
      start,
      end,
      value: `${hour}:${minute}`,
    });
  }

  for (const match of input.matchAll(timeWithSeparatorPattern)) {
    const matchedText = match[0];
    const start = match.index ?? 0;
    const end = start + matchedText.length;
    const hour = match[1].padStart(2, "0");
    const minute = match[2];

    if (overlapsAnyToken(start, end, dateTokens)) {
      continue;
    }

    tokens.push({
      start,
      end,
      value: `${hour}:${minute}`,
    });
  }

  return tokens;
}

function overlapsAnyToken(start: number, end: number, tokens: ParsedToken[]) {
  return tokens.some((token) => start < token.end && end > token.start);
}

function getRelativeDateValue(value: string, now: Date) {
  if (value === "zítra" || value === "zitra") {
    return formatDateValue(addDays(now, 1));
  }

  if (value === "pozítří" || value === "pozitri") {
    return formatDateValue(addDays(now, 2));
  }

  if (value === "včera" || value === "vcera") {
    return formatDateValue(addDays(now, -1));
  }

  return formatDateValue(now);
}

function getNextWeekdayDateValue(now: Date, targetWeekday: number) {
  const currentWeekday = now.getDay();
  const daysUntilTarget = (targetWeekday - currentWeekday + 7) % 7;

  return formatDateValue(addDays(now, daysUntilTarget));
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);

  return nextDate;
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function cleanTitle(input: string, tokens: ParsedToken[]) {
  const sortedTokens = [...tokens].sort((left, right) => right.start - left.start);
  let title = input;

  for (const token of sortedTokens) {
    title = `${title.slice(0, token.start)} ${title.slice(token.end)}`;
  }

  return title
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .replace(/[,\s]+$/g, "")
    .trim();
}

function getParserMessage(dueDate: string | null, dueTime: string | null) {
  if (dueDate && dueTime) {
    return `Doplněn termín: ${dueDate}, čas: ${dueTime}`;
  }

  if (dueDate) {
    return `Doplněn termín: ${dueDate}`;
  }

  if (dueTime) {
    return `Rozpoznán čas: ${dueTime}`;
  }

  return null;
}
