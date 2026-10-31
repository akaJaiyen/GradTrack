"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  FileText,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { DocumentsPage } from "./gradtrack/documents-page";
import { MatchingPage } from "./gradtrack/matching-page";
import { OverviewPage } from "./gradtrack/overview-page";
import { PrivacyPage } from "./gradtrack/privacy-page";
import { ReviewPage } from "./gradtrack/review-page";
import {
  api,
  fromCourse,
  fromRequirement,
  type Doc,
  type Tab,
  type View,
} from "./gradtrack/shared";
import type { Course, Requirement } from "@/lib/types";
import type { ConfirmedMatch } from "@/lib/academic";
import { TYPHOON_CONSENT_VERSION } from "@/lib/consent";

const navigationItems = [
  ["overview", "ภาพรวม", GraduationCap],
  ["upload", "เอกสารของฉัน", FileText],
  ["review", "ตรวจสอบข้อมูล", ShieldCheck],
  ["matching", "จับคู่รายวิชา", Wand2],
  ["privacy", "ความเป็นส่วนตัว", LockKeyhole],
] as const;

export function GradTrackApp({
  initialView = "overview",
  locale,
}: {
  initialView?: View;
  locale: string;
}) {
  const [view, setView] = useState<View>(initialView);
  const [tab, setTab] = useState<Tab>(() =>
    typeof window !== "undefined" &&
    new URLSearchParams(location.search).get("tab") === "student"
      ? "student"
      : "curriculum",
  );
  const [docs, setDocs] = useState<Doc[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [matches, setMatches] = useState<ConfirmedMatch[]>([]);
  const [workspace, setWorkspace] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [showConsent, setShowConsent] = useState(false);
  const [savingConsent, setSavingConsent] = useState(false);
  const workspaceInitialized = useRef(false);
  const reloadDocuments = useCallback(async () => {
    const documents = await api("/api/documents");
    setDocs(documents.data);
  }, []);
  const load = useCallback(async (initializeWorkspace = false) => {
    try {
      if (initializeWorkspace) {
        const currentWorkspace = await api("/api/workspace", "POST");
        if (currentWorkspace.demo) return;
      }
      const [documents, dashboard, consent] = await Promise.all([
        api("/api/documents"), api("/api/dashboard"), api("/api/consent"),
      ]);
      setDocs(documents.data);
      setCourses(dashboard.courses.map(fromCourse));
      setRequirements(dashboard.requirements.map(fromRequirement));
      setMatches(dashboard.matches.map((match: ConfirmedMatch) => ({
        course_id: match.course_id,
        degree_requirement_id: match.degree_requirement_id,
        status: match.status,
      })));
      setWorkspace(true);
      setShowConsent(consent.consentVersion !== TYPHOON_CONSENT_VERSION);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ โปรดลองใหม่อีกครั้ง");
    }
  }, []);
  useEffect(() => {
    // React Strict Mode invokes effects twice in development.  Creating two
    // anonymous workspaces races their cookies and causes intermittent 401s.
    if (workspaceInitialized.current) return;
    workspaceInitialized.current = true;
    void load(true);
  }, [load]);
  const go = (nextView: View, nextTab?: Tab) => {
    if (
      view === "review" &&
      nextView !== "review" &&
      document.querySelector("[data-dirty='true']") &&
      !confirm("มีการเปลี่ยนแปลงที่ยังไม่บันทึก ต้องการออกหรือไม่?")
    )
      return;
    const activeTab = nextTab || tab;
    setView(nextView);
    if (nextTab) setTab(nextTab);
    history.replaceState(
      null,
      "",
      `/${locale}/${nextView === "overview" ? "" : nextView}${nextView === "review" ? `?tab=${activeTab}` : ""}`,
    );
  };
  const deleteWorkspace = async () => {
    if (
      !confirm("ลบข้อมูลและไฟล์ทั้งหมดหรือไม่? การดำเนินการนี้ย้อนกลับไม่ได้")
    )
      return;
    try {
      await api("/api/workspace", "DELETE");
      setWorkspace(false);
      setDocs([]);
      setCourses([]);
      setRequirements([]);
      setMatches([]);
      setView("overview");
      history.replaceState(null, "", `/${locale}/`);
      setNotice("ลบ workspace แล้ว");
    } catch {
      setNotice("ลบ workspace ไม่สำเร็จ");
    }
  };
  const confirmConsent = async () => {
    setSavingConsent(true);
    try {
      await api("/api/consent", "POST");
      setShowConsent(false);
    } catch {
      setNotice("บันทึกความยินยอมไม่สำเร็จ โปรดลองอีกครั้ง");
    } finally {
      setSavingConsent(false);
    }
  };
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-blue-100 bg-white p-5 lg:min-h-screen lg:border-r">
        <Link
          href={`/${locale}`}
          className="flex gap-2 text-2xl font-bold text-blue-900"
        >
          <GraduationCap />
          GradTrack
        </Link>
        <nav className="mt-7 grid gap-1">
          {navigationItems.map(([key, title, Icon]) => (
            <button
              key={key}
              className={`nav-item text-left ${view === key ? "active" : ""}`}
              onClick={() => go(key)}
            >
              <Icon size={18} />
              {title}
            </button>
          ))}
        </nav>
      </aside>
      <main className="min-w-0 p-4 sm:p-7">
        <h1 className="mb-2 text-2xl font-bold">
          {view === "upload"
            ? "เอกสารของฉัน"
            : view === "review"
              ? "ตรวจสอบข้อมูล"
              : view === "privacy"
                ? "ความเป็นส่วนตัว"
                : view === "matching"
                  ? "จับคู่รายวิชา"
                : "GradTrack"}
        </h1>
        {notice && (
          <p
            className="mb-4 rounded border border-blue-200 bg-blue-50 p-3 text-sm"
            role="status"
          >
            {notice}
          </p>
        )}
        {view === "overview" && (
          <OverviewPage courses={courses} requirements={requirements} matches={matches} goToUpload={() => go("upload")} />
        )}
        {view === "upload" && (
          workspace ? <DocumentsPage docs={docs} reload={reloadDocuments} notice={setNotice} /> : <section className="card p-6"><p className="text-sm text-slate-600">กำลังเตรียมพื้นที่เก็บเอกสาร…</p></section>
        )}
        {view === "review" && (
          <ReviewPage tab={tab} setTab={(nextTab) => go("review", nextTab)} />
        )}
        {view === "matching" && (
          <MatchingPage />
        )}
        {view === "privacy" && (
          <PrivacyPage
            deleteWorkspace={deleteWorkspace}
            workspace={workspace}
          />
        )}
      </main>
      {showConsent && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation">
        <section className="card w-full max-w-lg p-6" role="dialog" aria-modal="true" aria-labelledby="consent-title" aria-describedby="consent-description">
          <h2 id="consent-title" className="text-xl font-bold">ขอความยินยอมในการใช้ AI</h2>
          <p id="consent-description" className="mt-3 text-sm leading-6 text-slate-600">GradTrack จะส่งไฟล์เอกสารต้นฉบับที่คุณอัปโหลดไปยัง Typhoon OCR เพื่อแปลงเป็นข้อความและ Markdown จากนั้นส่งข้อความที่อ่านได้ไปยัง Typhoon text model เพื่อสกัดข้อมูลสำหรับสร้างแผนการเรียน ไฟล์ใน GradTrack ยังคงเก็บไว้ในพื้นที่ส่วนตัวของคุณ</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">ความยินยอมนี้ใช้กับการอัปโหลดทุกครั้งในพื้นที่ใช้งานนี้ และจะขอใหม่เมื่อพื้นที่ใช้งานหมดอายุหลังไม่ได้ใช้งานเป็นเวลานาน</p>
          <button className="btn btn-primary mt-6 w-full disabled:cursor-wait disabled:opacity-60" type="button" disabled={savingConsent} onClick={() => void confirmConsent()}>{savingConsent ? "กำลังบันทึก…" : "ยินยอมและดำเนินการต่อ"}</button>
        </section>
      </div>}
    </div>
  );
}
