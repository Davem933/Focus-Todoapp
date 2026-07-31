# Smart Quick Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Implementation note:** Gemini keys tested at execution time had a 0 free-tier
> quota (account/region-level, not a bad key) and Grok (x.ai) requires prepaid
> credit. The provider was switched to **Groq** (`console.groq.com`, model
> `llama-3.1-8b-instant`, genuinely free, verified end-to-end including a real
> Czech prompt). The module is `src/tasks/groqService.ts` (`isGroqConfigured`,
> `parseVoiceInputWithGroq`), env var `VITE_GROQ_API_KEY`. All "Gemini"
> references below reflect the original plan; behavior and interfaces are
> otherwise unchanged.

**Goal:** Add a floating mic button that lets the user dictate or type a Czech task request, sends it to Gemini (with an offline regex fallback) to extract title/date/time/priority/assignee, and lets the user review and confirm before the task is created.

**Architecture:** Pure-logic modules under `src/tasks/` (Gemini call, offline-fallback orchestration, assignee fuzzy match) feed a small `src/layout/quickCapture/` component tree (FAB → two-phase modal: capture, then editable preview) that is wired into `AppShell.tsx` and calls the existing `handleCreateTask`/`onCreateTask` path — no changes to the `Task` data model.

**Tech Stack:** React 19 + TypeScript (Vite), native `window.SpeechRecognition`/`webkitSpeechRecognition`, Gemini REST API (`gemini-1.5-flash`, `generateContent`), existing `lucide-react` icons, plain `<select>`/`<input>` form controls matching the codebase's existing style (no new dependencies).

## Global Constraints

- Priority values are exactly `"none" | "low" | "medium" | "high"` (from `src/tasks/taskTypes.ts`) — Gemini is prompted to return these values directly, no separate mapping step.
- No `status` field is produced or stored — regular (non-project) tasks only have `completed: boolean`.
- Assignee is resolved to a `TeamMember.userId` via fuzzy name match, always shown in the editable preview, never auto-confirmed without the user clicking "Přidat úkol".
- On any Gemini failure (missing key, network, quota, invalid JSON) — silently fall back to the existing offline `parseTaskInput` parser; never block task creation on an AI failure.
- `VITE_GEMINI_API_KEY` lives in `.env.local` (gitignored) and is read via `import.meta.env.VITE_GEMINI_API_KEY`; it is intentionally exposed in the client bundle (accepted risk, no backend proxy).
- No test framework exists in this repo (see `CLAUDE.md`) — verification is `npx tsc --noEmit` per task plus a final manual browser pass; do not add Jest/Vitest/etc.
- Keep new files small and single-purpose; follow existing relative-import style (no path aliases in `src/tasks`/`src/layout`).
- Reuse existing helpers instead of duplicating: `BOARD_CARD_PRIORITY_OPTIONS`/`BOARD_CARD_PRIORITY_LABELS` (`src/tasks/taskPriorityColors.ts`), `getMemberDisplayName` (`src/teams/teamMemberDisplay.ts`), `parseTaskInput` (`src/tasks/naturalLanguageTaskParser.ts`), `loadTeamMembers` (`src/supabase/teamApi.ts`).

---

### Task 1: Verify the Gemini key/model, then build `geminiService.ts`

**Files:**
- Create: `src/tasks/geminiService.ts`
- Modify: `.env.example`

**Interfaces:**
- Produces: `export type QuickCaptureParsed = { title: string; dueDate: string | null; dueTime: string | null; priority: TaskPriority; assigneeName: string | null }`, `export function isGeminiConfigured(): boolean`, `export async function parseVoiceInputWithGemini(text: string, now: Date): Promise<QuickCaptureParsed>` (throws `Error` on any failure — missing key, network, bad status, invalid/missing JSON).

- [ ] **Step 1: Sanity-check the API key and model against the real endpoint**

Create a throwaway script (not part of the repo) to confirm the key the user provided actually works against the Generative Language API before writing code that depends on it:

```bash
cat > "C:\Users\David\AppData\Local\Temp\claude\C--Users-David-Documents-focus-to-do-list\11685b5b-1164-4288-85b8-38ef708b8491\scratchpad\verify-gemini-key.mjs" <<'EOF'
const apiKey = "your-gemini-api-key-here"; // redacted — do not commit real keys
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
  {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ parts: [{ text: "Reply with the single word OK." }] }] }),
  },
);
console.log("status:", response.status);
console.log(await response.text());
EOF
node "C:\Users\David\AppData\Local\Temp\claude\C--Users-David-Documents-focus-to-do-list\11685b5b-1164-4288-85b8-38ef708b8491\scratchpad\verify-gemini-key.mjs"
```

