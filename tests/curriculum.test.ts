import { describe, expect, it } from "vitest";
import { calculateProgress } from "@/lib/academic";
import { parseCurriculum, suggestRequirement } from "@/lib/curriculum";
import { Course, Requirement } from "@/lib/types";
import { joinPdfTextItems } from "@/lib/client-ocr";

describe("curriculum parser", () => {
  it("extracts required courses, elective credits, and total credits", () => {
    const result = parseCurriculum(`หมวดวิชาเฉพาะ\nวิชาบังคับ\nCS 101 Introduction to Programming 3 credits\nวิชาเลือก ไม่น้อยกว่า 12 หน่วยกิต\nรวมหน่วยกิต 128`);
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "required_course", code: "CS101", name: "Introduction to Programming" }),
      expect.objectContaining({ type: "elective_credit", minimumCredits: 12 }),
      expect.objectContaining({ type: "total_credit", minimumCredits: 128 }),
    ]));
  });

  it("reads all credit buckets from a one-line Thai curriculum summary", () => {
    const result = parseCurriculum("3.1.1 จำนวนหน่วยกิตรวมตลอดหลักสูตร ไม่น้อยกว่า 138 หน่วยกิต 1) หมวดวิชาศึกษาทั่วไป ไม่น้อยกว่า 30 หน่วยกิต - กลุ่มสาระอยู่ดีมีสุข ไม่น้อยกว่า 7 หน่วยกิต - กลุ่มสาระศาสตร์แห่งผู้ประกอบการ ไม่น้อยกว่า 3 หน่วยกิต - กลุ่มสาระภาษากับการสื่อสาร ไม่น้อยกว่า 15 หน่วยกิต 2) หมวดวิชาเฉพาะ ไม่น้อยกว่า 102 หน่วยกิต 2.1 วิชาแกน 32 หน่วยกิต - วิชาแกนทางวิทยาศาสตร์และคณิตศาสตร์ 17 หน่วยกิต - วิชาแกนทางวิศวกรรม 15 หน่วยกิต 2.2 วิชาเฉพาะด้าน 54 หน่วยกิต 2.3 วิชาเฉพาะเลือก ไม่น้อยกว่า 16 หน่วยกิต 3) หมวดวิชาเลือกเสรี ไม่น้อยกว่า 6 หน่วยกิต");
    expect(result).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "หน่วยกิตรวม", type: "total_credit", minimumCredits: 138 }),
      expect.objectContaining({ category: "หมวดวิชาศึกษาทั่วไป", type: "elective_credit", minimumCredits: 30 }),
      expect.objectContaining({ category: "วิชาแกน", type: "elective_credit", minimumCredits: 32 }),
      expect.objectContaining({ category: "วิชาเฉพาะเลือก", type: "elective_credit", minimumCredits: 16 }),
      expect.objectContaining({ category: "หมวดวิชาเลือกเสรี", type: "elective_credit", minimumCredits: 6 }),
    ]));
  });

  it("keeps split PDF.js number fragments together before parsing", () => {
    expect(joinPdfTextItems([{ str: "ไม่น้อยกว่า" }, { str: "1" }, { str: "5" }, { str: "หน่วยกิต" }])).toBe("ไม่น้อยกว่า 15 หน่วยกิต");
    expect(parseCurriculum("จำนวนหน่วยกิตรวมตลอดหลักสูตร ไม่น้อยกว่า 1 38 หน่วยกิต")).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: "total_credit", minimumCredits: 138 }),
    ]));
  });
});

describe("requirement matching", () => {
  const requirements: Requirement[] = [
    { id: "code", category: "Core", type: "required_course", code: "CS-101", name: "Introduction to Programming" },
    { id: "name", category: "Core", type: "required_course", code: "CS102", name: "Data Structures" },
    { id: "total", category: "Total", type: "total_credit", minimumCredits: 128 },
  ];
  it("uses normalized course code before name similarity", () => {
    expect(suggestRequirement({ code: "cs 101", nameTh: "Unrelated" }, requirements)).toMatchObject({ requirementId: "code", confidence: 1, reason: "code" });
  });
  it("offers a name-based suggestion only when no code matches", () => {
    expect(suggestRequirement({ code: "OTHER1", nameTh: "Data Structures" }, requirements)).toMatchObject({ requirementId: "name", reason: "name" });
  });
  it("counts only passed courses with a confirmed match and avoids double counting", () => {
    const courses: Course[] = [
      { id: "a", code: "CS101", nameTh: "Programming", credits: 3, grade: "A" },
      { id: "b", code: "CS102", nameTh: "Data", credits: 3, grade: "A" },
    ];
    expect(calculateProgress(courses, requirements, [
      { course_id: "a", degree_requirement_id: "code", status: "confirmed" },
      { course_id: "a", degree_requirement_id: "total", status: "confirmed" },
      { course_id: "b", degree_requirement_id: "name", status: "needs_review" },
    ])).toMatchObject({ passedCredits: 3, totalCredits: 128, percentage: 2 });
  });
});
