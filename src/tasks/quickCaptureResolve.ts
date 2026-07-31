import { parseTaskInput } from "./naturalLanguageTaskParser";
import { isGroqConfigured, parseVoiceInputWithGroq, type QuickCaptureParsed } from "./groqService";

export type QuickCaptureResolution = {
  parsed: QuickCaptureParsed;
  usedAi: boolean;
};

export async function resolveQuickCapture(text: string, now: Date): Promise<QuickCaptureResolution> {
  if (isGroqConfigured()) {
    try {
      const parsed = await parseVoiceInputWithGroq(text, now);
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
