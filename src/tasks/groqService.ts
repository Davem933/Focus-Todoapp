import type { TaskPriority } from "./taskTypes";

const GROQ_MODEL = "llama-3.1-8b-instant";
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const VALID_PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high"];

export type QuickCaptureParsed = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: TaskPriority;
  assigneeName: string | null;
};

export function isGroqConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GROQ_API_KEY);
}

export async function parseVoiceInputWithGroq(text: string, now: Date): Promise<QuickCaptureParsed> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Groq API key is not configured");
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: buildPrompt(text, now) }],
      response_format: { type: "json_object" },
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  const rawText = extractResponseText(data);

  if (!rawText) {
    throw new Error("Groq response did not contain any text");
  }

  return validateParsedResult(JSON.parse(rawText));
}

export async function generateSubtasksWithGroq(title: string, note: string): Promise<string[]> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Groq API key is not configured");
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: buildSubtasksPrompt(title, note) }],
      response_format: { type: "json_object" },
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  const rawText = extractResponseText(data);

  if (!rawText) {
    throw new Error("Groq response did not contain any text");
  }

  return validateSubtasksResult(JSON.parse(rawText));
}

function buildSubtasksPrompt(title: string, note: string): string {
  const trimmedNote = note.trim();
  const description = trimmedNote
    ? `Nazev ukolu: "${title}"\nPopis ukolu: "${trimmedNote}"`
    : `Nazev ukolu: "${title}"`;

  return `Jsi zkuseny projektovy manazer. Tvym ukolem je rozlozit zadany ukol na 3 az 5 konkretnich, praktickych a jasnych kroku (podukolu), ktere povedou k jeho splneni.

${description}

Vrat POUZE JSON (bez markdown, bez vysvetleni) v presne tomto tvaru:
{
  "subtasks": ["Krok 1...", "Krok 2...", "Krok 3..."]
}

Pravidla:
- Odpoved MUSI byt v cestine.
- Vygeneruj 3 az 5 kroku, ne vic, ne min.
- Kazdy krok je kratka, konkretni a proveditelna akce (ne obecna fraze).
- Nevracej cislovani ani odrazky uvnitr textu kroku, jen samotny text.`;
}

function validateSubtasksResult(value: unknown): string[] {
  if (typeof value !== "object" || value === null) {
    throw new Error("Groq response is not an object");
  }

  const subtasksRaw = (value as { subtasks?: unknown }).subtasks;

  if (!Array.isArray(subtasksRaw)) {
    throw new Error("Groq response is missing a subtasks array");
  }

  const subtasks = subtasksRaw
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .slice(0, 5);

  if (subtasks.length === 0) {
    throw new Error("Groq response did not contain any usable subtasks");
  }

  return subtasks;
}

function buildPrompt(text: string, now: Date): string {
  const localDate = formatLocalDate(now);
  const localTime = formatLocalTime(now);

  return `Jsi asistent, ktery z hlasoveho/textoveho zadani v cestine vytvari strukturovany ukol.
Aktualni datum a cas: ${localDate} ${localTime}.
Text od uzivatele: "${text}"

Vrat POUZE JSON (bez markdown, bez vysvetleni) v presne tomto tvaru:
{
  "title": string (kratky nazev ukolu, bez zminek o datu/case/priorite),
  "dueDate": string ve tvaru YYYY-MM-DD nebo null,
  "dueTime": string ve tvaru HH:mm (24h) nebo null,
  "priority": jedna z hodnot "none" | "low" | "medium" | "high",
  "assigneeName": string se jmenem resitele v 1. padu (napr. "Petr" misto "Petrovi") pokud bylo zmineno, jinak null
}

Pravidla:
- "zitra" = ${localDate} + 1 den, "pozitri" = +2 dny, pocitej vzhledem k datu vyse.
- Pokud cas ani datum nejsou zmineny, pouzij null pro dane pole.
- "urgentni"/"nalehave"/"asap"/"dulezite"/"vysoka priorita" -> "high". "nizka priorita"/"neni spech" -> "low". Jinak "none".
- Jmeno resitele preved do 1. padu (nominativu), pokud je v textu sklonovane.`;
}

function extractResponseText(data: unknown): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const choices = (data as { choices?: unknown }).choices;

  if (!Array.isArray(choices) || choices.length === 0) {
    return null;
  }

  const message = (choices[0] as { message?: unknown }).message;
  const content = message && typeof message === "object" ? (message as { content?: unknown }).content : undefined;

  return typeof content === "string" ? content : null;
}

