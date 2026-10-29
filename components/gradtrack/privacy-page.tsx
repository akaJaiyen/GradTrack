"use client";

import { LockKeyhole, Trash2 } from "lucide-react";

export function PrivacyPage({
  deleteWorkspace,
  workspace,
}: {
  deleteWorkspace: () => Promise<void>;
  workspace: boolean;
}) {
  return (
    <section className="max-w-3xl space-y-5">
      <div className="card p-6">
        <div className="flex items-center gap-2 font-bold text-blue-900">
          <LockKeyhole className="text-blue-700" />
          ข้อมูลส่วนบุคคลของคุณ
        </div>
        <p className="mt-2 text-sm text-slate-600">
          ข้อมูลของคุณอยู่ใน workspace ส่วนตัว และไฟล์เอกสารถูกเก็บใน private
          storage
        </p>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h2 className="font-bold text-red-800">ลบข้อมูลทั้งหมด</h2>
        <p className="mt-2 text-sm text-red-700">
          การลบจะนำเอกสารและข้อมูลทั้งหมดใน workspace นี้ออกอย่างถาวร
          และไม่สามารถกู้คืนได้
        </p>
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!workspace}
          onClick={() => void deleteWorkspace()}
        >
          <Trash2 size={16} />
          ลบ workspace ของฉัน
        </button>
        {!workspace && (
          <p className="mt-3 text-sm text-slate-600">
            ไม่มี workspace ที่บันทึกข้อมูลอยู่ในขณะนี้
          </p>
        )}
      </div>
    </section>
  );
}
