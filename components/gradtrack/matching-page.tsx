"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleAlert, Link2, RefreshCw, RotateCcw, XCircle } from "lucide-react";
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
  return <span className={`status shrink-0 gap-1 whitespace-nowrap ${className}`}><Icon aria-hidden="true" size={14} />{label}</span>;
}

function RequirementRow({ requirement, courses, selectedCourseId, onSelect, onConfirm, busy }: {
  requirement: RequiredCourse;
  courses: Candidate[];
  selectedCourseId: string;
  onSelect: (courseId: string) => void;
  onConfirm: (requirement: MatchableRequirement, courseId: string, automatic: boolean) => Promise<void>;
  busy: boolean;
}) {
  const suggested = requirement.candidates[0];
  const hasMatch = Boolean(suggested);
  const courseName = requirement.name || "ไม่ระบุชื่อรายวิชา";

  return <tr className="border-t border-blue-100 align-middle transition-colors hover:bg-blue-50/40">
    <td className="px-5 py-3 font-semibold tabular-nums text-slate-800">{requirement.code || "—"}</td>
    <td className="px-5 py-3"><p className="font-semibold leading-5 text-slate-800">{courseName}</p>{requirement.credits !== null ? <p className="mt-1 text-xs text-slate-500">{requirement.credits} หน่วยกิต</p> : null}</td>
    <td className="px-5 py-3 font-semibold tabular-nums text-slate-700">{suggested?.grade || "—"}</td>
    <td className="px-5 py-3"><StatusBadge status={requirement.status} />{requirement.status === "not_passed" && suggested ? <p className="mt-2 text-xs text-red-700">เกรดยังไม่ผ่าน</p> : null}</td>
    <td className="px-5 py-3">
      {!hasMatch ? <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor={`match-${requirement.requirementId}`}>เลือกรายวิชาที่จะจับคู่กับ {courseName}</label>
        <select id={`match-${requirement.requirementId}`} className="h-10 min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" value={selectedCourseId} onChange={(event) => onSelect(event.target.value)}>
          <option value="">เลือกรายวิชา</option>
          {courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name} ({course.grade || "ไม่มีเกรด"})</option>)}
        </select>
        <button className="btn min-h-10 shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedCourseId || busy} type="button" onClick={() => void onConfirm(requirement, selectedCourseId, false)}>
          <Link2 aria-hidden="true" size={16} /> จับคู่
        </button>
      </div> : null}
    </td>
  </tr>;
}

function ElectiveRow({ requirement, courses, selectedCourseId, onSelect, onConfirm, busy }: {
  requirement: ElectiveCategory;
  courses: Candidate[];
  selectedCourseId: string;
  onSelect: (courseId: string) => void;
  onConfirm: (requirement: MatchableRequirement, courseId: string, automatic: boolean) => Promise<void>;
  busy: boolean;
}) {
  const status = requirement.status === "complete" ? { label: "ครบแล้ว", className: "ok", Icon: CheckCircle2 } : requirement.status === "in_progress" ? { label: "กำลังสะสม", className: "warn", Icon: CircleAlert } : { label: "ยังไม่เลือก", className: "info", Icon: CircleAlert };
  const matchedLabel = requirement.matchedCourses.length ? requirement.matchedCourses.map(course => `${course.code} — ${course.name} (${course.credits} นก.)`).join(", ") : "ยังไม่มีวิชาที่ยืนยันในหมวดนี้";
  return <tr className="border-t border-blue-100 align-middle transition-colors hover:bg-blue-50/40">
    <td className="px-5 py-3"><p className="font-semibold text-slate-800">{requirement.category}</p><p className="mt-1 text-xs text-slate-500">วิชาเลือก / หมวดหน่วยกิต</p></td>
    <td className="px-5 py-3 text-sm text-slate-700"><p className="font-medium tabular-nums">{requirement.passedCredits} / {requirement.requiredCredits} หน่วยกิต</p><p className="mt-1 text-slate-500">{matchedLabel}</p></td>
    <td className="px-5 py-3"><span className={`status shrink-0 gap-1 whitespace-nowrap ${status.className}`}><status.Icon aria-hidden="true" size={14} />{status.label}</span></td>
    <td className="px-5 py-3"><div className="flex items-center gap-2"><label className="sr-only" htmlFor={`elective-${requirement.requirementId}`}>เลือกรายวิชาเพื่อยืนยันในหมวด {requirement.category}</label><select id={`elective-${requirement.requirementId}`} className="h-10 min-w-0 flex-1 rounded-lg border border-blue-200 bg-white px-3 text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" value={selectedCourseId} onChange={(event) => onSelect(event.target.value)}><option value="">เลือกรายวิชา</option>{courses.map((course) => <option key={course.id} value={course.id}>{course.code} — {course.name} ({course.grade || "ไม่มีเกรด"})</option>)}</select><button className="btn min-h-10 shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedCourseId || busy} type="button" onClick={() => void onConfirm(requirement, selectedCourseId, false)}>ยืนยัน</button></div></td>
  </tr>;
}