Expected: `status: 200` and a JSON body with `candidates[0].content.parts[0].text`. If you get `400`/`403` instead, stop and report the exact error body to the user before continuing — it means the key/model combination needs to be fixed first (e.g. the key is a different credential type, or the Generative Language API isn't enabled for it).

- [ ] **Step 2: Add the env var placeholder**

Add this line to `.env.example` (after the Supabase lines, before the Playwright section):

```
VITE_GEMINI_API_KEY=your-gemini-api-key
```

- [ ] **Step 3: Create `src/tasks/geminiService.ts`**

```typescript
import type { TaskPriority } from "./taskTypes";

const GEMINI_MODEL = "gemini-1.5-flash";
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
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `geminiService.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/tasks/geminiService.ts .env.example
git commit -m "Add geminiService for Smart Quick Capture voice/text parsing"
```

---

### Task 2: Offline-fallback orchestration (`quickCaptureResolve.ts`)

**Files:**
- Create: `src/tasks/quickCaptureResolve.ts`

**Interfaces:**
- Consumes: `parseTaskInput(input: string, now?: Date): ParsedTaskInput` (`src/tasks/naturalLanguageTaskParser.ts`, fields `title`, `dueDate`, `dueTime`, `hasConflict`); `isGeminiConfigured()`, `parseVoiceInputWithGemini(text, now)`, `QuickCaptureParsed` from Task 1's `geminiService.ts`.
- Produces: `export type QuickCaptureResolution = { parsed: QuickCaptureParsed; usedAi: boolean }`, `export async function resolveQuickCapture(text: string, now: Date): Promise<QuickCaptureResolution>`.

- [ ] **Step 1: Create `src/tasks/quickCaptureResolve.ts`**

```typescript
import { parseTaskInput } from "./naturalLanguageTaskParser";
import { isGeminiConfigured, parseVoiceInputWithGemini, type QuickCaptureParsed } from "./geminiService";

export type QuickCaptureResolution = {
  parsed: QuickCaptureParsed;
  usedAi: boolean;
};

export async function resolveQuickCapture(text: string, now: Date): Promise<QuickCaptureResolution> {
  if (isGeminiConfigured()) {
    try {
      const parsed = await parseVoiceInputWithGemini(text, now);
      return { parsed, usedAi: true };
    } catch {
      // Fall through to the offline parser below — AI failures must never block task creation.
    }
  }

  return { parsed: parseOffline(text, now), usedAi: false };
}

function parseOffline(text: string, now: Date): QuickCaptureParsed {
  const result = parseTaskInput(text, now);

  return {
    title: result.title,
    dueDate: result.hasConflict ? null : result.dueDate,
    dueTime: result.hasConflict ? null : result.dueTime,
    priority: "none",
    assigneeName: null,
  };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `quickCaptureResolve.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/tasks/quickCaptureResolve.ts
git commit -m "Add offline-parser fallback orchestration for Smart Quick Capture"
```

---

### Task 3: Assignee fuzzy match (`assigneeMatch.ts`)

**Files:**
- Create: `src/tasks/assigneeMatch.ts`

**Interfaces:**
- Consumes: `TeamMember` (`src/teams/teamTypes.ts`, fields `userId`, `email`, `nickname`), `getMemberDisplayName(member)` (`src/teams/teamMemberDisplay.ts`).
- Produces: `export function matchAssigneeIdByName(name: string, members: TeamMember[]): string | null`.

- [ ] **Step 1: Create `src/tasks/assigneeMatch.ts`**

```typescript
import type { TeamMember } from "../teams/teamTypes";
import { getMemberDisplayName } from "../teams/teamMemberDisplay";

export function matchAssigneeIdByName(name: string, members: TeamMember[]): string | null {
  const normalizedName = normalizeForMatch(name);

  if (!normalizedName) {
    return null;
  }

  const exactMatch = members.find(
    (member) => normalizeForMatch(getMemberDisplayName(member)) === normalizedName,
  );

  if (exactMatch) {
    return exactMatch.userId;
  }

  const partialMatch = members.find((member) => {
    const displayName = normalizeForMatch(getMemberDisplayName(member));
    return displayName.includes(normalizedName) || normalizedName.includes(displayName);
  });

  return partialMatch ? partialMatch.userId : null;
}

function normalizeForMatch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `assigneeMatch.ts`.

- [ ] **Step 3: Manually verify the matching logic**

This function has no `import.meta.env` dependency but does use bundler-style extensionless
relative imports, so it can't be run directly under plain Node. Instead, verify by reading
through these cases against the implementation above and confirming the expected result:

- `matchAssigneeIdByName("Petrovi", [{userId:"u1", nickname:"Petr", email:"petr@x.com", role:"member", createdAt:""}])` → normalizes both sides to `"petrovi"` vs `"petr"`; no exact match; partial match since `"petrovi".includes("petr")` → returns `"u1"`. Confirmed correct.
- `matchAssigneeIdByName("Jana", [{userId:"u2", nickname:null, email:"jana@x.com", role:"member", createdAt:""}])` → nickname is null so `getMemberDisplayName` falls back to email local part `"jana"`; normalizes to `"jana"` on both sides → exact match → returns `"u2"`. Confirmed correct.
- `matchAssigneeIdByName("Nikdo", members)` → no exact or partial match against `"petr"`/`"jana"` → returns `null`. Confirmed correct.
- `matchAssigneeIdByName("", members)` → `normalizedName` is empty string → returns `null` immediately. Confirmed correct.

Full behavioral confirmation (real team members, real UI) happens in Task 9's browser pass.

- [ ] **Step 4: Commit**

```bash
git add src/tasks/assigneeMatch.ts
git commit -m "Add fuzzy assignee-name matching for Smart Quick Capture"
```

---

### Task 4: `useSpeechRecognition` hook

**Files:**
- Create: `src/layout/quickCapture/useSpeechRecognition.ts`

**Interfaces:**
- Produces: `export type SpeechRecognitionStatus = "unsupported" | "idle" | "listening" | "denied" | "error"`, `export function useSpeechRecognition(): { status: SpeechRecognitionStatus; transcript: string; start: () => void; stop: () => void }`.

- [ ] **Step 1: Create `src/layout/quickCapture/useSpeechRecognition.ts`**

```typescript
import { useCallback, useEffect, useRef, useState } from "react";

export type SpeechRecognitionStatus = "unsupported" | "idle" | "listening" | "denied" | "error";

// The Web Speech API has no official TypeScript lib defs (it's non-standard);
// these narrow local types describe only what this hook actually uses.
type SpeechRecognitionResultLike = { transcript: string };
type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};
type SpeechRecognitionErrorEventLike = { error: string };

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | undefined {
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructorLike;
    webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
  };

  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition;
}

