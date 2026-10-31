"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import type { AcademicProfileExtraction } from "@/lib/extraction";
import { groupCoursesByTerm } from "@/lib/course-term-summary";
import { academicTermLabels, academicTerms } from "@/lib/academic-term";
import type { Course } from "@/lib/types";
import { coursePayload, fromCourse, grades, type Tab } from "../shared/academic";
import { api } from "../shared/api";

type TranscriptDraft = { id: string; code: string; name: string; credits: number | string; grade: Course["grade"] | null; term: Course["term"] | null; year: number | null; status: "ready" | "needs_review"; parser: "ku_pdf" | "ai"; evidence: { page: number; rowText: string; termHeader: string } };

export function AcademicProfileReview({ tab }: { tab: Tab }) {
  const [profile, setProfile] = useState<AcademicProfileExtraction | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [drafts, setDrafts] = useState<TranscriptDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const load = async () => {
    try {
      const result = await api("/api/academic-profile");
      setProfile(result.data?.extraction_json || null);
      setCourses((result.courses || []).map(fromCourse));
      setDrafts(result.drafts || []);
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
  if (tab === "student") return <UnifiedTermReview courses={courses} drafts={drafts} reload={load} />;
  if (!profile) return <section className="card p-6"><h2 className="font-bold">ยังไม่มีข้อมูลที่ AI อ่านแล้ว</h2><p className="mt-2 text-sm text-slate-600">อัปโหลดเอกสารหลักสูตร, รายวิชา หรือ Transcript จากหน้าเอกสารของฉัน</p></section>;
  return <CurriculumReview profile={profile} reload={load} />;
}

type EditableCurriculumCourse = { id: string; groupName: string; code: string; nameTh: string; credits: number; evidencePath: string };
type EditableCreditBucket = { id: string; parentGroupName: string; name: string; minimumCredits: number };

function CurriculumReview({ profile, reload }: { profile: AcademicProfileExtraction; reload: () => Promise<void> }) {
  const [rows, setRows] = useState<EditableCurriculumCourse[]>(() => rowsFromProfile(profile));
  const [buckets, setBuckets] = useState<EditableCreditBucket[]>(() => bucketsFromProfile(profile));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => { setRows(rowsFromProfile(profile)); setBuckets(bucketsFromProfile(profile)); setDirty(false); }, [profile]);
  const update = (id: string, field: keyof Omit<EditableCurriculumCourse, "id" | "evidencePath">, value: string | number) => {
    setRows(current => current.map(row => row.id === id ? { ...row, [field]: value } : row));
    setDirty(true);
    setMessage(null);
  };
  const add = () => { setRows(current => [...current, { id: crypto.randomUUID(), groupName: "ยังไม่ระบุกลุ่ม", code: "", nameTh: "", credits: 3, evidencePath: "curriculum.requiredCourses" }]); setDirty(true); };
  const remove = (id: string) => { setRows(current => current.filter(row => row.id !== id)); setDirty(true); setMessage(null); };
  const updateBucket = (id: string, field: keyof Omit<EditableCreditBucket, "id">, value: string | number) => { setBuckets(current => current.map(bucket => bucket.id === id ? { ...bucket, [field]: value } : bucket)); setDirty(true); setMessage(null); };
  const addBucket = () => { setBuckets(current => [...current, { id: crypto.randomUUID(), parentGroupName: "ยังไม่ระบุกลุ่ม", name: "วิชาเลือก", minimumCredits: 3 }]); setDirty(true); };
  const removeBucket = (id: string) => { setBuckets(current => current.filter(bucket => bucket.id !== id)); setDirty(true); setMessage(null); };
  const save = async () => {
    if (rows.some(row => !row.nameTh.trim() || !Number.isFinite(row.credits) || row.credits <= 0) || buckets.some(bucket => !bucket.name.trim() || !Number.isFinite(bucket.minimumCredits) || bucket.minimumCredits <= 0)) {
      setMessage("กรุณากรอกชื่อรายวิชาและหน่วยกิตที่มากกว่า 0 ให้ครบก่อนบันทึก");
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api("/api/academic-profile", "PATCH", { extraction: profileFromRows(profile, rows, buckets) });
      await reload();
      setDirty(false);
      setMessage("บันทึกข้อมูลหลักสูตรแล้ว ข้อมูลนี้จะถูกใช้ในหน้าจับคู่รายวิชาต่อไป");
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "บันทึกข้อมูลหลักสูตรไม่สำเร็จ");
    } finally { setSaving(false); }
  };
  return <section className="space-y-4" data-dirty={dirty ? "true" : undefined}>
    <section className="card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">ตรวจสอบข้อมูลหลักสูตรจากเอกสาร</h2><p className="mt-1 text-sm text-slate-600">ตรวจ แก้ไข เพิ่ม หรือลบรายการให้ตรงกับ Study Plan ก่อนนำไปจับคู่รายวิชา</p></div><button className="btn btn-primary min-h-10 py-2 disabled:cursor-wait disabled:opacity-60" disabled={saving} type="button" onClick={() => void save()}>{saving ? "กำลังบันทึก…" : "บันทึกข้อมูลหลักสูตร"}</button></div>{message ? <p className={`mt-3 text-sm ${message.startsWith("บันทึก") ? "text-blue-700" : "text-red-700"}`} role="status">{message}</p> : null}</section>
    <section className="card overflow-x-auto"><div className="flex flex-wrap items-center justify-between gap-2 p-4"><div><h3 className="font-bold">รายวิชาที่อ่านจาก Study Plan</h3><p className="mt-1 text-xs text-slate-600">รหัสที่ลงท้ายด้วย x เช่น 01175xxx หมายถึงเลือกรายวิชาใดก็ได้ที่ขึ้นต้นด้วยรหัสดังกล่าว</p></div><button className="btn inline-flex min-h-10 items-center gap-2 py-2" type="button" onClick={add}><Plus size={16} aria-hidden="true" />เพิ่มรายวิชา</button></div><table className="w-full min-w-[620px] text-left text-sm"><colgroup><col /><col /><col className="w-48" /><col className="w-14" /></colgroup><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 font-medium">รหัส</th><th className="px-3 py-2 font-medium">ชื่อรายวิชา</th><th className="px-3 py-2 font-medium">หน่วยกิต</th><th className="px-3 py-2"><span className="sr-only">ลบ</span></th></tr></thead><tbody>{rows.map(row => <tr className="border-t align-top" key={row.id}><td className="px-3 py-2"><CurriculumInput ariaLabel="รหัสวิชา" value={row.code} onChange={value => update(row.id, "code", value)} /></td><td className="px-3 py-2"><CurriculumInput ariaLabel="ชื่อรายวิชา" value={row.nameTh} onChange={value => update(row.id, "nameTh", value)} /></td><td className="px-3 py-2"><CurriculumInput ariaLabel="หน่วยกิต" type="number" value={row.credits} onChange={value => update(row.id, "credits", Number(value))} /></td><td className="px-3 py-2"><button aria-label={`ลบ ${row.code || row.nameTh || "รายวิชา"}`} className="min-h-9 rounded px-2 text-red-700 hover:bg-red-50" type="button" onClick={() => remove(row.id)}><Trash2 size={17} aria-hidden="true" /></button></td></tr>)}</tbody></table>{rows.length === 0 ? <p className="p-5 text-sm text-slate-600">ยังไม่มีรายวิชา เพิ่มรายการจาก Study Plan ได้</p> : null}</section>
    <section className="card overflow-x-auto"><div className="flex flex-wrap items-center justify-between gap-2 p-4"><div><h3 className="font-bold">หมวดหรือวิชาเลือก</h3><p className="mt-1 text-sm text-slate-600">ใช้กับบรรทัดที่เอกสารไม่ได้ระบุรหัส และบอกเพียงว่าต้องเลือกเรียนในหมวดนั้น</p></div><button className="btn inline-flex min-h-10 items-center gap-2 py-2" type="button" onClick={addBucket}><Plus size={16} aria-hidden="true" />เพิ่มหมวด</button></div><table className="w-full min-w-[620px] text-left text-sm"><colgroup><col /><col className="w-48" /><col className="w-14" /></colgroup><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 font-medium">ชื่อหมวด</th><th className="px-3 py-2 font-medium">หน่วยกิตขั้นต่ำ</th><th className="px-3 py-2"><span className="sr-only">ลบ</span></th></tr></thead><tbody>{buckets.map(bucket => <tr className="border-t align-top" key={bucket.id}><td className="px-3 py-2"><CurriculumInput ariaLabel="ชื่อหมวดวิชาเลือก" value={bucket.name} onChange={value => updateBucket(bucket.id, "name", value)} /></td><td className="px-3 py-2"><CurriculumInput ariaLabel="หน่วยกิตขั้นต่ำของหมวด" type="number" value={bucket.minimumCredits} onChange={value => updateBucket(bucket.id, "minimumCredits", Number(value))} /></td><td className="px-3 py-2"><button aria-label={`ลบหมวด ${bucket.name || "วิชาเลือก"}`} className="min-h-9 rounded px-2 text-red-700 hover:bg-red-50" type="button" onClick={() => removeBucket(bucket.id)}><Trash2 size={17} aria-hidden="true" /></button></td></tr>)}</tbody></table>{buckets.length === 0 ? <p className="p-5 text-sm text-slate-600">ยังไม่พบหมวดเลือกเรียน เพิ่มจาก Study Plan ได้</p> : null}</section>
  </section>;
}

