import { afterEach, describe, expect, it, vi } from "vitest";
import { tryPdfParser } from "@/lib/pdf-parser-fallback";

afterEach(() => vi.restoreAllMocks());

describe("PDF parser OCR fallback", () => {
  it("returns no parsed result and logs only safe parser metadata when parsing fails", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    const fallback = vi.fn().mockResolvedValue(["rendered-page"]);

    const parsed = await tryPdfParser("study_plan", async () => {
      throw new Error("sensitive document content");
    });
    const pages = parsed === null ? await fallback() : [];

    expect(parsed).toBeNull();
    expect(pages).toEqual(["rendered-page"]);
    expect(warning).toHaveBeenCalledWith("PDF text parser failed; continuing with image OCR", {
      parser: "study_plan",
      failureKind: "Error",
    });
    expect(JSON.stringify(warning.mock.calls)).not.toContain("sensitive document content");
  });

  it("returns the parsed result without logging when the PDF parser succeeds", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => {});
    await expect(tryPdfParser("study_plan", async () => ({ courses: 2 }))).resolves.toEqual({ courses: 2 });
    expect(warning).not.toHaveBeenCalled();
  });
});
