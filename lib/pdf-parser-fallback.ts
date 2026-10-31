export async function tryPdfParser<T>(parserName: string, parser: () => Promise<T>): Promise<T | null> {
  try {
    return await parser();
  } catch (caught) {
    console.warn("PDF text parser failed; continuing with image OCR", {
      parser: parserName,
      failureKind: caught instanceof Error ? caught.name : "unknown",
    });
    return null;
  }
}
