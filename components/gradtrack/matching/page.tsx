"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronDown, CircleAlert, Link2, RefreshCw, RotateCcw, Search, X } from "lucide-react";
import { api } from "../shared/api";
import { StatusBadge } from "./status-badge";
import type { Candidate, ElectiveCategory, MatchableRequirement, MatchingApiResponse, MatchingData, MatchStatus, RequiredCourse } from "./types";


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

function ElectiveRow({ requirement, courses, selectedCourseIds, onSelect, onConfirm, busy }: {
  requirement: ElectiveCategory;
  courses: Candidate[];
  selectedCourseIds: string[];
  onSelect: (courseIds: string[]) => void;
  onConfirm: (requirement: ElectiveCategory, courseIds: string[]) => Promise<void>;
  busy: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const pickerRef = useRef<HTMLDivElement>(null);
  const status = requirement.status === "complete" ? { label: "ครบแล้ว", className: "ok", Icon: CheckCircle2 } : requirement.status === "in_progress" ? { label: "กำลังสะสม", className: "warn", Icon: CircleAlert } : { label: "ยังไม่เลือก", className: "info", Icon: CircleAlert };
  const matchedLabel = requirement.matchedCourses.length ? requirement.matchedCourses.map(course => `${course.code} — ${course.name} (${course.credits} นก.)`).join(", ") : "ยังไม่มีวิชาที่ยืนยันในหมวดนี้";
  const selectedCourses = selectedCourseIds.map((id) => courses.find((course) => course.id === id)).filter((course): course is Candidate => Boolean(course));
  const filteredCourses = courses.filter((course) => `${course.code} ${course.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  const pickerId = `elective-options-${requirement.requirementIds[0]}`;
  const toggleCourse = (courseId: string) => onSelect(selectedCourseIds.includes(courseId) ? selectedCourseIds.filter((id) => id !== courseId) : [...selectedCourseIds, courseId]);

  useEffect(() => {
    if (!isOpen) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return <tr className="border-t border-blue-100 align-middle transition-colors hover:bg-blue-50/40">
    <td className="px-5 py-3"><p className="font-semibold text-slate-800">{requirement.category}</p><p className="mt-1 text-xs text-slate-500">วิชาเลือก / หมวดหน่วยกิต</p></td>
    <td className="px-5 py-3 text-sm text-slate-700"><p className="font-medium tabular-nums">{requirement.passedCredits} / {requirement.requiredCredits} หน่วยกิต</p><p className="mt-1 text-slate-500">{matchedLabel}</p></td>
    <td className="px-5 py-3"><span className={`status shrink-0 gap-1 whitespace-nowrap ${status.className}`}><status.Icon aria-hidden="true" size={14} />{status.label}</span></td>
    <td className="px-5 py-3">
      <div className="flex items-start gap-2">
        <div className="relative min-w-0 flex-1" ref={pickerRef}>
          <div className="flex min-h-10 items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-slate-800 focus-within:ring-2 focus-within:ring-blue-300">
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {selectedCourses.length ? selectedCourses.map((course) => <span className="inline-flex max-w-full items-center gap-1 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-900" key={course.id}>{course.code}<button aria-label={`ลบ ${course.code} — ${course.name}`} className="rounded p-0.5 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500" type="button" onClick={() => toggleCourse(course.id)}><X aria-hidden="true" size={13} /></button></span>) : <span className="py-1 text-slate-500">เลือกรายวิชา</span>}
            </div>
            <button aria-controls={pickerId} aria-expanded={isOpen} aria-label="เปิดรายการรายวิชา" className="rounded p-1 text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50" disabled={busy} type="button" onClick={() => setIsOpen((open) => !open)}><ChevronDown aria-hidden="true" className={`transition-transform ${isOpen ? "rotate-180" : ""}`} size={16} /></button>
          </div>
          {isOpen ? <div className="absolute left-0 z-20 mt-1 w-full min-w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-lg" id={pickerId}><label className="flex items-center gap-2 rounded-md border border-slate-200 px-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-200"><Search aria-hidden="true" className="text-slate-400" size={16} /><input autoFocus className="h-9 min-w-0 flex-1 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" placeholder="ค้นหารหัสหรือชื่อวิชา" value={query} onChange={(event) => setQuery(event.target.value)} /></label><div className="mt-2 max-h-52 overflow-y-auto">{filteredCourses.length ? filteredCourses.map((course) => <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 text-sm text-slate-700 hover:bg-blue-50" key={course.id}><input aria-label={`${course.code} — ${course.name}`} checked={selectedCourseIds.includes(course.id)} className="size-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" type="checkbox" onChange={() => toggleCourse(course.id)} /><span className="min-w-0"><span className="font-medium text-slate-800">{course.code}</span><span className="text-slate-600"> — {course.name}</span><span className="ml-1 text-xs text-slate-500">({course.grade || "ไม่มีเกรด"})</span></span></label>) : <p className="px-2 py-3 text-sm text-slate-500">ไม่พบรายวิชา</p>}</div></div> : null}
        </div>
        <button className="btn min-h-10 shrink-0 whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50" disabled={!selectedCourseIds.length || busy} type="button" onClick={() => void onConfirm(requirement, selectedCourseIds)}>ยืนยัน</button>
      </div>
      <p className="mt-1 text-xs text-slate-500">เลือกได้หลายวิชา และค้นหาได้จากรหัสหรือชื่อวิชา</p>
    </td>
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
  const [selectedElectiveCourses, setSelectedElectiveCourses] = useState<Record<string, string[]>>({});

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
      setSelectedElectiveCourses({});
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
  const pendingCourseIds = new Set([...Object.values(selectedCourses).filter(Boolean), ...Object.values(selectedElectiveCourses).flat()]);
  const coursesFor = (requirementId: string, selectedIds: string[] = []) => data!.courses.filter((course) =>
    !matchedCourseIds.has(course.id) && (selectedCourses[requirementId] === course.id || selectedIds.includes(course.id) || !pendingCourseIds.has(course.id)),
  );
  const selectCourse = (requirementId: string, courseId: string) => {
    setSelectedCourses((current) => ({ ...current, [requirementId]: courseId }));
  };
  const selectElectiveCourses = (requirement: ElectiveCategory, courseIds: string[]) => setSelectedElectiveCourses((current) => ({ ...current, [requirement.requirementIds[0]]: courseIds }));
  const pendingElectiveSelections = progress.electives.flatMap((requirement) => {
    const courseIds = selectedElectiveCourses[requirement.requirementIds[0]] || [];
    return courseIds.map((courseId) => ({ requirementId: requirement.requirementIds[0], courseId }));
  });
  const confirmElective = async (requirement: ElectiveCategory, courseIds: string[]) => {
    setBusyRequirementId(requirement.requirementIds[0]); setError(null);
    try { await Promise.all(courseIds.map((courseId) => api("/api/matches", "POST", { courseId, requirementId: requirement.requirementIds[0], matchType: "manual", confidence: 1, status: "confirmed" }))); await load(false); setSelectedElectiveCourses((current) => { const next = { ...current }; delete next[requirement.requirementIds[0]]; return next; }); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "ยืนยันวิชาเลือกไม่สำเร็จ"); }
    finally { setBusyRequirementId(null); }
  };
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
      setSelectedElectiveCourses({});
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
    {progress.electives.length ? <section className="card overflow-hidden"><div className="flex flex-wrap items-end justify-between gap-3 border-b border-blue-100 px-5 py-4"><div><h2 className="font-bold">หมวดและวิชาเลือก</h2><p className="mt-1 text-sm text-slate-600">ยืนยันรายวิชาที่ผ่านแล้วเข้าแต่ละหมวดเพื่อสะสมหน่วยกิต</p></div><div className="flex items-center gap-3"><p className="text-sm text-slate-500">{progress.electives.length} หมวด</p><button className="btn btn-primary min-h-10 disabled:cursor-not-allowed disabled:opacity-50" disabled={!pendingElectiveSelections.length || savingAllElectives || busyRequirementId !== null} type="button" onClick={() => void confirmAllElectives()}>{savingAllElectives ? "กำลังยืนยัน…" : `ยืนยันทั้งหมด${pendingElectiveSelections.length ? ` (${pendingElectiveSelections.length})` : ""}`}</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[880px] table-fixed text-left text-sm"><colgroup><col className="w-[29%]" /><col className="w-[25%]" /><col className="w-[12%]" /><col className="w-[34%]" /></colgroup><thead className="border-b border-blue-100 bg-slate-50 text-slate-600"><tr><th className="px-5 py-3 font-medium">หมวดหลักสูตร</th><th className="px-5 py-3 font-medium">ความก้าวหน้า</th><th className="px-5 py-3 font-medium">สถานะ</th><th className="px-5 py-3 font-medium">เพิ่มรายวิชา</th></tr></thead><tbody>{electivesSorted.map((requirement) => <ElectiveRow busy={savingAllElectives || busyRequirementId === requirement.requirementIds[0]} courses={coursesFor(requirement.requirementIds[0], selectedElectiveCourses[requirement.requirementIds[0]] || [])} key={requirement.requirementIds.join("-")} onConfirm={confirmElective} onSelect={(courseIds) => selectElectiveCourses(requirement, courseIds)} requirement={requirement} selectedCourseIds={selectedElectiveCourses[requirement.requirementIds[0]] || []} />)}</tbody></table></div></section> : null}
    </>}
  </section>;
}
