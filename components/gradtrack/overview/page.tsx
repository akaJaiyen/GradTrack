"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, BarChart3, BookOpenCheck, CheckCircle2, CircleAlert, GraduationCap, TrendingUp } from "lucide-react";
import { dashboardSummary } from "@/lib/dashboard-summary";
import { graduationGapSummary } from "@/lib/graduation-gap-summary";
import type { ConfirmedMatch } from "@/lib/academic";
import type { Course, Requirement } from "@/lib/types";
import { GpaTimeline } from "./gpa-timeline";
import { SummaryCard } from "./summary-card";
import { SingleSelectPicker } from "../shared/single-select-picker";

const formatGpa = (gpa: number, gradedCredits: number) => gradedCredits ? gpa.toFixed(2) : "—";


export function OverviewPage({
  courses,
  requirements,
  matches,
  goToUpload,
  goToMatching,
}: {
  courses: Course[];
  requirements: Requirement[];
  matches: ConfirmedMatch[];
  goToUpload: () => void;
  goToMatching: () => void;
}) {
  const summary = dashboardSummary(courses, requirements, matches);
  const gaps = graduationGapSummary(courses, requirements, matches);
  const [selectedTermKey, setSelectedTermKey] = useState<string | null>(null);
  const noTranscript = summary.state === "no_transcript";

  const noTranscriptNotice = <section className="card max-w-2xl p-6 sm:p-8">
      <GraduationCap aria-hidden="true" className="text-blue-700" size={32} />
      <h2 className="mt-4 text-xl font-bold text-slate-900">เริ่มต้นด้วยการเพิ่มผลการเรียน</h2>
      <p className="mt-2 leading-6 text-slate-600">อัปโหลด Transcript แล้วตรวจสอบและยืนยันข้อมูลรายวิชา เพื่อดู GPA หน่วยกิตที่ผ่าน และแนวโน้มผลการเรียนที่นี่</p>
      <button className="btn btn-primary mt-5 min-h-11" type="button" onClick={goToUpload}>ไปหน้าเอกสารของฉัน</button>
    </section>;

  const { overall, latestTerm, terms, progress } = summary;
  const selectedTerm = terms.find((term) => term.key === selectedTermKey) ?? latestTerm;
  return <div className="space-y-6">
    {noTranscript ? noTranscriptNotice : <section aria-labelledby="overview-summary">
      <h2 id="overview-summary" className="sr-only">สรุปผลการเรียน</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="GPA สะสม" value={formatGpa(overall.gpa, overall.gradedCredits)} description={overall.gradedCredits ? `จาก ${overall.gradedCredits} หน่วยกิตที่มีเกรด` : "ยังไม่มีเกรดที่ใช้คำนวณ"} Icon={TrendingUp} />
        <SummaryCard label="หน่วยกิตที่ผ่าน" value={`${overall.passedCredits}`} description="รวมเกรดผ่าน และ P/S" Icon={BookOpenCheck} />
        <SummaryCard label="รายวิชาที่บันทึก" value={`${courses.length}`} description="จาก Transcript ที่ยืนยันแล้ว" Icon={GraduationCap} />
        <SummaryCard label="ผลการเรียนเทอมล่าสุด" value={latestTerm ? formatGpa(latestTerm.summary.gpa, latestTerm.summary.gradedCredits) : "—"} description={latestTerm ? `${latestTerm.label} · ผ่าน ${latestTerm.summary.passedCredits} หน่วยกิต` : "ยังไม่ระบุเทอม"} Icon={BarChart3} />
      </div>
    </section>}

    {!noTranscript && (progress ? <section className="card p-5 sm:p-6" aria-labelledby="graduation-progress">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="graduation-progress" className="font-bold text-slate-900">ความก้าวหน้าสู่จบ</h2>
          <p className="mt-1 text-sm text-slate-600">คำนวณจากรายวิชาที่จับคู่และยืนยันแล้ว</p>
        </div>
        <p className="text-lg font-bold tabular-nums text-blue-800">{progress.passedCredits} / {progress.totalCredits} หน่วยกิต</p>
      </div>
      <div className="mt-4 h-3 overflow-hidden rounded-full bg-blue-100" aria-label={`ความก้าวหน้าสู่จบ ${progress.percentage}%`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.percentage}>
        <div className="h-full rounded-full bg-blue-600 transition-[width] duration-200 motion-reduce:transition-none" style={{ width: `${progress.percentage}%` }} />
      </div>
      <p className="mt-2 text-right text-sm font-medium text-slate-700">{progress.percentage}%</p>
    </section> : summary.state === "grades_only" ? null : <section className="card border-dashed p-5" aria-label="ความก้าวหน้าสู่จบ">
      <h2 className="font-bold text-slate-900">รอการจับคู่รายวิชา</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">มีข้อมูลหลักสูตรแล้ว แต่ยังไม่มีรายวิชาที่จับคู่และยืนยัน จึงยังไม่แสดงตัวเลขความก้าวหน้าสู่จบ</p>
    </section>)}

    {!noTranscript ? <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
      <section className="card p-5 sm:p-6" aria-labelledby="gpa-trend">
        <div className="flex items-center gap-2"><BarChart3 aria-hidden="true" className="text-blue-700" size={20} /><h2 id="gpa-trend" className="font-bold text-slate-900">แนวโน้มผลการเรียน</h2></div>
        <p className="mt-1 text-sm text-slate-600">GPA ของแต่ละเทอมบนสเกลคงที่ 0–4</p>
        <GpaTimeline terms={terms} />
      </section>

      <section className="card overflow-hidden" aria-labelledby="term-courses">
        <div className="border-b border-blue-100 p-5"><h2 id="term-courses" className="font-bold text-slate-900">ผลการเรียนรายเทอม</h2><div className="mt-3 grid gap-1 text-sm font-medium text-slate-700"><p id="course-term-label">เลือกเทอม</p>
          <SingleSelectPicker ariaLabel="เลือกเทอม" onChange={setSelectedTermKey} options={terms.map((term) => ({ value: term.key, label: term.label }))} placeholder="เลือกเทอม" value={selectedTerm?.key ?? ""} />
        </div></div>
        <div className="divide-y divide-slate-100">
          {selectedTerm?.courses.map((course) => <article key={course.id} className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0"><p className="font-medium text-slate-900">{course.code}</p><p className="mt-1 truncate text-sm text-slate-600" title={course.nameTh}>{course.nameTh}</p><p className="mt-1 text-xs text-slate-500">{course.credits} หน่วยกิต</p></div>
            <span className="status info shrink-0">{course.grade || "—"}</span>
          </article>)}
        </div>
      </section>
    </div> : null}

    {requirements.length ? <section className="card p-5 sm:p-6" aria-labelledby="graduation-gaps">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="graduation-gaps" className="font-bold text-slate-900">สิ่งที่ยังต้องดำเนินการ</h2><p className="mt-1 text-sm leading-6 text-slate-600">สรุปจากการจับคู่และผลการเรียนที่ยืนยันแล้ว</p></div>
        <button className="btn min-h-10" type="button" onClick={goToMatching}>กลับไปจับคู่รายวิชา <ArrowRight aria-hidden="true" size={16} /></button>
      </div>
      {gaps.pendingConfirmations ? <div className="mt-4 flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950" role="status"><CircleAlert aria-hidden="true" className="mt-0.5 shrink-0" size={20} /><p className="text-sm leading-6">มี {gaps.pendingConfirmations} รายการรอยืนยัน รายการเหล่านี้ยังไม่ถูกนับในสรุปจนกว่าจะยืนยันการจับคู่</p></div> : null}
      {gaps.hasGaps ? <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {gaps.missingRequired.length ? <section className="rounded-lg border border-slate-200 bg-slate-50 p-4" aria-labelledby="missing-required"><div className="flex items-center gap-2 text-slate-900"><CircleAlert aria-hidden="true" size={18} /><h3 id="missing-required" className="font-semibold">ยังไม่พบรายวิชาบังคับ</h3></div><ul className="mt-3 space-y-2 text-sm text-slate-700">{gaps.missingRequired.map((course) => <li key={course.requirementId}><span className="font-medium text-slate-900">{course.code || "ไม่ระบุรหัส"}</span><span className="text-slate-600"> — {course.name || "ไม่ระบุชื่อรายวิชา"}</span></li>)}</ul></section> : null}
        {gaps.notPassedRequired.length ? <section className="rounded-lg border border-rose-200 bg-rose-50 p-4" aria-labelledby="not-passed-required"><div className="flex items-center gap-2 text-rose-950"><AlertTriangle aria-hidden="true" size={18} /><h3 id="not-passed-required" className="font-semibold">รายวิชาบังคับที่ยังไม่ผ่าน</h3></div><ul className="mt-3 space-y-2 text-sm text-rose-950">{gaps.notPassedRequired.map((course) => <li key={course.requirementId}><span className="font-medium">{course.code || "ไม่ระบุรหัส"}</span><span> — {course.name || "ไม่ระบุชื่อรายวิชา"}</span>{course.candidates[0]?.grade ? <span className="ml-1 text-rose-800">(เกรด {course.candidates[0].grade})</span> : null}</li>)}</ul></section> : null}
        {gaps.incompleteElectives.length ? <section className="rounded-lg border border-blue-200 bg-blue-50 p-4" aria-labelledby="incomplete-electives"><div className="flex items-center gap-2 text-blue-950"><BookOpenCheck aria-hidden="true" size={18} /><h3 id="incomplete-electives" className="font-semibold">หน่วยกิตวิชาเลือกที่ยังขาด</h3></div><ul className="mt-3 space-y-2 text-sm text-blue-950">{gaps.incompleteElectives.map((elective) => <li key={elective.requirementIds.join("-")}><span className="font-medium">{elective.category}</span><span> — ขาดอีก {elective.remainingCredits} หน่วยกิต</span><span className="text-blue-800"> (ครบแล้ว {elective.passedCredits} / {elective.requiredCredits})</span></li>)}</ul></section> : null}
      </div> : <div className="mt-5 flex gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-emerald-950" role="status"><CheckCircle2 aria-hidden="true" className="mt-0.5 shrink-0" size={20} /><p className="text-sm leading-6">ไม่พบวิชาบังคับหรือหน่วยกิตวิชาเลือกที่ยังขาดจากข้อมูลที่ยืนยันแล้ว</p></div>}
    </section> : null}
  </div>;
}
