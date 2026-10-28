import { GradTrackApp } from "@/components/gradtrack-app";
export default async function Home({ params }: { params: Promise<{ locale: string }> }) { return <GradTrackApp locale={(await params).locale} />; }
