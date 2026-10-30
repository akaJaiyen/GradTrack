const maxGeminiTextLength = 200_000;

export type LocalExtraction = { text: string; confidence: number };

/**
 * Keep Gemini requests small when the browser obtained enough readable text.
 * Short or low-confidence output is normally a scanned or poorly parsed
 * document, for which Gemini's document understanding is a safer fallback.
 */
export function textForGemini(extraction: LocalExtraction | null | undefined) {
  if (!extraction || extraction.confidence < 0.5) return null;
  const text = extraction.text.trim();
  if (text.length < 160) return null;
  return text.slice(0, maxGeminiTextLength);
}
