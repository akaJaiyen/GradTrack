"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { AcademicProfileExtraction } from "@/lib/extraction";
import { api } from "./shared";

export function AcademicProfileReview() {
  const [profile, setProfile] = useState<AcademicProfileExtraction | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { void api("/api/academic-profile").then(result => setProfile(result.data?.extraction_json || null)).catch(() => setError("ไม่สามารถโหลด academic profile ได้")); }, []);
  if (error) return <p className="text-sm text-red-700" role="alert">{error}</p>;
  if (!profile) return <section className="card p-6"><h2 className="font-bold">ยังไม่มีข้อมูลที่ AI อ่านแล้ว</h2><p className="mt-2 text-sm text-slate-600">อัปโหลดเอกสารหลักสูตร, รายวิชา หรือ Transcript จากหน้าเอกสารของฉัน</p></section>;
  const evidence = (path: string) => profile.evidence.find(item => item.path === path);
  return <div className="space-y-5">
    <section className="card p-5"><h2 className="font-bold">{profile.profile.program || "Academic profile"}</h2><p className="mt-1 text-sm text-slate-600">{[profile.profile.institution, profile.profile.curriculumYear, profile.profile.degreeLevel].filter(Boolean).join(" · ")}</p>{profile.warnings.length > 0 && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800">พบ {profile.warnings.length} รายการที่ควรตรวจสอบ</p>}</section>
    <ProfileTable title="โครงสร้างและหน่วยกิต" headers={["หมวด", "ขั้นต่ำ (หน่วยกิต)", "หลักฐาน"]} rows={profile.curriculum.requirementGroups.filter(group => group.kind !== "container").map(group => [group.name, group.minimumCredits ?? "—", <Evidence key={group.id} item={evidence(`curriculum.requirementGroups.${group.id}`)} />])} />
    <ProfileTable title="รายวิชาในหลักสูตร" headers={["รหัส", "ชื่อรายวิชา", "หน่วยกิต", "Prerequisite"]} rows={profile.catalogCourses.map(course => [course.code, course.nameTh || course.nameEn || "—", course.credits ?? "—", course.prerequisiteCodes.join(", ") || "—"])} />
    <ProfileTable title="ผลการเรียน" headers={["รหัส", "ชื่อรายวิชา", "หน่วยกิต", "เกรด", "เทอม"]} rows={profile.completedCourses.map(course => [course.code, course.name, course.credits, course.grade || "—", [course.term, course.academicYear].filter(Boolean).join("/") || "—"])} />
    {profile.unresolvedCourses.length > 0 && <ProfileTable title="รายการที่ AI ระบุรหัสวิชาไม่ได้" headers={["ข้อความต้นทาง", "เหตุผล"]} rows={profile.unresolvedCourses.map(course => [course.sourceText, course.reason])} />}
    {profile.warnings.length > 0 && <section className="card p-5"><h2 className="font-bold">คำเตือน</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">{profile.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></section>}
  </div>;
}

function Evidence({ item }: { item: AcademicProfileExtraction["evidence"][number] | undefined }) { return item ? <span title={item.text} className="text-xs text-slate-500">หน้า {item.page || "—"}: {item.text}</span> : <span className="text-xs text-slate-400">—</span>; }
function ProfileTable({ title, headers, rows }: { title: string; headers: string[]; rows: ReactNode[][] }) { return <section className="card overflow-x-auto"><h2 className="p-5 font-bold">{title}</h2><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{headers.map(header => <th className="px-5 py-3 font-medium" key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr className="border-t" key={index}>{row.map((cell, cellIndex) => <td className="px-5 py-3" key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="px-5 py-4 text-slate-500" colSpan={headers.length}>ไม่พบข้อมูลในเอกสาร</td></tr>}</tbody></table></section>; }
