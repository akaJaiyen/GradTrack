"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Link2, RefreshCw, XCircle } from "lucide-react";
import { api } from "./shared";

type MatchStatus = "passed" | "not_passed" | "missing" | "needs_confirmation";
type Candidate = { id: string; code: string; name: string; score: number; grade: string | null };
type RequiredCourse = {
  requirementId: string;
  category: string;
  code: string | null;
  name: string | null;
  credits: number | null;
  status: MatchStatus;
  candidates: Candidate[];
};
type ElectiveCategory = {
  requirementId: string;
  category: string;
  requiredCredits: number;
  passedCredits: number;
  status: "complete" | "in_progress" | "empty";
  matchedCourses: Array<Candidate & { credits: number }>;
};
type MatchableRequirement = Pick<RequiredCourse, "requirementId">;
type MatchingData = {
  courses: Candidate[];
  progress: {
    totalCredits: number | null;
    passedCredits: number;
    passedRequired: number;
    pendingConfirmations: number;
    required: RequiredCourse[];
    electives: ElectiveCategory[];
  };
};
type MatchingApiResponse = Omit<MatchingData, "courses"> & {
  courses: Array<{ id: string; code: string; name_th: string | null; grade: string | null }>;
};

const statusDetails: Record<MatchStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  passed: { label: "ผ่านแล้ว", className: "ok", Icon: CheckCircle2 },
  needs_confirmation: { label: "รอยืนยัน", className: "warn", Icon: CircleAlert },
  not_passed: { label: "ยังไม่ผ่าน", className: "danger", Icon: XCircle },
  missing: { label: "ยังไม่พบ", className: "info", Icon: CircleAlert },
};

function StatusBadge({ status }: { status: MatchStatus }) {
  const { label, className, Icon } = statusDetails[status];
  return <span className={`status gap-1 ${className}`}><Icon aria-hidden="true" size={14} />{label}</span>;
}

function RequirementRow({ requirement, courses, onConfirm, busy }: {
  requirement: RequiredCourse;
  courses: Candidate[];
  onConfirm: (requirement: MatchableRequirement, courseId: string, automatic: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const suggested = requirement.candidates[0];
  const showSuggestedConfirmation = requirement.status === "needs_confirmation" && suggested;
  const isMatched = requirement.status === "passed";
  const courseTitle = [requirement.code, requirement.name].filter(Boolean).join(" — ") || "รายวิชาบังคับ";

  return <tr className="border-t border-blue-100 align-top hover:bg-slate-50">
    <td className="px-4 py-4"><p className="font-semibold text-slate-800">{courseTitle}</p><p className="mt-1 text-xs text-slate-500">{requirement.category}{requirement.credits !== null ? ` · ${requirement.credits} หน่วยกิต` : ""}</p></td>
    <td className="px-4 py-4 text-sm text-slate-700">
      {suggested ? <><p className="font-medium">{suggested.code} — {suggested.name}</p><p className="mt-1 text-slate-500">เกรด {suggested.grade || "—"}{showSuggestedConfirmation ? " · ชื่อใกล้เคียง" : ""}</p></> : <span className="text-slate-500">—</span>}
    </td>
    <td className="px-4 py-4"><StatusBadge status={requirement.status} /></td>
    <td className="min-w-72 px-4 py-4">
      {isMatched ? <p className="text-sm text-slate-600">ระบบนับผลที่รหัสตรงกันแล้ว</p> : showSuggestedConfirmation ? <button className="btn btn-primary min-h-11 disabled:cursor-wait disabled:opacity-60" disabled={busy} type="button" onClick={() => void onConfirm(requirement, suggested.id, true)}>
        <CheckCircle2 aria-hidden="true" size={16} /> ยืนยันการจับคู่
      </button> : <p className="text-sm text-slate-600">เลือกวิชาด้านล่างเพื่อจับคู่เอง</p>}

      {!isMatched ? <div className="mt-3 flex gap-2">
        <label className="sr-only" htmlFor={`match-${requirement.requirementId}`}>เลือกรายวิชาที่จะจับคู่กับ {courseTitle}</label>
        <select id={`match-${requirement.requirementId}`} className="min-h-11 min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
          <option value="">เลือกรายวิชา</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name} ({course.grade || "ไม่มีเกรด"})</option>)}
        </select>
        <button className="btn min-h-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedCourseId || busy} type="button" onClick={() => void onConfirm(requirement, selectedCourseId, false)}>
          <Link2 aria-hidden="true" size={16} /> จับคู่เอง
        </button>
      </div> : null}
      {requirement.status === "not_passed" && suggested ? <p className="mt-2 text-sm text-red-700">เกรดยังไม่นับว่าผ่าน</p> : null}
    </td>
  </tr>;
}

