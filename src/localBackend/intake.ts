// Port of server/transcription/intake.py: shared utterance intake for the
// streaming capture paths.

import { transcribe } from "./asr";
import type { SessionSpeakers } from "./speakers";

export interface IntakeResult {
  speaker: string | null;
  text: string;
  duration: number;
}

/**
 * Transcribe one utterance and resolve its speaker label. The embed runs in
 * parallel with ASR like the server's to_thread(assign) — divergence: JS
 * cannot cancel it if transcription fails, so a late-landing embedding may
 * still update session centroids (harmless: it heard real speech).
 */
export async function intakeUtterance(blob: Blob, speakers: SessionSpeakers | null): Promise<IntakeResult> {
  let embedPromise: Promise<string | null> | null = null;
  if (speakers !== null) {
    embedPromise = speakers.assign(await blob.arrayBuffer());
  }

  const result = await transcribe(blob);
  const text = String(result.text ?? "").trim();
  const duration = Number(result.duration ?? 0) || 0;

  let speaker: string | null = null;
  if (embedPromise !== null) {
    try {
      speaker = await embedPromise;
    } catch (error) {
      console.debug(`Diarization failed for one utterance: ${error}`);
    }
  }
  return { speaker, text, duration };
}
