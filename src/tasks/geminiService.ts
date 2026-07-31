import type { TaskPriority } from "./taskTypes";

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const VALID_PRIORITIES: TaskPriority[] = ["none", "low", "medium", "high"];

export type QuickCaptureParsed = {
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: TaskPriority;
  assigneeName: string | null;
};

export function isGeminiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_GEMINI_API_KEY);
}

export async function parseVoiceInputWithGemini(text: string, now: Date): Promise<QuickCaptureParsed> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt(text, now) }] }],
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini request failed with status ${response.status}`);
  }

  const data: unknown = await response.json();
  const rawText = extractResponseText(data);

  if (!rawText) {
    throw new Error("Gemini response did not contain any text");
  }

  return validateParsedResult(JSON.parse(rawText));
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

  const candidates = (data as { candidates?: unknown }).candidates;

  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const content = (candidates[0] as { content?: unknown }).content;
  const parts = content && typeof content === "object" ? (content as { parts?: unknown }).parts : undefined;

  if (!Array.isArray(parts) || parts.length === 0) {
    return null;
  }

  const text = (parts[0] as { text?: unknown }).text;

  return typeof text === "string" ? text : null;
}

function validateParsedResult(value: unknown): QuickCaptureParsed {
  if (typeof value !== "object" || value === null) {
    throw new Error("Gemini response is not an object");
  }

  const record = value as Record<string, unknown>;
  const title = typeof record.title === "string" ? record.title.trim() : "";

  if (!title) {
    throw new Error("Gemini response is missing a title");
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
