import { Suspense } from "react";
import { notFound } from "next/navigation";
import DayView from "@/components/DayView";

export default function DayPage({ params }: PageProps<"/day/[n]">) {
  return (
    <Suspense fallback={<p className="empty">Diving…</p>}>
      <Day params={params} />
    </Suspense>
  );
}

async function Day({ params }: { params: PageProps<"/day/[n]">["params"] }) {
  const n = Number((await params).n);
  if (!Number.isInteger(n) || n < 1) notFound();
  return <DayView dayNumber={n} />;
}
