"use client";

import { useEffect, useState } from "react";

export function BasedOneApp() {
  const [hydrated, setHydrated] = useState(false);
  const [tapCount, setTapCount] = useState(0);
  const [statusMessage, setStatusMessage] = useState(
    "Waiting for client hydration...",
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHydrated(true);
      setStatusMessage("Client hydration active.");
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <main
      className="min-h-screen overflow-x-hidden bg-[var(--surface)] px-4 md:px-8"
      style={{
        paddingTop: "max(1.5rem, env(safe-area-inset-top))",
        paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.75rem))",
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(27,67,255,0.16),transparent_30%),radial-gradient(circle_at_80%_20%,rgba(117,206,255,0.16),transparent_26%),linear-gradient(180deg,rgba(255,255,255,0.84),rgba(244,248,255,0.94))]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] max-w-2xl flex-col items-stretch justify-center">
        <section className="relative z-50 w-full rounded-[2rem] border border-[var(--line)] bg-[rgba(255,255,255,0.92)] p-4 shadow-[0_30px_100px_rgba(34,74,255,0.08)] backdrop-blur-xl sm:p-5">
          <div className="flex flex-col gap-3">
            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Hydrated: {hydrated ? "YES" : "NO"}
            </div>

            <button
              type="button"
              onClick={() => {
                setTapCount((count) => count + 1);
                setStatusMessage("React onClick fired.");
              }}
              className="h-14 w-full touch-manipulation rounded-[1.2rem] bg-[linear-gradient(135deg,#2953ff,#5ca4ff)] px-4 text-sm font-semibold tracking-[0.02em] text-white"
              style={{ WebkitTapHighlightColor: "transparent" }}
            >
              React Click Test
            </button>

            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              Tap Count: {tapCount}
            </div>

            <div className="rounded-[1.2rem] border border-[var(--line)] bg-white/80 p-4 text-center text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted)]">
              {statusMessage}
            </div>
          </div>

          <div className="mt-5 border-t border-[var(--line)] px-1 pt-3 text-center text-xs font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
            v0.1.2
          </div>
        </section>
      </div>
    </main>
  );
}