function validateParsedResult(value: unknown): QuickCaptureParsed {
  if (typeof value !== "object" || value === null) {
    throw new Error("Groq response is not an object");
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";

  if (!title) {
    throw new Error("Groq response is missing a title");
  }

  return {
    title,
    dueDate: isValidDateString(record.dueDate) ? record.dueDate : null,
    dueTime: isValidTimeString(record.dueTime) ? record.dueTime : null,
    priority: isValidPriority(record.priority) ? record.priority : "none",
    assigneeName:
      typeof record.assigneeName === "string" && record.assigneeName.trim()
        ? record.assigneeName.trim()
        : null,
  };
}

function isValidDateString(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeString(value: unknown): value is string {
  return typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidPriority(value: unknown): value is TaskPriority {
  return typeof value === "string" && (VALID_PRIORITIES as string[]).includes(value);
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLocalTime(date: Date): string {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
}

export type DailyBriefingTaskInput = {
  title: string;
  priority: TaskPriority;
  dueLabel: string;
};

export type DailyBriefing = {
  pozdravAUvod: string;
  hlavniBodDne: string;
  doporucenePoradi: string[];
  povzbuzeni: string;
};

export async function generateDailyBriefingWithGroq(
  tasks: DailyBriefingTaskInput[],
): Promise<DailyBriefing> {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Groq API key is not configured");
  }

  const response = await fetch(GROQ_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: buildDailyBriefingPrompt(tasks) }],
      response_format: { type: "json_object" },
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  const rawText = extractResponseText(data);

  if (!rawText) {
    throw new Error("Groq response did not contain any text");
  }

  return validateDailyBriefingResult(JSON.parse(rawText));
}

function buildDailyBriefingPrompt(tasks: DailyBriefingTaskInput[]): string {
  const taskLines =
    tasks.length > 0
      ? tasks
          .map((task) => `- "${task.title}" (priorita: ${task.priority}, stav: ${task.dueLabel})`)
          .join("\n")
      : "(zadny nalehavy ukol)";

  return `Jsi pozitivni a profesionalni osobni asistent. Na zaklade seznamu ukolu nize vygeneruj kratky ranni briefing v cestine.

Seznam ukolu (celkem ${tasks.length}):
${taskLines}

Zohledni pocet ukolu a to, co nejvice hori (vysoka priorita a/nebo skluz po terminu).

Vrat POUZE JSON (bez markdown, bez vysvetleni) v presne tomto tvaru (priklad je jen ukazka struktury, text vygeneruj vlastni podle zadanych ukolu):
{
  "pozdrav_a_uvod": "string, napr.: Dobré ráno! Dnes tě čeká pět úkolů.",
  "hlavni_bod_dne": "string, jedna veta zduraznujici co je dnes nejdulezitejsi nebo co nejvice hori",
  "doporucene_poradi": ["1. ...", "2. ..."],
  "povzbuzeni": "string, kratka motivacni veta na zaver"
}

Pravidla:
- Cely text MUSI byt spravnou cestinou VCETNE diakritiky (á, č, ď, é, ě, í, ň, ó, ř, š, ť, ú, ů, ý, ž) - nepis text bez diakritiky.
- Priklad v uvozovkach vyse je jen ukazka formatu, jeho zneni doslovne neopisuj.
- "doporucene_poradi" obsahuje 2 az 5 kroku, serazene podle priority/nalehavosti.
- Ton je pozitivni, strucny a vecny, zadne zbytecne fraze.`;
}

function validateDailyBriefingResult(value: unknown): DailyBriefing {
  if (typeof value !== "object" || value === null) {
    throw new Error("Groq response is not an object");
  }

  const record = value as Record<string, unknown>;
  const pozdravAUvod = typeof record.pozdrav_a_uvod === "string" ? record.pozdrav_a_uvod.trim() : "";

  if (!pozdravAUvod) {
    throw new Error("Groq response is missing pozdrav_a_uvod");
  }

  const doporucenePoradiRaw = record.doporucene_poradi;
  const doporucenePoradi = Array.isArray(doporucenePoradiRaw)
    ? doporucenePoradiRaw
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0)
        .slice(0, 5)
    : [];

  return {
    pozdravAUvod,
    hlavniBodDne: typeof record.hlavni_bod_dne === "string" ? record.hlavni_bod_dne.trim() : "",
    doporucenePoradi,
    povzbuzeni: typeof record.povzbuzeni === "string" ? record.povzbuzeni.trim() : "",
  };
}
