import type { GraduationCap } from "lucide-react";

export function SummaryCard({ label, value, description, Icon }: { label: string; value: string; description: string; Icon: typeof GraduationCap }) {
  return <article className="card p-5"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-slate-600">{label}</p><p className="mt-2 text-3xl font-bold tabular-nums text-slate-900">{value}</p><p className="mt-2 text-sm text-slate-600">{description}</p></div><span className="rounded-lg bg-blue-50 p-2 text-blue-700"><Icon aria-hidden="true" size={22} /></span></div></article>;
}
