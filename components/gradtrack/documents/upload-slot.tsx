import { documentExtractionErrorMessage } from "@/lib/document-extraction-error";
import { documentStatusLabels, type Doc } from "../shared/documents";

export function UploadSlot({ role, title, description, doc, disabled, active, upload }: { role: "study_plan" | "transcript"; title: string; description: string; doc?: Doc; disabled: boolean; active: boolean; upload: (role: "study_plan" | "transcript", files: FileList | null) => Promise<void> }) {
  return <section className="rounded-lg border border-blue-100 bg-slate-50 p-4">
    <h3 className="font-semibold">{title}</h3><p className="mt-1 text-sm text-slate-600">{description}</p>
    <label className={`btn btn-primary mt-4 inline-block text-center ${disabled ? "cursor-not-allowed opacity-60" : ""}`} aria-disabled={disabled}>{active ? "กำลังอัปโหลด…" : doc ? "แทนที่เอกสาร" : `อัปโหลด ${title}`}<input className="sr-only" disabled={disabled} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={event => void upload(role, event.target.files)} /></label>
    <div className="mt-4 rounded bg-white p-3 text-sm">{doc ? <div className="flex items-center justify-between gap-3"><span className="min-w-0 truncate">{doc.file_name}</span><span className="status info shrink-0">{documentStatusLabels[doc.status] || doc.status}</span></div> : <span className="text-slate-500">ยังไม่ได้อัปโหลดเอกสาร</span>}</div>
    {doc?.status === "failed" && <p className="mt-3 text-sm text-red-700">สาเหตุ: {documentExtractionErrorMessage(doc.extraction_error)}</p>}
  </section>;
}
