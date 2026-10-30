import { describe, expect, it } from "vitest";
import { parseKuTranscriptPages, passesTranscriptAcceptanceGate } from "@/lib/ku-transcript-parser";

const item = (str: string, x: number, y: number) => ({ str, x, y });

describe("KU transcript parser", () => {
  it("keeps independent term/year contexts for both page columns and Summer", () => {
    const drafts = parseKuTranscriptPages([{ page: 1, width: 600, items: [
      item("First Semester 2023", 80, 700), item("01204113 Computer and Programming A 3", 85, 680), item("for Computer Engineers", 87, 670),
      item("Second Semester 2023", 80, 620), item("01200101 Innovative Thinking A 3", 85, 600),
      item("First Semester 2024", 320, 700), item("01204211 Discrete Mathematics A 4", 325, 680),
      item("Summer Session 2025", 320, 620), item("01355119 Essential English B+ 3*", 325, 600),
    ] }]);
    expect(drafts.map(draft => [draft.code, draft.term, draft.academicYear, draft.grade, draft.credits])).toEqual([
      ["01204113", "1", 2023, "A", 3], ["01200101", "2", 2023, "A", 3],
      ["01204211", "1", 2024, "A", 4], ["01355119", "summer", 2025, "B+", 3],
    ]);
    expect(drafts[0].name).toBe("Computer and Programming for Computer Engineers");
  });

  it("continues the current term on a later page and rejects missing evidence", () => {
    const drafts = parseKuTranscriptPages([
      { page: 1, width: 600, items: [item("First Semester 2026", 80, 700), item("01204490 Co-operative Education N 7", 85, 680)] },
      { page: 2, width: 600, items: [item("Second Semester 2026", 80, 700), item("01204421 Computer Networks B+ 3", 85, 680)] },
    ]);
    expect(drafts.map(draft => [draft.code, draft.term, draft.academicYear])).toEqual([["01204490", "1", 2026], ["01204421", "2", 2026]]);
    expect(passesTranscriptAcceptanceGate(drafts, 2)).toEqual({ ok: true });
    expect(passesTranscriptAcceptanceGate([{ ...drafts[0], evidence: { ...drafts[0].evidence, page: 9 } }], 2)).toMatchObject({ ok: false });
  });
});