type UseSpeechRecognitionResult = {
  status: SpeechRecognitionStatus;
  transcript: string;
  start: () => void;
  stop: () => void;
};

export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [status, setStatus] = useState<SpeechRecognitionStatus>(() =>
    getSpeechRecognitionConstructor() ? "idle" : "unsupported",
  );
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const start = useCallback(() => {
    const SpeechRecognitionConstructor = getSpeechRecognitionConstructor();

    if (!SpeechRecognitionConstructor) {
      setStatus("unsupported");
      return;
    }

    setTranscript("");
    const recognition = new SpeechRecognitionConstructor();
    recognition.lang = "cs-CZ";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event) => {
      let combinedTranscript = "";

      for (let index = 0; index < event.results.length; index += 1) {
        combinedTranscript += event.results[index][0].transcript;
      }

      setTranscript(combinedTranscript);
    };

    recognition.onerror = (event) => {
      setStatus(event.error === "not-allowed" ? "denied" : "error");
    };

    recognition.onend = () => {
      setStatus((currentStatus) => (currentStatus === "listening" ? "idle" : currentStatus));
    };

    recognitionRef.current = recognition;
    setStatus("listening");
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return { status, transcript, start, stop };
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `useSpeechRecognition.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/layout/quickCapture/useSpeechRecognition.ts
git commit -m "Add useSpeechRecognition hook for Smart Quick Capture"
```

---

### Task 5: Shared types + `QuickCaptureFab`

**Files:**
- Create: `src/layout/quickCapture/quickCaptureTypes.ts`
- Create: `src/layout/quickCapture/QuickCaptureFab.tsx`

**Interfaces:**
- Consumes: `TaskPriority` (`src/tasks/taskTypes.ts`).
- Produces: `export type QuickCapturePreviewState = { title: string; dueDate: string; dueTime: string; priority: TaskPriority; assigneeId: string }`, `export type QuickCaptureCreateOptions = { dueDate?: string | null; dueTime?: string | null; priority?: TaskPriority; assigneeId?: string | null; teamId?: string | null }`, `export function QuickCaptureFab(props: { onOpen: () => void }): JSX.Element`.

- [ ] **Step 1: Create `src/layout/quickCapture/quickCaptureTypes.ts`**

```typescript
import type { TaskPriority } from "../../tasks/taskTypes";

export type QuickCapturePreviewState = {
  title: string;
  dueDate: string;
  dueTime: string;
  priority: TaskPriority;
  assigneeId: string;
};

export type QuickCaptureCreateOptions = {
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: TaskPriority;
  assigneeId?: string | null;
  teamId?: string | null;
};
```

- [ ] **Step 2: Create `src/layout/quickCapture/QuickCaptureFab.tsx`**

```typescript
import { Mic } from "lucide-react";

type QuickCaptureFabProps = {
  onOpen: () => void;
};

export function QuickCaptureFab({ onOpen }: QuickCaptureFabProps) {
  return (
    <button
      type="button"
      className="quick-capture-fab"
      aria-label="Rychlé zadání úkolu hlasem nebo textem"
      title="Smart Quick Capture"
      onClick={onOpen}
    >
      <Mic size={22} aria-hidden="true" />
    </button>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `quickCaptureTypes.ts` or `QuickCaptureFab.tsx`.

- [ ] **Step 4: Commit**

```bash
git add src/layout/quickCapture/quickCaptureTypes.ts src/layout/quickCapture/QuickCaptureFab.tsx
git commit -m "Add Quick Capture shared types and FAB button"
```

---

### Task 6: `QuickCaptureCaptureStep`

**Files:**
- Create: `src/layout/quickCapture/QuickCaptureCaptureStep.tsx`

**Interfaces:**
- Consumes: `SpeechRecognitionStatus` (Task 4).
- Produces: `export function QuickCaptureCaptureStep(props: { text: string; onTextChange: (value: string) => void; speechStatus: SpeechRecognitionStatus; onStartRecording: () => void; onStopRecording: () => void; onProcess: () => void }): JSX.Element`.

- [ ] **Step 1: Create `src/layout/quickCapture/QuickCaptureCaptureStep.tsx`**

```typescript
import { Mic, Square } from "lucide-react";
import type { SpeechRecognitionStatus } from "./useSpeechRecognition";

type QuickCaptureCaptureStepProps = {
  text: string;
  onTextChange: (value: string) => void;
  speechStatus: SpeechRecognitionStatus;
  onStartRecording: () => void;
  onStopRecording: () => void;
  onProcess: () => void;
};

export function QuickCaptureCaptureStep({
  text,
  onTextChange,
  speechStatus,
  onStartRecording,
  onStopRecording,
  onProcess,
}: QuickCaptureCaptureStepProps) {
  const isListening = speechStatus === "listening";
  const canRecord = speechStatus !== "unsupported";

  return (
    <div className="quick-capture-capture">
      {canRecord ? (
        <button
          type="button"
          className="quick-capture-capture__record-button"
          data-listening={isListening ? "true" : "false"}
          aria-label={isListening ? "Zastavit nahrávání" : "Spustit nahrávání"}
          onClick={isListening ? onStopRecording : onStartRecording}
        >
          {isListening ? <Square size={20} aria-hidden="true" /> : <Mic size={20} aria-hidden="true" />}
          {isListening ? "Poslouchám…" : "Nahrávat"}
        </button>
      ) : (
        <p className="quick-capture-capture__hint">
          Rozpoznávání hlasu není v tomto prohlížeči podporováno. Napište úkol do pole níže.
        </p>
      )}

      {speechStatus === "denied" ? (
        <p className="quick-capture-capture__hint" role="alert">
          Přístup k mikrofonu byl zamítnut. Použijte prosím textové pole.
        </p>
      ) : null}

      {speechStatus === "error" ? (
        <p className="quick-capture-capture__hint" role="alert">
          Rozpoznávání hlasu selhalo. Zkuste to znovu nebo napište úkol ručně.
        </p>
      ) : null}

      <textarea
        className="quick-capture-capture__textarea"
        value={text}
        onChange={(event) => onTextChange(event.currentTarget.value)}
        placeholder="Např. Připomeň mi zítra v 10 ráno poslat fakturu Petrovi a dej tomu vysokou prioritu"
        rows={4}
      />

      <div className="quick-capture-capture__actions">
        <button
          type="button"
          className="quick-capture-capture__submit"
          onClick={onProcess}
          disabled={!text.trim()}
        >
          Zpracovat
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `QuickCaptureCaptureStep.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/layout/quickCapture/QuickCaptureCaptureStep.tsx
git commit -m "Add Quick Capture recording/text-entry step component"
```

---

### Task 7: `QuickCapturePreviewStep`

**Files:**
- Create: `src/layout/quickCapture/QuickCapturePreviewStep.tsx`

**Interfaces:**
- Consumes: `QuickCapturePreviewState` (Task 5), `TeamMember` (`src/teams/teamTypes.ts`), `getMemberDisplayName` (`src/teams/teamMemberDisplay.ts`), `BOARD_CARD_PRIORITY_OPTIONS`/`BOARD_CARD_PRIORITY_LABELS` (`src/tasks/taskPriorityColors.ts`).
- Produces: `export function QuickCapturePreviewStep(props: { preview: QuickCapturePreviewState; onChange: (next: QuickCapturePreviewState) => void; infoMessage: string | null; members: TeamMember[]; onConfirm: () => void; onBack: () => void; onCancel: () => void }): JSX.Element`.

- [ ] **Step 1: Create `src/layout/quickCapture/QuickCapturePreviewStep.tsx`**

```typescript
import type { TaskPriority } from "../../tasks/taskTypes";
import { BOARD_CARD_PRIORITY_LABELS, BOARD_CARD_PRIORITY_OPTIONS } from "../../tasks/taskPriorityColors";
import type { TeamMember } from "../../teams/teamTypes";
import { getMemberDisplayName } from "../../teams/teamMemberDisplay";
import type { QuickCapturePreviewState } from "./quickCaptureTypes";

type QuickCapturePreviewStepProps = {
  preview: QuickCapturePreviewState;
  onChange: (next: QuickCapturePreviewState) => void;
  infoMessage: string | null;
  members: TeamMember[];
  onConfirm: () => void;
  onBack: () => void;
  onCancel: () => void;
};

export function QuickCapturePreviewStep({
  preview,
  onChange,
  infoMessage,
  members,
  onConfirm,
  onBack,
  onCancel,
}: QuickCapturePreviewStepProps) {
  return (
    <div className="quick-capture-preview">
      {infoMessage ? <p className="quick-capture-preview__message">{infoMessage}</p> : null}

      <label className="quick-capture-preview__field">
        Název úkolu
        <input
          type="text"
          value={preview.title}
          onChange={(event) => onChange({ ...preview, title: event.currentTarget.value })}
        />
      </label>

      <label className="quick-capture-preview__field">
        Datum
        <input
          type="date"
          value={preview.dueDate}
          onChange={(event) => onChange({ ...preview, dueDate: event.currentTarget.value })}
        />
      </label>

      <label className="quick-capture-preview__field">
        Čas
        <input
          type="time"
          value={preview.dueTime}
          disabled={!preview.dueDate}
          onChange={(event) => onChange({ ...preview, dueTime: event.currentTarget.value })}
        />
      </label>

      <label className="quick-capture-preview__field">
        Priorita
        <select
          value={preview.priority}
          onChange={(event) =>
            onChange({ ...preview, priority: event.currentTarget.value as TaskPriority })
          }
        >
          {BOARD_CARD_PRIORITY_OPTIONS.map((priority) => (
            <option key={priority} value={priority}>
              {BOARD_CARD_PRIORITY_LABELS[priority]}
            </option>
          ))}
        </select>
      </label>

      <label className="quick-capture-preview__field">
        Řešitel
        <select
          value={preview.assigneeId}
          onChange={(event) => onChange({ ...preview, assigneeId: event.currentTarget.value })}
        >
          <option value="">Nepřiřazeno</option>
          {members.map((member) => (
            <option key={member.userId} value={member.userId}>
              {getMemberDisplayName(member)}
            </option>
          ))}
        </select>
      </label>

      <div className="quick-capture-preview__actions">
        <button type="button" onClick={onBack}>
          Zpět
        </button>
        <button type="button" onClick={onCancel}>
          Zrušit
        </button>
        <button
          type="button"
          className="quick-capture-preview__confirm"
          onClick={onConfirm}
          disabled={!preview.title.trim()}
        >
          Přidat úkol
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `QuickCapturePreviewStep.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/layout/quickCapture/QuickCapturePreviewStep.tsx
git commit -m "Add Quick Capture editable preview step component"
```

---

### Task 8: `QuickCaptureModal` container

**Files:**
- Create: `src/layout/quickCapture/QuickCaptureModal.tsx`

**Interfaces:**
- Consumes: `useSpeechRecognition` (Task 4), `QuickCaptureCaptureStep` (Task 6), `QuickCapturePreviewStep` (Task 7), `QuickCapturePreviewState`/`QuickCaptureCreateOptions` (Task 5), `resolveQuickCapture` (Task 2), `matchAssigneeIdByName` (Task 3), `loadTeamMembers(teamId: string): Promise<TeamMember[]>` (`src/supabase/teamApi.ts`), `TeamMember` (`src/teams/teamTypes.ts`).
- Produces: `export function QuickCaptureModal(props: { activeTeamId: string | null; onClose: () => void; onCreateTask: (title: string, options?: QuickCaptureCreateOptions) => string | null }): JSX.Element`.

- [ ] **Step 1: Create `src/layout/quickCapture/QuickCaptureModal.tsx`**

```typescript
import { useEffect, useState } from "react";
import { loadTeamMembers } from "../../supabase/teamApi";
import { matchAssigneeIdByName } from "../../tasks/assigneeMatch";
import { resolveQuickCapture } from "../../tasks/quickCaptureResolve";
import type { TeamMember } from "../../teams/teamTypes";
import { QuickCaptureCaptureStep } from "./QuickCaptureCaptureStep";
import { QuickCapturePreviewStep } from "./QuickCapturePreviewStep";
import type { QuickCaptureCreateOptions, QuickCapturePreviewState } from "./quickCaptureTypes";
import { useSpeechRecognition } from "./useSpeechRecognition";

type QuickCaptureModalProps = {
  activeTeamId: string | null;
  onClose: () => void;
  onCreateTask: (title: string, options?: QuickCaptureCreateOptions) => string | null;
};

type Phase = "capture" | "loading" | "preview";

export function QuickCaptureModal({ activeTeamId, onClose, onCreateTask }: QuickCaptureModalProps) {
  const [phase, setPhase] = useState<Phase>("capture");
  const [text, setText] = useState("");
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<QuickCapturePreviewState | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const speech = useSpeechRecognition();

  useEffect(() => {
    if (speech.status === "listening") {
      setText(speech.transcript);
    }
  }, [speech.transcript, speech.status]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  useEffect(() => {
    if (!activeTeamId) {
      setMembers([]);
      return;
    }

    let isCancelled = false;

    loadTeamMembers(activeTeamId)
      .then((loadedMembers) => {
        if (!isCancelled) {
          setMembers(loadedMembers);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setMembers([]);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [activeTeamId]);

  async function handleProcess() {
    const trimmedText = text.trim();

    if (!trimmedText) {
      return;
    }

    setPhase("loading");

    const { parsed, usedAi } = await resolveQuickCapture(trimmedText, new Date());
    const assigneeId = parsed.assigneeName ? matchAssigneeIdByName(parsed.assigneeName, members) : null;

    setPreview({
      title: parsed.title,
      dueDate: parsed.dueDate ?? "",
      dueTime: parsed.dueTime ?? "",
      priority: parsed.priority,
      assigneeId: assigneeId ?? "",
    });
    setInfoMessage(
      usedAi ? null : "AI zpracování nedostupné, použit základní rozpoznávač data a času.",
    );
    setPhase("preview");
  }

  function handleConfirm() {
    if (!preview || !preview.title.trim()) {
      return;
    }

    onCreateTask(preview.title.trim(), {
      dueDate: preview.dueDate || null,
      dueTime: preview.dueDate ? preview.dueTime || null : null,
      priority: preview.priority,
      assigneeId: preview.assigneeId || null,
      teamId: activeTeamId,
    });
    onClose();
  }

  function handleBackToCapture() {
    setPhase("capture");
    setPreview(null);
  }

  return (
    <div className="quick-capture-overlay" role="presentation">
      <button
        type="button"
        className="quick-capture-overlay__backdrop"
        aria-label="Zavřít"
        onClick={onClose}
      />
      <section
        className="quick-capture-overlay__dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-capture-title"
      >
        <div className="quick-capture-overlay__header">
          <strong id="quick-capture-title">Smart Quick Capture</strong>
          <button type="button" className="quick-capture-overlay__close" aria-label="Zavřít" onClick={onClose}>
            ✕
          </button>
        </div>

        {phase === "capture" ? (
          <QuickCaptureCaptureStep
            text={text}
            onTextChange={setText}
            speechStatus={speech.status}
            onStartRecording={speech.start}
            onStopRecording={speech.stop}
            onProcess={handleProcess}
          />
        ) : null}

        {phase === "loading" ? (
          <div className="quick-capture-loading" role="status">
            Zpracovávám…
          </div>
        ) : null}

        {phase === "preview" && preview ? (
          <QuickCapturePreviewStep
            preview={preview}
            onChange={setPreview}
            infoMessage={infoMessage}
            members={members}
            onConfirm={handleConfirm}
            onBack={handleBackToCapture}
            onCancel={onClose}
          />
        ) : null}
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors referencing `QuickCaptureModal.tsx`. If TypeScript complains about assigning `handleCreateTask` (from `AppShell.tsx`, typed with its own local `CreateTaskOptions`) to the `onCreateTask` prop typed with `QuickCaptureCreateOptions`, re-check that every field name/type in `QuickCaptureCreateOptions` (Task 5) matches a field in `AppShell.tsx`'s `CreateTaskOptions` (`src/layout/AppShell.tsx:96`) exactly — they must be structurally compatible.

- [ ] **Step 3: Commit**

```bash
git add src/layout/quickCapture/QuickCaptureModal.tsx
git commit -m "Add Quick Capture modal container wiring capture, AI resolve, and preview"
```

---

### Task 9: Styling, wiring into `AppShell.tsx`, and end-to-end verification

**Files:**
- Modify: `src/styles.css` (append at end of file)
- Modify: `src/layout/AppShell.tsx:212` (add state), `src/layout/AppShell.tsx:1366` (render FAB + modal), plus new imports near the top of the file

**Interfaces:**
- Consumes: `QuickCaptureFab`, `QuickCaptureModal` (Tasks 5 and 8); `handleCreateTask` (already defined in `AppShell.tsx:547`), `activeTeamId` (already a variable in `AppShell.tsx`, from props).

- [ ] **Step 1: Append CSS to `src/styles.css`**

```css
/* Smart Quick Capture */
.quick-capture-fab {
  position: fixed;
  right: 24px;
  bottom: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: var(--accent, #4f46e5);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
  cursor: pointer;
  z-index: 40;
}

.quick-capture-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
}

.quick-capture-overlay__backdrop {
  position: absolute;
  inset: 0;
  border: none;
  background: rgba(0, 0, 0, 0.6);
  cursor: pointer;
}

.quick-capture-overlay__dialog {
  position: relative;
  width: min(480px, calc(100vw - 32px));
  max-height: calc(100vh - 64px);
  overflow-y: auto;
  background: var(--surface, #1f2430);
  color: var(--text, #fff);
  border-radius: 12px;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.quick-capture-overlay__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.quick-capture-overlay__close {
  border: none;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font-size: 16px;
}

.quick-capture-capture {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-capture-capture__record-button {
  display: flex;
  align-items: center;
  gap: 8px;
  align-self: flex-start;
  border: 1px solid var(--border, #3a3f4b);
  background: transparent;
  color: inherit;
  border-radius: 999px;
  padding: 8px 16px;
  cursor: pointer;
}

.quick-capture-capture__record-button[data-listening="true"] {
  animation: quick-capture-pulse 1.2s ease-in-out infinite;
  border-color: #ef4444;
  color: #ef4444;
}

@keyframes quick-capture-pulse {
  0%, 100% {
    box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
  }
  50% {
    box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
  }
}

.quick-capture-capture__hint {
  font-size: 13px;
  opacity: 0.8;
}

.quick-capture-capture__textarea {
  width: 100%;
  min-height: 90px;
  resize: vertical;
  border-radius: 8px;
  border: 1px solid var(--border, #3a3f4b);
  background: var(--surface-2, #151922);
  color: inherit;
  padding: 10px;
  font: inherit;
}

.quick-capture-capture__actions {
  display: flex;
  justify-content: flex-end;
}

.quick-capture-capture__submit {
  border: none;
  border-radius: 8px;
  background: var(--accent, #4f46e5);
  color: #fff;
  padding: 8px 18px;
  cursor: pointer;
}

.quick-capture-capture__submit:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.quick-capture-loading {
  text-align: center;
  padding: 24px 0;
  opacity: 0.8;
}

.quick-capture-preview {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-capture-preview__message {
  font-size: 13px;
  padding: 8px 10px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.06);
}

.quick-capture-preview__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
}

.quick-capture-preview__field input,
.quick-capture-preview__field select {
  border-radius: 8px;
  border: 1px solid var(--border, #3a3f4b);
  background: var(--surface-2, #151922);
  color: inherit;
  padding: 8px 10px;
  font: inherit;
}

.quick-capture-preview__actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.quick-capture-preview__confirm {
  border: none;
  border-radius: 8px;
  background: var(--accent, #4f46e5);
  color: #fff;
  padding: 8px 18px;
  cursor: pointer;
}

.quick-capture-preview__confirm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

- [ ] **Step 2: Add imports to `src/layout/AppShell.tsx`**

Add near the other local imports (after the `"../supabase/teamApi"` import block, i.e. after line 57):

```typescript
import { QuickCaptureFab } from "./quickCapture/QuickCaptureFab";
import { QuickCaptureModal } from "./quickCapture/QuickCaptureModal";
```

- [ ] **Step 3: Add state in `AppShell.tsx`**

Change (around line 210-212):

```typescript
  const [isFocusAssistantOpen, setIsFocusAssistantOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
```

to:

```typescript
  const [isFocusAssistantOpen, setIsFocusAssistantOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [isCheckInOpen, setIsCheckInOpen] = useState(false);
  const [isQuickCaptureOpen, setIsQuickCaptureOpen] = useState(false);
```

- [ ] **Step 4: Render the FAB and modal in `AppShell.tsx`**

Change the end of the root JSX (around line 1358-1367):

```typescript
      {isCheckInOpen ? (
        <CheckInOverlay
          summary={checkInSummary}
          onClose={handleCloseCheckIn}
          onCreateTask={handleOpenTaskComposerFromCheckIn}
          onMoveToTomorrow={handleMoveCheckInTasksToTomorrow}
        />
      ) : null}
    </div>
  );
}
```

to:

```typescript
      {isCheckInOpen ? (
        <CheckInOverlay
          summary={checkInSummary}
          onClose={handleCloseCheckIn}
          onCreateTask={handleOpenTaskComposerFromCheckIn}
          onMoveToTomorrow={handleMoveCheckInTasksToTomorrow}
        />
      ) : null}
      <QuickCaptureFab onOpen={() => setIsQuickCaptureOpen(true)} />
      {isQuickCaptureOpen ? (
        <QuickCaptureModal
          activeTeamId={activeTeamId}
          onClose={() => setIsQuickCaptureOpen(false)}
          onCreateTask={handleCreateTask}
        />
      ) : null}
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Full build**

Run: `npm run build`
Expected: build succeeds (the existing >500kB chunk-size warning is pre-existing and expected — do not try to fix it as part of this feature).

- [ ] **Step 7: Manual browser verification — text fallback path (no mic needed)**

Start the dev server and open it in the browser preview tool. Click the new mic FAB (bottom-right), confirm the modal opens with a text field and a "Zpracovat" button. Type `zítra v 10 ráno poslat fakturu Petrovi, vysoká priorita` into the field (skip recording), click "Zpracovat". Confirm:
- The preview phase appears with a title with the date/time phrase stripped out.
- If `VITE_GEMINI_API_KEY` is set and valid (confirmed in Task 1), no "AI zpracování nedostupné" message appears, `dueDate`/`dueTime` are filled in, and priority is "Vysoká".
- Click "Přidat úkol" and confirm the task appears in the active list with the expected due date/time/priority.

- [ ] **Step 8: Manual browser verification — offline fallback path**

Temporarily rename `VITE_GEMINI_API_KEY` in `.env.local` to `VITE_GEMINI_API_KEY_DISABLED` (or comment it out), restart the dev server, repeat the same flow. Confirm:
- The preview phase shows the info message "AI zpracování nedostupné, použit základní rozpoznávač data a času."
- `dueDate`/`dueTime` are still filled in (from the offline `parseTaskInput` parser), priority defaults to "Žádná", assignee is unassigned.
- Restore `VITE_GEMINI_API_KEY` in `.env.local` afterwards and restart the dev server.

- [ ] **Step 9: Manual browser verification — unsupported/denied mic states**

In the browser devtools console, run `delete window.SpeechRecognition; delete window.webkitSpeechRecognition;` then reload and reopen the modal — confirm the "Nahrávat" button is hidden and the hint text about unsupported recognition is shown, with the text field still usable. (Testing the actual "permission denied" browser prompt is optional/manual-only since it requires a real OS-level mic permission dialog.)

- [ ] **Step 10: Commit**

```bash
git add src/styles.css src/layout/AppShell.tsx
git commit -m "Wire Smart Quick Capture FAB and modal into AppShell"
```

---

## Self-Review Notes

- **Spec coverage:** FAB placement (§1) → Task 9; Web Speech API + cs-CZ + error handling (§2) → Task 4, Task 6 step 1 (unsupported/denied hints), Task 9 step 9; Gemini call with current-datetime prompt + strict JSON (§3) → Task 1; task creation + editable preview + loading spinner (§4) → Task 7, Task 8, Task 9 step 7; `.env`/`geminiService.ts` module (§5) → Task 1.
- **Type consistency:** `QuickCapturePreviewState` and `QuickCaptureCreateOptions` are defined once in `quickCaptureTypes.ts` (Task 5) and imported everywhere else (Tasks 7, 8) — no duplicate/divergent redefinitions. `QuickCaptureParsed` is defined once in `geminiService.ts` (Task 1) and reused by `quickCaptureResolve.ts` (Task 2) and `QuickCaptureModal.tsx` (Task 8, via the resolve result).
- **Scope:** single subsystem (one feature, one entry point), not decomposed further.
