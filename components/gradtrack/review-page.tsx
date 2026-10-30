"use client";

import { AcademicProfileReview } from "./academic-profile-review";
import type { Tab } from "./shared";

export function ReviewPage({ tab, setTab }: { tab: Tab; setTab: (tab: Tab) => void }) {
  return <>
    <div className="mb-5 border-b" role="tablist">
      <button role="tab" aria-selected={tab === "curriculum"} className={`review-tab ${tab === "curriculum" ? "selected" : ""}`} onClick={() => setTab("curriculum")}>หลักสูตร</button>
      <button role="tab" aria-selected={tab === "student"} className={`review-tab ${tab === "student" ? "selected" : ""}`} onClick={() => setTab("student")}>ข้อมูลส่วนตัวผู้ใช้</button>
    </div>
    <AcademicProfileReview tab={tab} />
  </>;
}
