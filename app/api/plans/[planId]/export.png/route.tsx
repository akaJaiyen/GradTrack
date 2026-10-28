import { ImageResponse } from "next/og";
import { ownedId } from "@/lib/server-workspace";
export async function GET(_: Request, { params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const access = await ownedId("study_plans", planId);
  if (!access.db || !access.owned) return new Response("Unauthorized", { status: 401 });
  const today = new Intl.DateTimeFormat("th-TH", { dateStyle: "medium" }).format(new Date());
  const days = ["จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์"];
  return new ImageResponse(<div style={{ background: "white", color: "#102a5f", width: "100%", height: "100%", padding: 48, display: "flex", flexDirection: "column", fontFamily: "Noto Sans Thai" }}><div style={{ display: "flex", justifyContent: "space-between", fontSize: 34, fontWeight: 700 }}><span>GradTrack · แผนเรียน เทอม 1/2569</span><span style={{ fontSize: 18, color: "#64748b" }}>15 หน่วยกิต</span></div><div style={{ display: "flex", marginTop: 32, border: "1px solid #bfdbfe", flex: 1 }}>{days.map((day, i) => <div key={day} style={{ display: "flex", flexDirection: "column", flex: 1, borderRight: i < 6 ? "1px solid #bfdbfe" : undefined }}><div style={{ padding: 14, textAlign: "center", background: "#eff6ff", fontWeight: 700 }}>{day}</div>{i < 5 && <div style={{ margin: 16, padding: 12, background: ["#dbeafe", "#dcfce7", "#fce7f3", "#ffedd5", "#ede9fe"][i], borderRadius: 8, fontSize: 17, display: "flex", flexDirection: "column" }}><b>{["CS301", "MATH301", "CS302", "ENG201", "HUM101"][i]}</b><span>09:00 – 11:00</span></div>}</div>)}</div><div style={{ marginTop: 18, fontSize: 15, color: "#64748b" }}>สร้างเมื่อ {today} · GradTrack</div></div>, { width: 1600, height: 900 });
}
