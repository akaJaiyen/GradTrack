"use client";

import { useState } from "react";
import { BarChart3, BookOpenCheck, GraduationCap, TrendingUp } from "lucide-react";
import { dashboardSummary } from "@/lib/dashboard-summary";
import type { ConfirmedMatch } from "@/lib/academic";
import type { Course, Requirement } from "@/lib/types";
import { GpaTimeline } from "./gpa-timeline";
import { SummaryCard } from "./summary-card";

const formatGpa = (gpa: number, gradedCredits: number) => gradedCredits ? gpa.toFixed(2) : "—";


export function OverviewPage({
  courses,
  requirements,
  matches,
  goToUpload,
}: {
  courses: Course[];
  requirements: Requirement[];
  matches: ConfirmedMatch[];
  goToUpload: () => void;
}) {
  const summary = dashboardSummary(courses, requirements, matches);
  const [selectedTermKey, setSelectedTermKey] = useState<string | null>(null);

  if (summary.state === "no_transcript") {
    return <section className="card max-w-2xl p-6 sm:p-8">
      <GraduationCap aria-hidden="true" className="text-blue-700" size={32} />
      <h2 className="mt-4 text-xl font-bold text-slate-900">เริ่มต้นด้วยการเพิ่มผลการเรียน</h2>
      <p className="mt-2 leading-6 text-slate-600">อัปโหลด Transcript แล้วตรวจสอบและยืนยันข้อมูลรายวิชา เพื่อดู GPA หน่วยกิตที่ผ่าน และแนวโน้มผลการเรียนที่นี่</p>
      <button className="btn btn-primary mt-5 min-h-11" type="button" onClick={goToUpload}>ไปหน้าเอกสารของฉัน</button>
    </section>;
  }

  const { overall, latestTerm, terms, progress } = summary;
  const selectedTerm = terms.find((term) => term.key === selectedTermKey) ?? latestTerm;
  return <div className="space-y-6">
    <section aria-labelledby="overview-summary">
      <h2 id="overview-summary" className="sr-only">สรุปผลการเรียน</h2>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="GPA สะสม" value={formatGpa(overall.gpa, overall.gradedCredits)} description={overall.gradedCredits ? `จาก ${overall.gradedCredits} หน่วยกิตที่มีเกรด` : "ยังไม่มีเกรดที่ใช้คำนวณ"} Icon={TrendingUp} />
        <SummaryCard label="หน่วยกิตที่ผ่าน" value={`${overall.passedCredits}`} description="รวมเกรดผ่าน และ P/S" Icon={BookOpenCheck} />
        <SummaryCard label="รายวิชาที่บันทึก" value={`${courses.length}`} description="จาก Transcript ที่ยืนยันแล้ว" Icon={GraduationCap} />
        <SummaryCard label="ผลการเรียนเทอมล่าสุด" value={latestTerm ? formatGpa(latestTerm.summary.gpa, latestTerm.summary.gradedCredits) : "—"} description={latestTerm ? `${latestTerm.label} · ผ่าน ${latestTerm.summary.passedCredits} หน่วยกิต` : "ยังไม่ระบุเทอม"} Icon={BarChart3} />
      </div>
    </section>

    {progress ? <section className="card p-5 sm:p-6" aria-labelledby="graduation-progress">
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
    </section> : summary.state === "grades_only" ? <section className="card border-dashed p-5" aria-label="ความก้าวหน้าสู่จบ">
      <h2 className="font-bold text-slate-900">ยังไม่แสดงความก้าวหน้าสู่จบ</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">เพิ่มและยืนยัน Study Plan ก่อน ระบบจึงจะแสดงเป้าหมายหน่วยกิตตามหลักสูตรของคุณ</p>
    </section> : <section className="card border-dashed p-5" aria-label="ความก้าวหน้าสู่จบ">
      <h2 className="font-bold text-slate-900">รอการจับคู่รายวิชา</h2>
      <p className="mt-1 text-sm leading-6 text-slate-600">มีข้อมูลหลักสูตรแล้ว แต่ยังไม่มีรายวิชาที่จับคู่และยืนยัน จึงยังไม่แสดงตัวเลขความก้าวหน้าสู่จบ</p>
    </section>}

    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.9fr)]">
      <section className="card p-5 sm:p-6" aria-labelledby="gpa-trend">
        <div className="flex items-center gap-2"><BarChart3 aria-hidden="true" className="text-blue-700" size={20} /><h2 id="gpa-trend" className="font-bold text-slate-900">แนวโน้มผลการเรียน</h2></div>
        <p className="mt-1 text-sm text-slate-600">GPA ของแต่ละเทอมบนสเกลคงที่ 0–4</p>
        <GpaTimeline terms={terms} />
      </section>

      <section className="card overflow-hidden" aria-labelledby="term-courses">
        <div className="border-b border-blue-100 p-5"><h2 id="term-courses" className="font-bold text-slate-900">ผลการเรียนรายเทอม</h2><label className="mt-3 grid gap-1 text-sm font-medium text-slate-700" htmlFor="course-term">เลือกเทอม
          <select id="course-term" className="min-h-11 rounded-lg border border-blue-200 bg-white px-3 text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200" value={selectedTerm?.key ?? ""} onChange={(event) => setSelectedTermKey(event.target.value)}>
            {terms.map((term) => <option key={term.key} value={term.key}>{term.label}</option>)}
          </select>
        </label></div>
        <div className="divide-y divide-slate-100">
          {selectedTerm?.courses.map((course) => <article key={course.id} className="flex items-start justify-between gap-3 px-5 py-4">
            <div className="min-w-0"><p className="font-medium text-slate-900">{course.code}</p><p className="mt-1 truncate text-sm text-slate-600" title={course.nameTh}>{course.nameTh}</p><p className="mt-1 text-xs text-slate-500">{course.credits} หน่วยกิต</p></div>
            <span className="status info shrink-0">{course.grade || "—"}</span>
          </article>)}
        </div>
      </section>
    </div>
  </div>;
}