function CurriculumInput({ ariaLabel, type = "text", value, onChange }: { ariaLabel: string; type?: "text" | "number"; value: string | number; onChange: (value: string) => void }) { return <input aria-label={ariaLabel} className="min-h-9 w-full rounded border border-slate-300 bg-white px-2 text-sm" min={type === "number" ? ".5" : undefined} step={type === "number" ? ".5" : undefined} type={type} value={value} onChange={event => onChange(event.target.value)} />; }

function rowsFromProfile(profile: AcademicProfileExtraction): EditableCurriculumCourse[] {
  const groups = new Map(profile.curriculum.requirementGroups.map(group => [group.id, group.name]));
  return profile.curriculum.requiredCourses.map(course => ({ id: course.id, groupName: course.groupId ? groups.get(course.groupId) || "ยังไม่ระบุกลุ่ม" : "ยังไม่ระบุกลุ่ม", code: course.code || "", nameTh: course.nameTh || course.nameEn || "", credits: course.credits || 0, evidencePath: course.evidencePath }));
}

function bucketsFromProfile(profile: AcademicProfileExtraction): EditableCreditBucket[] {
  const groups = new Map(profile.curriculum.requirementGroups.map(group => [group.id, group]));
  return profile.curriculum.requirementGroups.filter(group => group.kind === "elective_bucket" || group.kind === "credit_bucket").map(group => ({ id: group.id, parentGroupName: group.parentId ? groups.get(group.parentId)?.name || "ยังไม่ระบุกลุ่ม" : "ยังไม่ระบุกลุ่ม", name: group.name, minimumCredits: group.minimumCredits || 0 }));
}

