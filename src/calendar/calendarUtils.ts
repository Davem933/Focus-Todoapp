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

export function getMonthMatrix(year: number, month: number): (CalendarDay | null)[][] {
  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstWeekdayMondayIndex = (firstOfMonth.getDay() + 6) % 7;

  const cells: (CalendarDay | null)[] = [];

  for (let i = 0; i < firstWeekdayMondayIndex; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const monthStr = String(month).padStart(2, "0");
    const dayStr = String(day).padStart(2, "0");
    cells.push({ date: `${year}-${monthStr}-${dayStr}`, dayOfMonth: day });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  const weeks: (CalendarDay | null)[][] = [];

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
