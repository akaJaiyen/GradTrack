"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { AcademicProfileExtraction } from "@/lib/extraction";
import type { RequiredCourseProgress } from "@/lib/academic-progress";
import { groupCoursesByTerm } from "@/lib/course-term-summary";
import type { Course } from "@/lib/types";
import { api, coursePayload, fromCourse, grades } from "./shared";
import type { Tab } from "./shared";

type Progress = { totalCredits: number | null; passedCredits: number; required: RequiredCourseProgress[]; passedRequired: number; pendingConfirmations: number };

export function AcademicProfileReview({ tab }: { tab: Tab }) {
  const [profile, setProfile] = useState<AcademicProfileExtraction | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    try {
      const result = await api("/api/academic-profile");
      setProfile(result.data?.extraction_json || null);
      setCourses((result.courses || []).map(fromCourse));
      setProgress(result.progress || null);
      setError(null);
    } catch {
      setError("ไม่สามารถโหลด academic profile ได้");
    } finally {
      setLoaded(true);
    }
  };
  useEffect(() => { void load(); }, []);
  if (error) return <p className="text-sm text-red-700" role="alert">{error}</p>;
  if (!loaded) return <section className="card p-6"><p className="text-sm text-slate-600">กำลังโหลดข้อมูลการเรียน…</p></section>;
  if (tab === "student") return <StudentTermReview courses={courses} reload={load} />;
  if (!profile) return <section className="card p-6"><h2 className="font-bold">ยังไม่มีข้อมูลที่ AI อ่านแล้ว</h2><p className="mt-2 text-sm text-slate-600">อัปโหลดเอกสารหลักสูตร, รายวิชา หรือ Transcript จากหน้าเอกสารของฉัน</p></section>;
  const evidence = (path: string) => profile.evidence.find(item => item.path === path);
  return <div className="space-y-5">
    <section className="card p-5"><h2 className="font-bold">{profile.profile.program || "Academic profile"}</h2><p className="mt-1 text-sm text-slate-600">{[profile.profile.institution, profile.profile.curriculumYear, profile.profile.degreeLevel].filter(Boolean).join(" · ")}</p>{profile.warnings.length > 0 && <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-800">พบ {profile.warnings.length} รายการที่ควรตรวจสอบ</p>}</section>
    {progress && <section className="grid gap-3 sm:grid-cols-3"><Metric label="วิชาบังคับที่ผ่าน" value={`${progress.passedRequired}/${progress.required.length}`} /><Metric label="หน่วยกิตผ่านแล้ว" value={progress.totalCredits === null ? `${progress.passedCredits} (ยังไม่ระบุเป้าหมาย)` : `${progress.passedCredits}/${progress.totalCredits}`} /><Metric label="รอยืนยันจากชื่อวิชา" value={String(progress.pendingConfirmations)} /></section>}
    {progress && <RequiredCoursesTable rows={progress.required} refresh={load} />}
    <ProfileTable title="โครงสร้างและหน่วยกิต" headers={["หมวด", "ขั้นต่ำ (หน่วยกิต)", "หลักฐาน"]} rows={profile.curriculum.requirementGroups.filter(group => group.kind !== "container").map(group => [group.name, group.minimumCredits ?? "—", <Evidence key={group.id} item={evidence(`curriculum.requirementGroups.${group.id}`)} />])} />
    <ProfileTable title="รายวิชาในหลักสูตร" headers={["รหัส", "ชื่อรายวิชา", "หน่วยกิต", "Prerequisite"]} rows={profile.catalogCourses.map(course => [course.code, course.nameTh || course.nameEn || "—", course.credits ?? "—", course.prerequisiteCodes.join(", ") || "—"])} />
    {profile.unresolvedCourses.length > 0 && <ProfileTable title="รายการที่ AI ระบุรหัสวิชาไม่ได้" headers={["ข้อความต้นทาง", "เหตุผล"]} rows={profile.unresolvedCourses.map(course => [course.sourceText, course.reason])} />}
    {profile.warnings.length > 0 && <section className="card p-5"><h2 className="font-bold">คำเตือน</h2><ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-800">{profile.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></section>}
  </div>;
}

type CourseField = "code" | "nameTh" | "credits" | "grade" | "term" | "year";

function StudentTermReview({ courses, reload }: { courses: Course[]; reload: () => Promise<void> }) {
  const [rows, setRows] = useState<Course[]>(courses);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, Partial<Record<CourseField, string>>>>({});
  const [openTerms, setOpenTerms] = useState<Set<string>>(new Set());
  const initialized = useRef(false);
  useEffect(() => setRows(courses), [courses]);
  const terms = useMemo(() => groupCoursesByTerm(rows), [rows]);
  useEffect(() => {
    if (!initialized.current && terms.length) {
      initialized.current = true;
      setOpenTerms(new Set([terms[terms.length - 1].key]));
    }
  }, [terms]);

  const update = (id: string, field: CourseField, value: string | number | undefined) => {
    setMessage(null);
    setRows((current) => current.map((course) => course.id === id ? { ...course, [field]: value } : course));
    setErrors((current) => ({ ...current, [id]: { ...current[id], [field]: undefined } }));
  };
  const addCourse = () => {
    const id = `new-${crypto.randomUUID()}`;
    setRows((current) => [...current, { id, code: "", nameTh: "", credits: 3 }]);
    setOpenTerms((current) => new Set(current).add("unknown:unknown"));
  };
  const remove = (id: string) => {
    setRows((current) => current.filter((course) => course.id !== id));
    setMessage(null);
  };
  const validate = () => {
    const next: Record<string, Partial<Record<CourseField, string>>> = {};
    for (const course of rows) {
      const fieldErrors: Partial<Record<CourseField, string>> = {};
      if (!course.code.trim()) fieldErrors.code = "กรุณากรอกรหัสวิชา";
      if (!course.nameTh.trim()) fieldErrors.nameTh = "กรุณากรอกชื่อรายวิชา";
      if (!Number.isFinite(course.credits) || course.credits <= 0) fieldErrors.credits = "หน่วยกิตต้องมากกว่า 0";
      if (course.year !== undefined && (course.year < 1900 || course.year > 3000)) fieldErrors.year = "ปีการศึกษาต้องอยู่ระหว่าง 1900–3000";
      if (Object.keys(fieldErrors).length) next[course.id] = fieldErrors;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const save = async () => {
    if (!validate()) {
      setMessage("กรุณาตรวจสอบช่องที่มีข้อผิดพลาดก่อนบันทึก");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      const persisted = new Set(courses.map((course) => course.id));
      await Promise.all([
        ...rows.map((course) => course.id.startsWith("new-") ? api("/api/courses", "POST", coursePayload(course)) : api(`/api/courses/${course.id}`, "PATCH", coursePayload(course))),
        ...courses.filter((course) => persisted.has(course.id) && !rows.some((row) => row.id === course.id)).map((course) => api(`/api/courses/${course.id}`, "DELETE")),
      ]);
      await reload();
      setMessage("บันทึกผลการเรียนแล้ว");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "บันทึกผลการเรียนไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  };
  const toggle = (key: string) => setOpenTerms((current) => {
    const next = new Set(current);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return <section className="space-y-5">
    <section className="card p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-bold">ผลการเรียนแยกตามเทอม</h2><p className="mt-1 text-sm text-slate-600">แก้ไขข้อมูลรายวิชา แล้วบันทึกเพื่อใช้คำนวณความก้าวหน้า</p></div>
        <button className="btn inline-flex min-h-11 items-center gap-2" type="button" onClick={addCourse}><Plus size={16} aria-hidden="true" />เพิ่มรายวิชา</button>
      </div>
      {message && <p className={`mt-3 text-sm ${Object.keys(errors).length ? "text-red-700" : "text-blue-700"}`} role={Object.keys(errors).length ? "alert" : "status"}>{message}</p>}
    </section>
    {terms.length ? terms.map((term) => {
      const isOpen = openTerms.has(term.key);
      const termGpa = term.summary.gradedCredits ? term.summary.gpa.toFixed(2) : "—";
      const cumulativeGpa = term.cumulative.gradedCredits ? term.cumulative.gpa.toFixed(2) : "—";
      return <section className="card overflow-hidden" key={term.key}>
        <button aria-controls={`term-${term.key}`} aria-expanded={isOpen} className="flex min-h-14 w-full items-center justify-between gap-3 p-4 text-left hover:bg-blue-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-blue-400" type="button" onClick={() => toggle(term.key)}>
          <span><span className="block font-bold">{term.label}</span><span className="mt-1 block text-sm text-slate-600">ผ่าน {term.summary.passedCredits} หน่วยกิต · GPA {termGpa} · GPA สะสม {cumulativeGpa}</span></span>
          <ChevronDown aria-hidden="true" className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen ? <div id={`term-${term.key}`} className="border-t">
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-4 py-3 font-medium">รหัส</th><th className="px-4 py-3 font-medium">ชื่อรายวิชา</th><th className="px-4 py-3 font-medium">หน่วยกิต</th><th className="px-4 py-3 font-medium">เกรด</th><th className="px-4 py-3 font-medium">เทอม</th><th className="px-4 py-3 font-medium">ปีการศึกษา</th><th className="px-4 py-3"><span className="sr-only">การจัดการ</span></th></tr></thead><tbody>{term.courses.map((course) => <CourseDesktopRow course={course} errors={errors[course.id]} key={course.id} onChange={update} onRemove={remove} />)}</tbody></table></div>
          <div className="grid gap-3 p-4 md:hidden">{term.courses.map((course) => <CourseMobileCard course={course} errors={errors[course.id]} key={course.id} onChange={update} onRemove={remove} />)}</div>
        </div> : null}
      </section>;
    }) : <section className="card p-6 text-sm text-slate-600">ยังไม่มีรายวิชา เพิ่มรายวิชาเพื่อเริ่มบันทึกผลการเรียน</section>}
    <div className="flex justify-end"><button className="btn btn-primary min-h-11 disabled:cursor-wait disabled:opacity-60" disabled={saving} type="button" onClick={() => void save()}>{saving ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}</button></div>
  </section>;
}

function CourseDesktopRow({ course, errors, onChange, onRemove }: { course: Course; errors?: Partial<Record<CourseField, string>>; onChange: (id: string, field: CourseField, value: string | number | undefined) => void; onRemove: (id: string) => void }) {
  return <tr className="border-t align-top"><td className="px-4 py-3"><CourseInput course={course} field="code" errors={errors} onChange={onChange} /></td><td className="px-4 py-3"><CourseInput course={course} field="nameTh" errors={errors} onChange={onChange} /></td><td className="px-4 py-3"><CourseInput course={course} field="credits" errors={errors} onChange={onChange} /></td><td className="px-4 py-3"><CourseInput course={course} field="grade" errors={errors} onChange={onChange} /></td><td className="px-4 py-3"><CourseInput course={course} field="term" errors={errors} onChange={onChange} /></td><td className="px-4 py-3"><CourseInput course={course} field="year" errors={errors} onChange={onChange} /></td><td className="px-4 py-3"><button className="min-h-11 rounded px-2 text-red-700 hover:bg-red-50" type="button" aria-label={`ลบ ${course.code || "รายวิชา"}`} onClick={() => onRemove(course.id)}><Trash2 size={17} aria-hidden="true" /></button></td></tr>;
}

function CourseMobileCard({ course, errors, onChange, onRemove }: { course: Course; errors?: Partial<Record<CourseField, string>>; onChange: (id: string, field: CourseField, value: string | number | undefined) => void; onRemove: (id: string) => void }) {
  return <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="sr-only">ข้อมูลรายวิชา</legend><div className="grid gap-3"><LabeledCourseInput label="รหัสวิชา" course={course} field="code" errors={errors} onChange={onChange} /><LabeledCourseInput label="ชื่อรายวิชา" course={course} field="nameTh" errors={errors} onChange={onChange} /><div className="grid grid-cols-2 gap-3"><LabeledCourseInput label="หน่วยกิต" course={course} field="credits" errors={errors} onChange={onChange} /><LabeledCourseInput label="เกรด" course={course} field="grade" errors={errors} onChange={onChange} /></div><div className="grid grid-cols-2 gap-3"><LabeledCourseInput label="เทอม" course={course} field="term" errors={errors} onChange={onChange} /><LabeledCourseInput label="ปีการศึกษา" course={course} field="year" errors={errors} onChange={onChange} /></div><button className="min-h-11 self-start rounded px-2 text-left text-red-700 hover:bg-red-50" type="button" onClick={() => onRemove(course.id)}>ลบรายวิชา</button></div></fieldset>;
}

function LabeledCourseInput({ label, ...props }: { label: string; course: Course; field: CourseField; errors?: Partial<Record<CourseField, string>>; onChange: (id: string, field: CourseField, value: string | number | undefined) => void }) { return <label className="grid gap-1 text-sm font-medium text-slate-700"><span>{label}</span><CourseInput {...props} /></label>; }

function CourseInput({ course, field, errors, onChange }: { course: Course; field: CourseField; errors?: Partial<Record<CourseField, string>>; onChange: (id: string, field: CourseField, value: string | number | undefined) => void }) {
  const error = errors?.[field];
  const className = `min-h-11 w-full rounded border bg-white px-2 text-sm ${error ? "border-red-500" : "border-slate-300"}`;
  const label = { code: "รหัสวิชา", nameTh: "ชื่อรายวิชา", credits: "หน่วยกิต", grade: "เกรด", term: "เทอม", year: "ปีการศึกษา" }[field];
  if (field === "grade") return <select aria-label={label} className={className} value={course.grade || ""} onChange={(event) => onChange(course.id, field, event.target.value || undefined)}>{["", ...grades].map((grade) => <option key={grade} value={grade}>{grade || "—"}</option>)}</select>;
  if (field === "term" || field === "year") return <DeferredCourseInput className={className} course={course} error={error} field={field} label={label} onChange={onChange} />;
  const type = field === "credits" ? "number" : "text";
  const value = course[field] ?? "";
  return <><input aria-invalid={Boolean(error)} aria-label={label} className={className} min={field === "credits" ? ".5" : undefined} step={field === "credits" ? ".5" : undefined} type={type} value={value} onChange={(event) => onChange(course.id, field, field === "credits" ? (event.target.value === "" ? undefined : Number(event.target.value)) : event.target.value)} />{error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}</>;
}

function DeferredCourseInput({ className, course, error, field, label, onChange }: { className: string; course: Course; error?: string; field: "term" | "year"; label: string; onChange: (id: string, field: CourseField, value: string | number | undefined) => void }) {
  const [value, setValue] = useState(String(course[field] ?? ""));
  const commit = () => onChange(course.id, field, value === "" ? undefined : field === "year" ? Number(value) : value);
  return <><input aria-invalid={Boolean(error)} aria-label={label} className={className} min={field === "year" ? "1900" : undefined} max={field === "year" ? "3000" : undefined} step={field === "year" ? "1" : undefined} type={field === "year" ? "number" : "text"} value={value} onBlur={commit} onChange={(event) => setValue(event.target.value)} />{error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}</>;
}

function Metric({ label, value }: { label: string; value: string }) { return <section className="card p-4"><p className="text-sm text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></section>; }
const statusLabel: Record<RequiredCourseProgress["status"], string> = { passed: "ผ่านแล้ว", not_passed: "พบวิชา แต่เกรดไม่ผ่าน", missing: "ยังไม่พบใน Transcript", needs_confirmation: "รอยืนยันการจับคู่" };
function RequiredCoursesTable({ rows, refresh }: { rows: RequiredCourseProgress[]; refresh: () => Promise<unknown> }) {
  const [busy, setBusy] = useState<string | null>(null);
  async function confirm(requirementId: string, courseId: string) { setBusy(`${requirementId}:${courseId}`); try { await api("/api/matches", "POST", { courseId, requirementId, matchType: "manual", confidence: 1, status: "confirmed" }); await refresh(); } finally { setBusy(null); } }
  return <section className="card overflow-x-auto"><h2 className="p-5 font-bold">ตรวจวิชาบังคับจาก Study Plan</h2><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-5 py-3 font-medium">รหัส</th><th className="px-5 py-3 font-medium">ชื่อวิชา</th><th className="px-5 py-3 font-medium">หน่วยกิต</th><th className="px-5 py-3 font-medium">สถานะ</th><th className="px-5 py-3 font-medium">การจับคู่</th></tr></thead><tbody>{rows.length ? rows.map(row => <tr className="border-t" key={row.requirementId}><td className="px-5 py-3">{row.code || "—"}</td><td className="px-5 py-3">{row.name || "—"}</td><td className="px-5 py-3">{row.credits ?? "—"}</td><td className="px-5 py-3">{statusLabel[row.status]}</td><td className="px-5 py-3">{row.status === "needs_confirmation" ? <div className="grid gap-2">{row.candidates.map(candidate => <button className="text-left text-blue-700 underline disabled:text-slate-400" disabled={busy !== null} key={candidate.id} onClick={() => void confirm(row.requirementId, candidate.id)}>ยืนยัน {candidate.code} — {candidate.name} ({Math.round(candidate.score * 100)}%)</button>)}</div> : row.candidates[0] ? `${row.candidates[0].code} — ${row.candidates[0].name}` : "—"}</td></tr>) : <tr><td className="px-5 py-4 text-slate-500" colSpan={5}>ไม่พบวิชาบังคับที่ระบุได้ใน Study Plan</td></tr>}</tbody></table></section>;
}

function Evidence({ item }: { item: AcademicProfileExtraction["evidence"][number] | undefined }) { return item ? <span title={item.text} className="text-xs text-slate-500">หน้า {item.page || "—"}: {item.text}</span> : <span className="text-xs text-slate-400">—</span>; }
function ProfileTable({ title, headers, rows }: { title: string; headers: string[]; rows: ReactNode[][] }) { return <section className="card overflow-x-auto"><h2 className="p-5 font-bold">{title}</h2><table className="w-full text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr>{headers.map(header => <th className="px-5 py-3 font-medium" key={header}>{header}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr className="border-t" key={index}>{row.map((cell, cellIndex) => <td className="px-5 py-3" key={cellIndex}>{cell}</td>)}</tr>) : <tr><td className="px-5 py-4 text-slate-500" colSpan={headers.length}>ไม่พบข้อมูลในเอกสาร</td></tr>}</tbody></table></section>; }