function profileFromRows(profile: AcademicProfileExtraction, rows: EditableCurriculumCourse[], buckets: EditableCreditBucket[]): AcademicProfileExtraction {
  const groups = [...new Map(rows.map(row => [row.groupName.trim() || "ยังไม่ระบุกลุ่ม", row])).values()];
  const groupId = new Map(groups.map((group, index) => [group.groupName.trim() || "ยังไม่ระบุกลุ่ม", `review-group-${index + 1}`]));
  const parentNames = [...new Set([...groups.map(group => group.groupName.trim() || "ยังไม่ระบุกลุ่ม"), ...buckets.map(bucket => bucket.parentGroupName.trim() || "ยังไม่ระบุกลุ่ม")])];
  const ids = new Map(parentNames.map((name, index) => [name, `review-group-${index + 1}`]));
  return { ...profile, curriculum: { ...profile.curriculum, requirementGroups: [
    ...parentNames.map(name => ({ id: ids.get(name)!, parentId: null, name, kind: "required_bucket" as const, minimumCredits: null, requiredCourseCodes: rows.filter(row => (row.groupName.trim() || "ยังไม่ระบุกลุ่ม") === name && row.code.trim()).map(row => row.code.trim()) })),
    ...buckets.map((bucket, index) => ({ id: bucket.id || `review-elective-${index + 1}`, parentId: ids.get(bucket.parentGroupName.trim() || "ยังไม่ระบุกลุ่ม")!, name: bucket.name.trim(), kind: "elective_bucket" as const, minimumCredits: Number(bucket.minimumCredits), requiredCourseCodes: [] })),
  ], requiredCourses: rows.map((row, index) => ({ id: row.id, groupId: ids.get(row.groupName.trim() || "ยังไม่ระบุกลุ่ม")!, code: row.code.trim() || null, nameTh: row.nameTh.trim(), nameEn: null, credits: Number(row.credits), evidencePath: row.evidencePath || `curriculum.requiredCourses.${index}` })) }, catalogCourses: rows.filter(row => row.code.trim() && !/X/.test(row.code)).map(row => ({ code: row.code.trim(), nameTh: row.nameTh.trim(), nameEn: null, credits: Number(row.credits), prerequisiteCodes: [], requirementGroupIds: [ids.get(row.groupName.trim() || "ยังไม่ระบุกลุ่ม")!] })) };
}

type CourseField = "code" | "nameTh" | "credits" | "grade" | "term" | "year";
type ReviewCourse = Course & { draftId?: string };

