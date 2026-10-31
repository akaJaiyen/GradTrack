import { describe, expect, it } from "vitest";
import { parseStudyPlanMarkdown } from "@/lib/study-plan-parser";

const source = "11111111-1111-4111-8111-111111111111";

describe("Study Plan Markdown parser", () => {
  it("extracts Thai course rows and keeps each term as its requirement group", () => {
    const profile = parseStudyPlanMarkdown(`--- Page 1 ---
## ปีที่ 1 ภาคการศึกษาที่ 1
| **01204113** คอมพิวเตอร์และการโปรแกรมสำหรับวิศวกรคอมพิวเตอร์ | **3(2-3-6)** |
| **01420113** ปฏิบัติการฟิสิกส์ I | **1(0-3-2)** |
| วิชาภาษาไทย | **3(- - )** |
| รวม | **21** |
--- Page 2 ---
## ปีที่ 1 ภาคการศึกษาที่ 2
| 01204114 | การพัฒนาฮาร์ดแวร์คอมพิวเตอร์เบื้องต้น | 3(2-3-6) |
012042 16 ความน่าจะเป็นและสถิติสำหรับวิศวกรคอมพิวเตอร์ 3(3-0-6)
01204490 สหกิจศึกษา 7`, source);

    expect(profile.sources).toEqual([{ sourceDocumentId: source, detectedKind: "curriculum" }]);
    expect(profile.curriculum.requirementGroups.filter(group => group.kind === "required_bucket").map(group => group.name)).toEqual([
      "ปีที่ 1 ภาคการศึกษาที่ 1", "ปีที่ 1 ภาคการศึกษาที่ 2",
    ]);
    expect(profile.curriculum.requiredCourses).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "01204113", nameTh: "คอมพิวเตอร์และการโปรแกรมสำหรับวิศวกรคอมพิวเตอร์", credits: 3 }),
      expect.objectContaining({ code: "01204114", nameTh: "การพัฒนาฮาร์ดแวร์คอมพิวเตอร์เบื้องต้น", credits: 3 }),
    ]));
    expect(profile.curriculum.requiredCourses).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "01204216", nameTh: "ความน่าจะเป็นและสถิติสำหรับวิศวกรคอมพิวเตอร์", credits: 3 }),
      expect.objectContaining({ code: "01204490", nameTh: "สหกิจศึกษา", credits: 7 }),
    ]));
    expect(profile.catalogCourses).toHaveLength(5);
    expect(profile.curriculum.requirementGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "วิชาภาษาไทย", kind: "elective_bucket", minimumCredits: 3 }),
    ]));
    expect(profile.curriculum.requirementGroups).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ name: "รวม" }),
    ]));
    expect(profile.evidence[2]).toMatchObject({ page: 2, text: "01204114 การพัฒนาฮาร์ดแวร์คอมพิวเตอร์เบื้องต้น 3" });
  });

  it("keeps wildcard course codes as a prefix requirement instead of a catalog course", () => {
    const profile = parseStudyPlanMarkdown(`## ปีที่ 1 ภาคการศึกษาที่ 1\n01175xxx วิชาเลือกสาขา 3(- -)`, source);
    expect(profile.curriculum.requiredCourses).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "01175XXX", nameTh: "วิชาเลือกสาขา", credits: 3 }),
    ]));
    expect(profile.catalogCourses).toEqual([]);
  });
});
