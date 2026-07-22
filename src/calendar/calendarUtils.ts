export const CZECH_MONTH_NAMES = [
  "leden",
  "únor",
  "březen",
  "duben",
  "květen",
  "červen",
  "červenec",
  "srpen",
  "září",
  "říjen",
  "listopad",
  "prosinec",
];

export const CZECH_WEEKDAY_LABELS = ["Po", "Út", "St", "Čt", "Pá", "So", "Ne"];

export type CalendarDay = {
  date: string;
  dayOfMonth: number;
};

export function getCurrentYearMonth(): { year: number; month: number } {
  const now = new Date();

  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getMonthMatrix(year: number, month: number): CalendarDay[][] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
  const firstWeekdayMondayIndex = (firstOfMonth.getDay() + 6) % 7;

  const cells: CalendarDay[] = [];

  for (let i = firstWeekdayMondayIndex; i > 0; i -= 1) {
    const dayOfMonth = daysInPrevMonth - i + 1;
    cells.push({ date: formatDate(new Date(year, month - 2, dayOfMonth)), dayOfMonth });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: formatDate(new Date(year, month - 1, day)), dayOfMonth: day });
  }

  let nextMonthDay = 1;

  while (cells.length % 7 !== 0) {
    cells.push({ date: formatDate(new Date(year, month, nextMonthDay)), dayOfMonth: nextMonthDay });
    nextMonthDay += 1;
  }

  const weeks: CalendarDay[][] = [];

  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return weeks;
}

export function groupTaskIdsByDueDate(
  tasks: { id: string; dueDate: string | null }[],
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const task of tasks) {
    if (!task.dueDate) {
      continue;
    }

    const existing = map.get(task.dueDate);

    if (existing) {
      existing.push(task.id);
    } else {
      map.set(task.dueDate, [task.id]);
    }
  }

  return map;
}