function UnifiedTermReview({ courses, drafts, reload }: { courses: Course[]; drafts: TranscriptDraft[]; reload: () => Promise<void> }) {
  const initialRows = (): ReviewCourse[] => [...courses, ...drafts.map(draft => ({ id: `draft-${draft.id}`, draftId: draft.id, code: draft.code, nameTh: draft.name, credits: Number(draft.credits), grade: draft.grade || undefined, term: draft.term || undefined, year: draft.year || undefined }))];
  const [rows, setRows] = useState<ReviewCourse[]>(initialRows);
  const [removedDraftIds, setRemovedDraftIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, Partial<Record<CourseField, string>>>>({});
  const [openTerms, setOpenTerms] = useState<Set<string>>(() => new Set());
  const initialized = useRef(false);
  useEffect(() => { setRows(initialRows()); setRemovedDraftIds([]); }, [courses, drafts]);
  const terms = useMemo(() => groupCoursesByTerm(rows), [rows]);
  useEffect(() => {
    if (!initialized.current && terms.length) {
      initialized.current = true;
      setOpenTerms(new Set([terms[0].key]));
    }
  }, [terms]);
  const update = (id: string, field: CourseField, value: string | number | undefined) => {
    setRows(current => current.map(course => course.id === id ? { ...course, [field]: value } : course));
    setErrors(current => ({ ...current, [id]: { ...current[id], [field]: undefined } }));
    setMessage(null);
  };
  const addCourse = () => {
    const firstTerm = terms[0];
    setRows(current => [{ id: `new-${crypto.randomUUID()}`, code: "", nameTh: "", credits: 3, term: firstTerm?.term || undefined, year: firstTerm?.year || undefined }, ...current]);
    if (firstTerm) setOpenTerms(current => new Set(current).add(firstTerm.key));
  };
  const remove = (id: string) => {
    const draftId = rows.find(course => course.id === id)?.draftId;
    if (draftId) setRemovedDraftIds(current => [...current, draftId]);
    setRows(current => current.filter(course => course.id !== id));
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
  const saveAndConfirm = async () => {
    if (!validate()) { setMessage("กรุณาตรวจสอบช่องที่มีข้อผิดพลาดก่อนบันทึก"); return; }
    setSaving(true);
    setMessage(null);
    try {
      const confirmedRows = rows.filter(course => !course.draftId);
      const draftRows = rows.filter((course): course is ReviewCourse & { draftId: string } => Boolean(course.draftId));
      const persisted = new Set(courses.map(course => course.id));
      await Promise.all([
        ...confirmedRows.map(course => course.id.startsWith("new-") ? api("/api/courses", "POST", coursePayload(course)) : api(`/api/courses/${course.id}`, "PATCH", coursePayload(course))),
        ...courses.filter(course => persisted.has(course.id) && !confirmedRows.some(row => row.id === course.id)).map(course => api(`/api/courses/${course.id}`, "DELETE")),
        ...removedDraftIds.map(draftId => api(`/api/transcript-drafts/${draftId}`, "DELETE")),
      ]);
      await Promise.all(draftRows.map(course => api(`/api/transcript-drafts/${course.draftId}`, "PATCH", { code: course.code, name: course.nameTh, credits: Number(course.credits), grade: course.grade || null, term: course.term || null, year: course.year || null })));
      if (draftRows.length) await api("/api/transcript-drafts/confirm", "POST", { draftIds: draftRows.map(course => course.draftId) });
      await reload();
      setMessage("บันทึกและยืนยันผลการเรียนแล้ว");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "บันทึกผลการเรียนไม่สำเร็จ"); }
    finally { setSaving(false); }
  };
  const toggle = (key: string) => setOpenTerms(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  return <section className="space-y-4">
    <section className="card p-5"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold">ผลการเรียนแยกตามเทอม</h2><p className="mt-1 text-sm text-slate-600">ตรวจ แก้ไข เพิ่ม หรือลบรายวิชา แล้วบันทึกและยืนยันทั้งหมดในครั้งเดียว</p></div><div className="flex flex-wrap gap-2"><button className="btn btn-primary min-h-11 disabled:cursor-wait disabled:opacity-60" disabled={saving} type="button" onClick={() => void saveAndConfirm()}>{saving ? "กำลังบันทึกและยืนยัน…" : "บันทึกและยืนยันผลการเรียน"}</button><button className="btn inline-flex min-h-10 items-center gap-2 py-2" type="button" onClick={addCourse}><Plus size={16} aria-hidden="true" />เพิ่มรายวิชา</button></div></div>{message ? <p className={`mt-3 text-sm ${Object.keys(errors).length ? "text-red-700" : "text-blue-700"}`} role={Object.keys(errors).length ? "alert" : "status"}>{message}</p> : null}</section>
    {terms.length ? terms.map(term => { const isOpen = openTerms.has(term.key); const termGpa = term.summary.gradedCredits ? term.summary.gpa.toFixed(2) : "—"; const gpax = term.cumulative.gradedCredits ? term.cumulative.gpa.toFixed(2) : "—"; return <section className="card overflow-hidden" key={term.key}><button aria-controls={`term-${term.key}`} aria-expanded={isOpen} className="flex min-h-14 w-full flex-wrap items-center gap-3 p-4 text-left hover:bg-blue-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-blue-400" type="button" onClick={() => toggle(term.key)}><span className="min-w-[10rem] flex-1 font-bold">{term.label}</span><span className="order-3 grid basis-full grid-cols-3 divide-x divide-blue-100 overflow-hidden rounded-md border border-blue-100 bg-blue-50 text-center sm:order-none sm:basis-auto sm:min-w-[22rem]"><span className="px-2 py-1"><span className="block text-xs font-normal text-slate-600">หน่วยกิตผ่าน</span><span className="block tabular-nums text-sm font-bold">{term.summary.passedCredits}</span></span><span className="px-2 py-1"><span className="block text-xs font-normal text-slate-600">GPA</span><span className="block tabular-nums text-sm font-bold">{termGpa}</span></span><span className="px-2 py-1"><span className="block text-xs font-normal text-slate-600">GPAX</span><span className="block tabular-nums text-sm font-bold">{gpax}</span></span></span><ChevronDown aria-hidden="true" className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>{isOpen ? <div id={`term-${term.key}`} className="border-t"><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 font-medium">รหัส</th><th className="px-3 py-2 font-medium">ชื่อรายวิชา</th><th className="px-3 py-2 font-medium">หน่วยกิต</th><th className="px-3 py-2 font-medium">เกรด</th><th className="px-3 py-2 font-medium">เทอม</th><th className="px-3 py-2 font-medium">ปีการศึกษา</th><th className="px-3 py-2"><span className="sr-only">การจัดการ</span></th></tr></thead><tbody>{term.courses.map(course => <CourseDesktopRow course={course} errors={errors[course.id]} key={course.id} onChange={update} onRemove={remove} />)}</tbody></table></div><div className="grid gap-2 p-3 md:hidden">{term.courses.map(course => <CourseMobileCard course={course} errors={errors[course.id]} key={course.id} onChange={update} onRemove={remove} />)}</div></div> : null}</section>; }) : <section className="card p-5 text-sm text-slate-600">ยังไม่มีรายวิชา เพิ่มรายวิชาเพื่อเริ่มบันทึกผลการเรียน</section>}
  </section>;
}

function StudentTermReview({ courses, drafts, reload }: { courses: Course[]; drafts: TranscriptDraft[]; reload: () => Promise<void> }) {
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
      setOpenTerms(new Set([terms[0].key]));
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
  return <section className="space-y-3">
    <TranscriptDraftReview drafts={drafts} reload={reload} />
    <section className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h2 className="font-bold">ผลการเรียนแยกตามเทอม</h2><p className="mt-1 text-sm text-slate-600">แก้ไขข้อมูลรายวิชา แล้วบันทึกเพื่อใช้คำนวณความก้าวหน้า</p></div>
        <button className="btn inline-flex min-h-10 items-center gap-2 py-2" type="button" onClick={addCourse}><Plus size={16} aria-hidden="true" />เพิ่มรายวิชา</button>
      </div>
      {message && <p className={`mt-3 text-sm ${Object.keys(errors).length ? "text-red-700" : "text-blue-700"}`} role={Object.keys(errors).length ? "alert" : "status"}>{message}</p>}
    </section>
    {terms.length ? terms.map((term) => {
      const isOpen = openTerms.has(term.key);
      const termGpa = term.summary.gradedCredits ? term.summary.gpa.toFixed(2) : "—";
      const cumulativeGpa = term.cumulative.gradedCredits ? term.cumulative.gpa.toFixed(2) : "—";
      return <section className="card overflow-hidden" key={term.key}>
        <button aria-controls={`term-${term.key}`} aria-expanded={isOpen} className="flex min-h-14 w-full flex-wrap items-center gap-3 px-3 py-2 text-left hover:bg-blue-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-blue-400" type="button" onClick={() => toggle(term.key)}>
          <span className="min-w-[10rem] flex-1 font-bold">{term.label}</span>
          <span className="order-3 grid basis-full grid-cols-3 divide-x divide-blue-100 overflow-hidden rounded-md border border-blue-100 bg-blue-50 text-center sm:order-none sm:basis-auto sm:min-w-[22rem]">
            <span className="px-2 py-1"><span className="block text-xs font-normal text-slate-600">หน่วยกิตผ่าน</span><span className="block tabular-nums text-sm font-bold">{term.summary.passedCredits}</span></span>
            <span className="px-2 py-1"><span className="block text-xs font-normal text-slate-600">GPA เทอม</span><span className="block tabular-nums text-sm font-bold">{termGpa}</span></span>
            <span className="px-2 py-1"><span className="block text-xs font-normal text-slate-600">GPA สะสม</span><span className="block tabular-nums text-sm font-bold">{cumulativeGpa}</span></span>
          </span>
          <ChevronDown aria-hidden="true" className={`shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
        </button>
        {isOpen ? <div id={`term-${term.key}`} className="border-t">
          <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-slate-50 text-slate-600"><tr><th className="px-3 py-2 font-medium">รหัส</th><th className="px-3 py-2 font-medium">ชื่อรายวิชา</th><th className="px-3 py-2 font-medium">หน่วยกิต</th><th className="px-3 py-2 font-medium">เกรด</th><th className="px-3 py-2 font-medium">เทอม</th><th className="px-3 py-2 font-medium">ปีการศึกษา</th><th className="px-3 py-2"><span className="sr-only">การจัดการ</span></th></tr></thead><tbody>{term.courses.map((course) => <CourseDesktopRow course={course} errors={errors[course.id]} key={course.id} onChange={update} onRemove={remove} />)}</tbody></table></div>
          <div className="grid gap-2 p-3 md:hidden">{term.courses.map((course) => <CourseMobileCard course={course} errors={errors[course.id]} key={course.id} onChange={update} onRemove={remove} />)}</div>
        </div> : null}
      </section>;
    }) : <section className="card p-6 text-sm text-slate-600">ยังไม่มีรายวิชา เพิ่มรายวิชาเพื่อเริ่มบันทึกผลการเรียน</section>}
    <div className="flex justify-end"><button className="btn btn-primary min-h-10 py-2 disabled:cursor-wait disabled:opacity-60" disabled={saving} type="button" onClick={() => void save()}>{saving ? "กำลังบันทึก…" : "บันทึกการเปลี่ยนแปลง"}</button></div>
  </section>;
}

function TranscriptDraftReview({ drafts, reload }: { drafts: TranscriptDraft[]; reload: () => Promise<void> }) {
  const [rows, setRows] = useState(drafts);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [openTerms, setOpenTerms] = useState<Set<string>>(() => new Set());
  const [changedIds, setChangedIds] = useState<Set<string>>(() => new Set());
  const initialized = useRef(false);
  useEffect(() => { setRows(drafts); setChangedIds(new Set()); }, [drafts]);
  const ready = rows.filter(draft => draft.status === "ready");
  const grouped = useMemo(() => groupCoursesByTerm(rows.map(draft => ({ id: draft.id, code: draft.code, nameTh: draft.name, credits: Number(draft.credits), grade: draft.grade || undefined, term: draft.term || undefined, year: draft.year || undefined }))), [rows]);
  const draftById = useMemo(() => new Map(rows.map(draft => [draft.id, draft])), [rows]);
  useEffect(() => {
    if (!initialized.current && grouped.length) {
      initialized.current = true;
      setOpenTerms(new Set([grouped[0].key]));
    }
  }, [grouped]);
  const update = (id: string, field: CourseField, value: string | number | undefined) => {
    setRows(current => current.map(draft => draft.id === id ? { ...draft, [field === "nameTh" ? "name" : field]: value ?? null } : draft));
    setChangedIds(current => new Set(current).add(id));
    setMessage(null);
  };
  const save = async () => {
    if (!changedIds.size) return;
    setBusy(true);
    setMessage(null);
    try {
      await Promise.all(rows.filter(row => changedIds.has(row.id)).map(row => api(`/api/transcript-drafts/${row.id}`, "PATCH", { code: row.code, name: row.name, credits: Number(row.credits), grade: row.grade, term: row.term, year: row.year })));
      setChangedIds(new Set());
      await reload();
      setMessage("บันทึกและทำเครื่องหมายรายการที่แก้ไขว่าพร้อมยืนยันแล้ว");
    } catch (caught) { setMessage(caught instanceof Error ? caught.message : "บันทึกร่างผลการเรียนไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  const toggle = (key: string) => setOpenTerms(current => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const confirm = async (draftIds = ready.map(draft => draft.id)) => {
    if (!draftIds.length) return;
    setBusy(true);
    try { await api("/api/transcript-drafts/confirm", "POST", { draftIds }); await reload(); }
    catch (caught) { setMessage(caught instanceof Error ? caught.message : "ยืนยันผลการเรียนไม่สำเร็จ"); }
    finally { setBusy(false); }
  };
  if (!drafts.length) return null;
  return <section className="card overflow-hidden">
    <div className="flex flex-wrap items-center justify-between gap-3 p-4"><div><h2 className="font-bold">ร่างผลการอ่าน Transcript</h2><p className="mt-1 text-sm text-slate-600">แก้ไขข้อมูลได้ทุกช่อง บันทึกแล้วจึงยืนยันเพื่อนำไปคำนวณ</p></div><div className="flex flex-wrap gap-2"><button className="btn disabled:cursor-wait disabled:opacity-60" disabled={busy || !changedIds.size} type="button" onClick={() => void save()}>{busy ? "กำลังบันทึก…" : "บันทึกการแก้ไข"}</button><button className="btn btn-primary disabled:cursor-wait disabled:opacity-60" disabled={busy || !ready.length || changedIds.size > 0} type="button" onClick={() => void confirm()}>{busy ? "กำลังยืนยัน…" : "ยืนยันรายการทั้งหมด"}</button></div></div>
    {message ? <p className="border-t px-4 py-3 text-sm text-blue-700" role="status">{message}</p> : null}
    {grouped.map(group => { const isOpen = openTerms.has(group.key); const termGpa = group.summary.gradedCredits ? group.summary.gpa.toFixed(2) : "—"; const gpax = group.cumulative.gradedCredits ? group.cumulative.gpa.toFixed(2) : "—"; return <section className="border-t" key={group.key}><button aria-controls={`draft-term-${group.key}`} aria-expanded={isOpen} className="flex min-h-12 w-full flex-wrap items-center gap-x-3 gap-y-1 bg-slate-50 px-4 py-2 text-left hover:bg-blue-50 focus-visible:outline focus-visible:outline-3 focus-visible:outline-blue-400" type="button" onClick={() => toggle(group.key)}><span className="min-w-40 flex-1 font-semibold">{group.label}</span><span className="grid grid-cols-2 divide-x divide-blue-100 overflow-hidden rounded-md border border-blue-100 bg-blue-50 text-center text-sm"><span className="px-3 py-1"><span className="block text-xs text-slate-600">GPA</span><span className="block font-bold tabular-nums">{termGpa}</span></span><span className="px-3 py-1"><span className="block text-xs text-slate-600">GPAX</span><span className="block font-bold tabular-nums">{gpax}</span></span></span><ChevronDown aria-hidden="true" className={`ml-auto shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} /></button>{isOpen ? <div id={`draft-term-${group.key}`}><div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-white text-slate-600"><tr><th className="px-3 py-2 font-medium">รหัส</th><th className="px-3 py-2 font-medium">ชื่อรายวิชา</th><th className="px-3 py-2 font-medium">หน่วยกิต</th><th className="px-3 py-2 font-medium">เกรด</th><th className="px-3 py-2 font-medium">เทอม</th><th className="px-3 py-2 font-medium">ปีการศึกษา</th></tr></thead><tbody>{group.courses.map(course => { const draft = draftById.get(course.id)!; return <tr className="border-t align-top" key={course.id}><td className="px-3 py-2"><DraftInput draft={draft} field="code" onChange={update} /></td><td className="px-3 py-2"><DraftInput draft={draft} field="nameTh" onChange={update} /></td><td className="px-3 py-2"><DraftInput draft={draft} field="credits" onChange={update} /></td><td className="px-3 py-2"><DraftInput draft={draft} field="grade" onChange={update} /></td><td className="px-3 py-2"><DraftInput draft={draft} field="term" onChange={update} /></td><td className="px-3 py-2"><DraftInput draft={draft} field="year" onChange={update} /></td></tr>; })}</tbody></table></div><div className="grid gap-2 p-3 md:hidden">{group.courses.map(course => <DraftMobileCard draft={draftById.get(course.id)!} key={course.id} onChange={update} />)}</div></div> : null}</section>; })}
  </section>;
}

function DraftInput({ draft, field, onChange }: { draft: TranscriptDraft; field: CourseField; onChange: (id: string, field: CourseField, value: string | number | undefined) => void }) {
  const course: Course = { id: draft.id, code: draft.code, nameTh: draft.name, credits: Number(draft.credits), grade: draft.grade || undefined, term: draft.term || undefined, year: draft.year || undefined };
  return <CourseInput course={course} field={field} onChange={onChange} />;
}

function DraftMobileCard({ draft, onChange }: { draft: TranscriptDraft; onChange: (id: string, field: CourseField, value: string | number | undefined) => void }) {
  const fields: Array<[CourseField, string]> = [["code", "รหัสวิชา"], ["nameTh", "ชื่อรายวิชา"], ["credits", "หน่วยกิต"], ["grade", "เกรด"], ["term", "เทอม"], ["year", "ปีการศึกษา"]];
  return <fieldset className="rounded-lg border border-slate-200 p-3"><legend className="sr-only">ข้อมูลรายวิชา</legend><div className="grid grid-cols-2 gap-2">{fields.map(([field, label]) => <label className={field === "nameTh" ? "col-span-2 grid gap-0.5 text-xs font-medium text-slate-700" : "grid gap-0.5 text-xs font-medium text-slate-700"} key={field}><span>{label}</span><DraftInput draft={draft} field={field} onChange={onChange} /></label>)}</div></fieldset>;
}

function CourseDesktopRow({ course, errors, onChange, onRemove }: { course: Course; errors?: Partial<Record<CourseField, string>>; onChange: (id: string, field: CourseField, value: string | number | undefined) => void; onRemove: (id: string) => void }) {
  return <tr className="border-t align-top"><td className="px-3 py-2"><CourseInput course={course} field="code" errors={errors} onChange={onChange} /></td><td className="px-3 py-2"><CourseInput course={course} field="nameTh" errors={errors} onChange={onChange} /></td><td className="px-3 py-2"><CourseInput course={course} field="credits" errors={errors} onChange={onChange} /></td><td className="px-3 py-2"><CourseInput course={course} field="grade" errors={errors} onChange={onChange} /></td><td className="px-3 py-2"><CourseInput course={course} field="term" errors={errors} onChange={onChange} /></td><td className="px-3 py-2"><CourseInput course={course} field="year" errors={errors} onChange={onChange} /></td><td className="px-3 py-2"><button className="min-h-9 rounded px-2 text-red-700 hover:bg-red-50" type="button" aria-label={`ลบ ${course.code || "รายวิชา"}`} onClick={() => onRemove(course.id)}><Trash2 size={17} aria-hidden="true" /></button></td></tr>;
}

function CourseMobileCard({ course, errors, onChange, onRemove }: { course: Course; errors?: Partial<Record<CourseField, string>>; onChange: (id: string, field: CourseField, value: string | number | undefined) => void; onRemove: (id: string) => void }) {
  return <fieldset className="rounded-lg border border-slate-200 p-2"><legend className="sr-only">ข้อมูลรายวิชา</legend><div className="grid grid-cols-4 gap-2"><LabeledCourseInput className="col-span-2" label="รหัสวิชา" course={course} field="code" errors={errors} onChange={onChange} /><LabeledCourseInput label="หน่วยกิต" course={course} field="credits" errors={errors} onChange={onChange} /><LabeledCourseInput label="เกรด" course={course} field="grade" errors={errors} onChange={onChange} /><LabeledCourseInput className="col-span-4" label="ชื่อรายวิชา" course={course} field="nameTh" errors={errors} onChange={onChange} /><LabeledCourseInput label="เทอม" course={course} field="term" errors={errors} onChange={onChange} /><LabeledCourseInput className="col-span-2" label="ปีการศึกษา" course={course} field="year" errors={errors} onChange={onChange} /><button className="min-h-10 self-end rounded px-1 text-xs text-red-700 hover:bg-red-50" type="button" onClick={() => onRemove(course.id)}>ลบ</button></div></fieldset>;
}

function LabeledCourseInput({ className = "", label, ...props }: { className?: string; label: string; course: Course; field: CourseField; errors?: Partial<Record<CourseField, string>>; onChange: (id: string, field: CourseField, value: string | number | undefined) => void }) { return <label className={`grid gap-0.5 text-xs font-medium text-slate-700 ${className}`}><span>{label}</span><CourseInput {...props} /></label>; }

function CourseInput({ course, field, errors, onChange }: { course: Course; field: CourseField; errors?: Partial<Record<CourseField, string>>; onChange: (id: string, field: CourseField, value: string | number | undefined) => void }) {
  const error = errors?.[field];
  const className = `min-h-10 w-full rounded border bg-white px-2 text-sm md:min-h-9 ${error ? "border-red-500" : "border-slate-300"}`;
  const label = { code: "รหัสวิชา", nameTh: "ชื่อรายวิชา", credits: "หน่วยกิต", grade: "เกรด", term: "เทอม", year: "ปีการศึกษา" }[field];
  if (field === "grade") return <select aria-label={label} className={className} value={course.grade || ""} onChange={(event) => onChange(course.id, field, event.target.value || undefined)}>{["", ...grades].map((grade) => <option key={grade} value={grade}>{grade || "—"}</option>)}</select>;
  if (field === "term") return <select aria-label={label} className={className} value={course.term || ""} onChange={(event) => onChange(course.id, field, event.target.value || undefined)}><option value="">ไม่ระบุ</option>{academicTerms.map((term) => <option key={term} value={term}>{academicTermLabels[term]}</option>)}</select>;
  if (field === "year") return <DeferredCourseInput className={className} course={course} error={error} field={field} label={label} onChange={onChange} />;
  const type = field === "credits" ? "number" : "text";
  const value = course[field] ?? "";
  return <><input aria-invalid={Boolean(error)} aria-label={label} className={className} min={field === "credits" ? ".5" : undefined} step={field === "credits" ? ".5" : undefined} type={type} value={value} onChange={(event) => onChange(course.id, field, field === "credits" ? (event.target.value === "" ? undefined : Number(event.target.value)) : event.target.value)} />{error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}</>;
}

function DeferredCourseInput({ className, course, error, field, label, onChange }: { className: string; course: Course; error?: string; field: "term" | "year"; label: string; onChange: (id: string, field: CourseField, value: string | number | undefined) => void }) {
  const [value, setValue] = useState(String(course[field] ?? ""));
  const commit = () => onChange(course.id, field, value === "" ? undefined : field === "year" ? Number(value) : value);
  return <><input aria-invalid={Boolean(error)} aria-label={label} className={className} min={field === "year" ? "1900" : undefined} max={field === "year" ? "3000" : undefined} step={field === "year" ? "1" : undefined} type={field === "year" ? "number" : "text"} value={value} onBlur={commit} onChange={(event) => setValue(event.target.value)} />{error ? <span className="mt-1 block text-xs text-red-700">{error}</span> : null}</>;
}
