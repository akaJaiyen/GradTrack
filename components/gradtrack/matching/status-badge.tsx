import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import type { MatchStatus } from "./types";

const statusDetails: Record<MatchStatus, { label: string; className: string; Icon: typeof CheckCircle2 }> = {
  passed: { label: "ผ่านแล้ว", className: "ok", Icon: CheckCircle2 }, needs_confirmation: { label: "รอยืนยัน", className: "warn", Icon: CircleAlert }, not_passed: { label: "ยังไม่ผ่าน", className: "danger", Icon: XCircle }, missing: { label: "ยังไม่พบ", className: "info", Icon: CircleAlert },
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  const { label, className, Icon } = statusDetails[status];
  return <span className={`status shrink-0 gap-1 whitespace-nowrap ${className}`}><Icon aria-hidden="true" size={14} />{label}</span>;
}
