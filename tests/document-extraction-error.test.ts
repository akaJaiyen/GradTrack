import { describe, expect, it } from "vitest";
import { documentExtractionErrorCode, documentExtractionErrorMessage } from "@/lib/document-extraction-error";

describe("document extraction error reporting", () => {
  it.each([
    ["pdf_read", "pdf_read"],
    ["pdf_render", "pdf_render"],
    ["typhoon_ocr", "typhoon_ocr"],
    ["extraction_save", "extraction_save"],
    ["typhoon_text", "typhoon_text"],
  ] as const)("maps the %s stage to a distinct user-facing error", (stage, expectedCode) => {
    expect(documentExtractionErrorCode(new Error("internal error"), stage)).toBe(expectedCode);
    expect(documentExtractionErrorMessage(expectedCode)).not.toBe(documentExtractionErrorMessage("unknown"));
  });

  it("reports PDF text-parser errors as fallback warnings, not terminal OCR failures", () => {
    expect(documentExtractionErrorMessage("pdf_read")).toContain("ลอง OCR จากภาพแทน");
    expect(documentExtractionErrorMessage("pdf_read")).not.toContain("Typhoon OCR");
  });
});
