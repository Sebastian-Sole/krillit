import { Suspense } from "react";
import DayView from "@/components/DayView";

export default function Home() {
  return (
    <Suspense fallback={<p className="empty">Diving…</p>}>
      <DayView />
    </Suspense>
  );
}
