import { GradTrackApp } from "@/components/gradtrack-app";
const allowed = new Set(["overview","upload","review","matching","scenarios","planner","privacy"]);
export default async function View({ params }: { params: Promise<{ locale: string; view: string }> }) { const { locale, view } = await params; return <GradTrackApp locale={locale} initialView={allowed.has(view) ? view as "overview" : "overview"} />; }
