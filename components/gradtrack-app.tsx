"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  FileText,
  GraduationCap,
  LockKeyhole,
  ShieldCheck,
  Wand2,
} from "lucide-react";
import { DocumentsPage } from "./gradtrack/documents-page";
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
  const [workspace, setWorkspace] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const workspaceInitialized = useRef(false);
  const load = async () => {
    try {
      const currentWorkspace = await api("/api/workspace", "POST");
      if (currentWorkspace.demo) return;
      const [documents, dashboard] = await Promise.all([
        api("/api/documents"),
        api("/api/dashboard"),
      ]);
      setDocs(documents.data);
      setCourses(dashboard.courses.map(fromCourse));
      setRequirements(dashboard.requirements.map(fromRequirement));
      setWorkspace(true);
    } catch {
      setNotice("โหมดตัวอย่าง — ตั้งค่า Supabase เพื่อบันทึกข้อมูลจริง");
    }
  };
  useEffect(() => {
    // React Strict Mode invokes effects twice in development.  Creating two
    // anonymous workspaces races their cookies and causes intermittent 401s.
    if (workspaceInitialized.current) return;
    workspaceInitialized.current = true;
    void load();
  }, []);
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
      setView("overview");
      history.replaceState(null, "", `/${locale}/`);
      setNotice("ลบ workspace แล้ว");
    } catch {
      setNotice("ลบ workspace ไม่สำเร็จ");
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
          <section className="card p-6">
            <h2 className="font-bold">เริ่มต้นด้วยการอัปโหลดเอกสาร</h2>
            <button
              className="btn btn-primary mt-4"
              onClick={() => go("upload")}
            >
              ไปหน้าเอกสารของฉัน
            </button>
          </section>
        )}
        {view === "upload" && (
          workspace ? <DocumentsPage docs={docs} reload={load} notice={setNotice} go={go} /> : <section className="card p-6"><p className="text-sm text-slate-600">กำลังเตรียมพื้นที่เก็บเอกสาร…</p></section>
        )}
        {view === "review" && (
          <ReviewPage tab={tab} setTab={(nextTab) => go("review", nextTab)} />
        )}
        {view === "matching" && (
          <section className="card p-6">
            <h2 className="font-bold">จับคู่รายวิชา</h2>
            <p className="mt-2 text-sm text-slate-500">
              ตรวจหลักสูตรและผลการเรียนจากหน้าตรวจสอบข้อมูลก่อน
              แล้วจึงจับคู่รายวิชาที่นี่
            </p>
          </section>
        )}
        {view === "privacy" && (
          <PrivacyPage
            deleteWorkspace={deleteWorkspace}
            workspace={workspace}
          />
        )}
      </main>
    </div>
  );
}
