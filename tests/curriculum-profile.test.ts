import { describe, expect, it } from "vitest";
import { parseKuCpe2565Catalog, parseKuCpe2565Summary } from "@/lib/curriculum-profile";
import { joinPdfTextItems } from "@/lib/client-ocr";

describe("KU CPE 2565 curriculum profile", () => {
  it("creates the verified hierarchy from the structure summary", () => {
    const draft = parseKuCpe2565Summary("จำนวนหน่วยกิต รวมตลอดหลักสูตร ไม่น้อยกว่า 1 38 หน่วยกิต วิชา เฉพาะ เลือก ไม่น้อยกว่า 16 หน่วยกิต");
    expect(draft?.profile).toBe("ku-cpe-2565");
    expect(draft?.nodes).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "total", minimumCredits: 138, kind: "total" }),
      expect.objectContaining({ id: "specific-elective", minimumCredits: 16, kind: "elective_bucket" }),
      expect.objectContaining({ id: "software", minimumCredits: 17, kind: "required_bucket" }),
    ]));
  });

  it("extracts a catalog course without treating the course code as credits", () => {
    const catalog = parseKuCpe2565Catalog("01204113 Computer and Programming for Computer Engineers 3(2-3-6) (Computer and Programming for Computer Engineers)");
    expect(catalog).toEqual([expect.objectContaining({ code: "01204113", credits: 3, nameEn: "Computer and Programming for Computer Engineers" })]);
  });

  it("does not append a following course code to a one-credit value", () => {
    expect(joinPdfTextItems([{ str: "3" }, { str: "01355101" }])).toBe("3 01355101");
  });
});