export function MatchingPage() {
  const [data, setData] = useState<MatchingData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyRequirementId, setBusyRequirementId] = useState<string | null>(null);
  const [savingAllElectives, setSavingAllElectives] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedCourses, setSelectedCourses] = useState<Record<string, string>>({});

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
      setSelectedCourses((current) => {
        const next = { ...current };
        delete next[requirement.requirementId];
        return next;
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "บันทึกการจับคู่ไม่สำเร็จ");
    } finally {
      setBusyRequirementId(null);
    }
  };

  const resetMatches = async () => {
    if (!window.confirm("รีเซ็ตการจับคู่ทั้งหมดหรือไม่? การจับคู่ที่คุณยืนยันไว้จะถูกลบ แต่เอกสาร หลักสูตร และผลการเรียนจะไม่ถูกลบ")) return;
    setResetting(true);
    setError(null);
    try {
      await api("/api/matches", "DELETE");
      setSelectedCourses({});
      await load(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "รีเซ็ตการจับคู่ไม่สำเร็จ");
    } finally {
      setResetting(false);
    }
  };

  if (loading) return <section className="card p-6 text-sm text-slate-600" aria-busy="true">กำลังโหลดข้อมูลการจับคู่…</section>;
  if (error && !data) return <section className="card p-6"><p className="text-sm text-red-700" role="alert">{error}</p><button className="btn mt-4" type="button" onClick={() => void load()}><RefreshCw aria-hidden="true" size={16} /> ลองใหม่</button></section>;

  const progress = data!.progress;
  const hasRequirements = progress.required.length > 0 || progress.electives.length > 0;
  const totalRequired = progress.required.length;
  const missing = progress.required.filter((item) => item.status === "missing").length;
  const creditLabel = progress.totalCredits === null ? `${progress.passedCredits} หน่วยกิตผ่านแล้ว` : `${progress.passedCredits} / ${progress.totalCredits} หน่วยกิตผ่านแล้ว`;
  const matchedCourseIds = new Set([
    ...progress.required.flatMap((requirement) => requirement.candidates.map((course) => course.id)),
    ...progress.electives.flatMap((requirement) => requirement.matchedCourses.map((course) => course.id)),
  ]);
  const pendingCourseIds = new Set(Object.values(selectedCourses).filter(Boolean));
  const coursesFor = (requirementId: string) => data!.courses.filter((course) =>
    !matchedCourseIds.has(course.id) && (selectedCourses[requirementId] === course.id || !pendingCourseIds.has(course.id)),
  );
  const selectCourse = (requirementId: string, courseId: string) => {
    setSelectedCourses((current) => ({ ...current, [requirementId]: courseId }));
  };
  const pendingElectiveSelections = progress.electives.flatMap((requirement) => {
    const courseId = selectedCourses[requirement.requirementId];
    return courseId ? [{ requirementId: requirement.requirementId, courseId }] : [];
  });
  const confirmAllElectives = async () => {
    if (!pendingElectiveSelections.length) return;
    setSavingAllElectives(true);
    setError(null);
    try {
      await Promise.all(pendingElectiveSelections.map(({ requirementId, courseId }) => api("/api/matches", "POST", {
        courseId,
        requirementId,
        matchType: "manual",
        confidence: 1,
        status: "confirmed",
      })));
      await load(false);
      const confirmedIds = new Set(pendingElectiveSelections.map((item) => item.requirementId));
      setSelectedCourses((current) => Object.fromEntries(Object.entries(current).filter(([requirementId]) => !confirmedIds.has(requirementId))));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "ยืนยันวิชาเลือกไม่สำเร็จ");
      await load(false);
    } finally {
      setSavingAllElectives(false);
    }
  };
  const requiredSorted = [...progress.required].sort((left, right) => {
    const rank: Record<MatchStatus, number> = { not_passed: 0, missing: 1, needs_confirmation: 2, passed: 3 };
    return rank[left.status] - rank[right.status];
  });
  const electivesSorted = [...progress.electives].sort((left, right) => {
    const rank: Record<ElectiveCategory["status"], number> = { empty: 0, in_progress: 1, complete: 2 };
    return rank[left.status] - rank[right.status];
  });

  return <section className="space-y-5">
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-xl font-bold">จับคู่รายวิชา</h2><p className="mt-1 text-sm text-slate-600">ยืนยันเฉพาะรายวิชาที่ชื่อคล้ายกันหรือจับคู่ด้วยตนเอง รายวิชาที่รหัสตรงกันจะนับให้อัตโนมัติ</p></div>
        <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:border-rose-300 hover:bg-rose-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-300 disabled:cursor-not-allowed disabled:opacity-50" disabled={resetting || busyRequirementId !== null || savingAllElectives} type="button" onClick={() => void resetMatches()}><RotateCcw aria-hidden="true" size={16} />{resetting ? "กำลังรีเซ็ต…" : "รีเซ็ตการจับคู่"}</button>
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
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-blue-100 px-5 py-4"><div><h2 className="font-bold">รายวิชาบังคับ</h2><p className="mt-1 text-sm text-slate-600">รหัสที่ตรงกันจะนับให้อัตโนมัติ; ยืนยันเฉพาะวิชาที่ชื่อใกล้เคียง</p></div><p className="text-sm text-slate-500">{totalRequired} รายการ</p></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[980px] table-fixed text-left text-sm"><colgroup><col className="w-[13%]" /><col className="w-[24%]" /><col className="w-[24%]" /><col className="w-[12%]" /><col className="w-[27%]" /></colgroup><thead className="border-b border-blue-100 bg-slate-50 text-slate-600"><tr><th className="px-5 py-3 font-medium">รหัสวิชา</th><th className="px-5 py-3 font-medium">ชื่อวิชาตามหลักสูตร</th><th className="px-5 py-3 font-medium">ผลการเรียน</th><th className="px-5 py-3 font-medium">สถานะ</th><th className="px-5 py-3 font-medium">การจับคู่</th></tr></thead><tbody>{requiredSorted.map((requirement) => <RequirementRow busy={busyRequirementId === requirement.requirementId} courses={coursesFor(requirement.requirementId)} key={requirement.requirementId} onConfirm={confirm} onSelect={(courseId) => selectCourse(requirement.requirementId, courseId)} requirement={requirement} selectedCourseId={selectedCourses[requirement.requirementId] || ""} />)}</tbody></table></div>
    </section> : null}
    {progress.electives.length ? <section className="card overflow-hidden"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-blue-100 px-5 py-4"><div><h2 className="font-bold">หมวดและวิชาเลือก</h2><p className="mt-1 text-sm text-slate-600">ยืนยันรายวิชาที่ผ่านแล้วเข้าแต่ละหมวดเพื่อสะสมหน่วยกิต</p></div><div className="flex items-center gap-3"><p className="text-sm text-slate-500">{progress.electives.length} หมวด</p><button className="btn btn-primary min-h-10 disabled:cursor-not-allowed disabled:opacity-50" disabled={!pendingElectiveSelections.length || savingAllElectives || busyRequirementId !== null} type="button" onClick={() => void confirmAllElectives()}>{savingAllElectives ? "กำลังยืนยัน…" : `ยืนยันทั้งหมด${pendingElectiveSelections.length ? ` (${pendingElectiveSelections.length})` : ""}`}</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] table-fixed text-left text-sm"><colgroup><col className="w-[29%]" /><col className="w-[25%]" /><col className="w-[12%]" /><col className="w-[34%]" /></colgroup><thead className="border-b border-blue-100 bg-slate-50 text-slate-600"><tr><th className="px-5 py-3 font-medium">หมวดหลักสูตร</th><th className="px-5 py-3 font-medium">ความก้าวหน้า</th><th className="px-5 py-3 font-medium">สถานะ</th><th className="px-5 py-3 font-medium">เพิ่มรายวิชา</th></tr></thead><tbody>{electivesSorted.map((requirement) => <ElectiveRow busy={savingAllElectives || busyRequirementId === requirement.requirementId} courses={coursesFor(requirement.requirementId)} key={requirement.requirementId} onConfirm={confirm} onSelect={(courseId) => selectCourse(requirement.requirementId, courseId)} requirement={requirement} selectedCourseId={selectedCourses[requirement.requirementId] || ""} />)}</tbody></table></div></section> : null}
    </>}
  </section>;
}
