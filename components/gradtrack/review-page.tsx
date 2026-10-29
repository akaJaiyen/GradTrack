"use client";

import type { Course, Requirement } from "@/lib/types";
import { CurriculumReviewPage } from "./curriculum-review-page";
import { StudentReviewPage } from "./student-review-page";
import type { Doc, Tab } from "./shared";

type ReviewPageProps = {
  tab: Tab;
  setTab: (tab: Tab) => void;
  docs: Doc[];
  courses: Course[];
  requirements: Requirement[];
  workspace: boolean;
  reload: () => Promise<void>;
  notice: (message: string) => void;
};

export function ReviewPage({
  tab,
  setTab,
  docs,
  courses,
  requirements,
  workspace,
  reload,
  notice,
}: ReviewPageProps) {
  return (
    <>
      <div className="mb-5 border-b" role="tablist">
        <button
          role="tab"
          aria-selected={tab === "curriculum"}
          className={`review-tab ${tab === "curriculum" ? "selected" : ""}`}
          onClick={() => setTab("curriculum")}
        >
          หลักสูตร
        </button>
        <button
          role="tab"
          aria-selected={tab === "student"}
          className={`review-tab ${tab === "student" ? "selected" : ""}`}
          onClick={() => setTab("student")}
        >
          ข้อมูลส่วนตัวผู้ใช้
        </button>
      </div>
      {tab === "student" ? (
        <StudentReviewPage
          docs={docs}
          courses={courses}
          workspace={workspace}
          reload={reload}
          notice={notice}
        />
      ) : (
        <CurriculumReviewPage
          docs={docs}
          requirements={requirements}
          workspace={workspace}
          reload={reload}
          notice={notice}
        />
      )}
    </>
  );
}