function ElectiveRow({ requirement, courses, onConfirm, busy }: {
  requirement: ElectiveCategory;
  courses: Candidate[];
  onConfirm: (requirement: MatchableRequirement, courseId: string, automatic: boolean) => Promise<void>;
  busy: boolean;
}) {
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const status = requirement.status === "complete" ? { label: "ครบแล้ว", className: "ok", Icon: CheckCircle2 } : requirement.status === "in_progress" ? { label: "กำลังสะสม", className: "warn", Icon: CircleAlert } : { label: "ยังไม่เลือก", className: "info", Icon: CircleAlert };
  const matchedLabel = requirement.matchedCourses.length ? requirement.matchedCourses.map(course => `${course.code} (${course.credits} นก.)`).join(", ") : "ยังไม่มีวิชาที่ยืนยันในหมวดนี้";
  return <tr className="border-t border-blue-100 align-top hover:bg-slate-50">
    <td className="px-4 py-4"><p className="font-semibold text-slate-800">{requirement.category}</p><p className="mt-1 text-xs text-slate-500">วิชาเลือก / หมวดหน่วยกิต</p></td>
    <td className="px-4 py-4 text-sm text-slate-700"><p className="font-medium tabular-nums">{requirement.passedCredits} / {requirement.requiredCredits} หน่วยกิต</p><p className="mt-1 text-slate-500">{matchedLabel}</p></td>
    <td className="px-4 py-4"><span className={`status gap-1 ${status.className}`}><status.Icon aria-hidden="true" size={14} />{status.label}</span></td>
    <td className="min-w-72 px-4 py-4"><div className="flex gap-2"><label className="sr-only" htmlFor={`elective-${requirement.requirementId}`}>เลือกรายวิชาเพื่อยืนยันในหมวด {requirement.category}</label><select id={`elective-${requirement.requirementId}`} className="min-h-11 min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" value={selectedCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}><option value="">เลือกรายวิชา</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name} ({course.grade || "ไม่มีเกรด"})</option>)}</select><button className="btn min-h-11 shrink-0 disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedCourseId || busy} type="button" onClick={() => void onConfirm(requirement, selectedCourseId, false)}><Link2 aria-hidden="true" size={16} /> ยืนยัน</button></div></td>
  </tr>;
}

export function MatchingPage() {
  const [data, setData] = useState<MatchingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRequirementId, setBusyRequirementId] = useState<string | null>(null);

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const result = await api("/api/academic-profile") as MatchingApiResponse;
      setData({
        progress: result.progress,
        courses: result.courses.map((course) => ({
          id: course.id,
          code: course.code,
          name: course.name_th || "—",
          score: 1,
          grade: course.grade,
        })),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "โหลดข้อมูลการจับคู่ไม่สำเร็จ");
    } finally {
      if (showLoading) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const confirm = async (requirement: MatchableRequirement, courseId: string, automatic: boolean) => {
    setBusyRequirementId(requirement.requirementId);
    setError(null);
    try {
      await api("/api/matches", "POST", {
        courseId,
        requirementId: requirement.requirementId,
        matchType: automatic ? "automatic" : "manual",
        confidence: automatic ? 0.7 : 1,
        status: "confirmed",
      });
      await load(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกการจับคู่ไม่สำเร็จ");
    } finally {
      setBusyRequirementId(null);
    }
  };

  if (loading) return <section className="card p-6 text-sm text-slate-600" aria-busy="true">กำลังโหลดข้อมูลการจับคู่…</section>;
  if (error && !data) return <section className="card p-6"><p className="text-sm text-red-700" role="alert">{error}</p><button className="btn mt-4" type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" size={16} /> ลองใหม่</button></section>;

  const progress = data!.progress;
  const hasRequirements = progress.required.length > 0 || progress.electives.length > 0;
  const totalRequired = progress.required.length;
  const missing = progress.required.filter((item) => item.status === "missing").length;
  const creditLabel = progress.totalCredits === null ? `${progress.passedCredits} หน่วยกิตผ่านแล้ว` : `${progress.passedCredits} / ${progress.totalCredits} หน่วยกิตผ่านแล้ว`;

  return <section className="space-y-5">
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">จับคู่รายวิชา</h2><p className="mt-1 text-sm text-slate-600">ยืนยันเฉพาะรายวิชาที่ชื่อคล้ายกันหรือจับคู่ด้วยตนเอง รายวิชาที่รหัสตรงกันจะนับให้อัตโนมัติ</p></div>
        <button className="btn min-h-11" type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" size={16} /> โหลดใหม่</button>
      </div>
      {error ? <p className="mt-4 text-sm text-red-700" role="alert">{error}</p> : null}
      {hasRequirements ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-blue-100 bg-blue-50 p-3"><p className="text-sm text-slate-600">วิชาบังคับผ่านแล้ว</p><p className="mt-1 text-2xl font-bold tabular-nums text-blue-900">{progress.passedRequired}<span className="text-base font-medium"> / {totalRequired}</span></p></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3"><p className="text-sm text-amber-900">รอยืนยัน</p><p className="mt-1 text-2xl font-bold tabular-nums text-amber-950">{progress.pendingConfirmations}</p></div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-sm text-slate-600">ยังไม่พบ</p><p className="mt-1 text-2xl font-bold tabular-nums text-slate-800">{missing}</p></div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3"><p className="text-sm text-emerald-900">หน่วยกิตสะสม</p><p className="mt-1 text-lg font-bold tabular-nums text-emerald-950">{creditLabel}</p></div>
      </div> : null}
    </section>

    {!hasRequirements ? <section className="card p-6"><h2 className="font-bold">ยังไม่มีข้อมูลพร้อมจับคู่</h2><p className="mt-2 text-sm text-slate-600">ตรวจและยืนยันข้อมูลแผนหลักสูตรกับผลการเรียนในหน้า “ตรวจสอบข้อมูล” ก่อน แล้วกลับมาจับคู่รายวิชาที่นี่</p></section> : <>
    {progress.required.length ? <section className="card overflow-hidden">
      <div className="border-b border-blue-100 p-5"><h2 className="font-bold">รายวิชาบังคับตามหลักสูตร</h2><p className="mt-1 text-sm text-slate-600">สถานะผ่านจะอ้างอิงเฉพาะเกรดที่ผ่านเกณฑ์</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-blue-50 text-slate-700"><tr><th className="px-4 py-3 font-semibold">ข้อกำหนดหลักสูตร</th><th className="px-4 py-3 font-semibold">รายวิชาจากผลการเรียน</th><th className="px-4 py-3 font-semibold">สถานะ</th><th className="px-4 py-3 font-semibold">การดำเนินการ</th></tr></thead><tbody>{progress.required.map((requirement) => <RequirementRow busy={busyRequirementId === requirement.requirementId} courses={data!.courses} key={requirement.requirementId} onConfirm={confirm} requirement={requirement} />)}</tbody></table></div>
    </section>}
    {progress.electives.length ? <section className="card overflow-hidden"><div className="border-b border-blue-100 p-5"><h2 className="font-bold">หมวดและวิชาเลือก</h2><p className="mt-1 text-sm text-slate-600">เลือกยืนยันรายวิชาที่ผ่านแล้วลงในหมวดที่ถูกต้อง เพื่อสะสมหน่วยกิตแต่ละหมวด</p></div><div className="overflow-x-auto"><table className="w-full min-w-[960px] text-left text-sm"><thead className="bg-blue-50 text-slate-700"><tr><th className="px-4 py-3 font-semibold">หมวดหลักสูตร</th><th className="px-4 py-3 font-semibold">หน่วยกิตและรายวิชาที่ยืนยัน</th><th className="px-4 py-3 font-semibold">สถานะ</th><th className="px-4 py-3 font-semibold">การดำเนินการ</th></tr></thead><tbody>{progress.electives.map((requirement) => <ElectiveRow busy={busyRequirementId === requirement.requirementId} courses={data!.courses} key={requirement.requirementId} onConfirm={confirm} requirement={requirement} />)}</tbody></table></div></section> : null}
    </>}
  </section>;
}
