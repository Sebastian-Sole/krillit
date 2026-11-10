"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { joinAsNewPlayer, signInWithCode, signOut, submitScore, type JoinState, type SubmitState } from "@/app/actions";
import { formatCode } from "@/lib/sync-code";
import CopyButton from "./CopyButton";

type Props = { dayNumber: number; player: { name: string } | null; names: string[] };

export default function ScorePanel({ dayNumber, player, names }: Props) {
  // Shown once, right after someone joins, so they can save their code.
  const [reveal, setReveal] = useState<{ name: string; code: string } | null>(null);

  if (reveal) {
    return (
      <div className="card reveal">
        <h2>You&apos;re in, {reveal.name}! 🎉</h2>
        <p className="sub">
          This is your <strong>sync code</strong>. Save it somewhere: you need it to add scores from another device. You can find it
          again under your name at the top of the page.
        </p>
        <div className="code-big">{formatCode(reveal.code)}</div>
        <div className="code-actions">
          <CopyButton text={formatCode(reveal.code)} auto />
          <button type="button" className="btn" onClick={() => setReveal(null)}>
            Got it
          </button>
        </div>
      </div>
    );
  }
  if (!player) return <Gate names={names} onJoined={setReveal} />;
  return <ScoreForm dayNumber={dayNumber} name={player.name} />;
}

// Dispatching by hand (instead of action={...}) stops React from clearing the fields when the server rejects them.
function dispatch(action: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
}

function ScoreForm({ dayNumber, name }: { dayNumber: number; name: string }) {
  const router = useRouter();
  const [state, action, pending] = useActionState<SubmitState, FormData>(submitScore, null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    if (textRef.current) textRef.current.value = "";
    router.refresh();
  }, [state, router]);

  return (
    <div className="card">
      <form onSubmit={dispatch(action)}>
        <h2>Add your score</h2>
        <p className="sub">Tap Share in Krillion, then paste the text here. Pasting again for the same day replaces your score.</p>
        <div className="submit signed-in">
          <textarea ref={textRef} name="result" placeholder={"Krillion #118 🦐\n310\n\n🦑🐟🦑🐟🦑🫧🦑"} required />
          <button type="submit" disabled={pending}>
            {pending ? "Adding…" : "Add"}
          </button>
        </div>
      </form>
      <form action={signOut} className="as-who">
        Adding as <strong>{name}</strong> ·{" "}
        <button type="submit" className="linkish">
          Not you?
        </button>
      </form>
      {state && (
        <p className={`flash ${state.ok ? "ok" : "err"}`}>
          {state.message}
          {state.ok && state.dayNumber !== dayNumber && (
            <>
              {" "}
              <Link href={`/day/${state.dayNumber}`}>See dive #{state.dayNumber} →</Link>
            </>
          )}
        </p>
      )}
    </div>
  );
}

type Step = "choose" | "confirm" | "new" | "link";

function Gate({ names, onJoined }: { names: string[]; onJoined: (p: { name: string; code: string }) => void }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(names.length ? "choose" : "new");
  const [picked, setPicked] = useState<string | null>(null);

  const [joinState, join, joining] = useActionState<JoinState, FormData>(async (prev, fd) => {
    const r = await joinAsNewPlayer(prev, fd);
    if (r?.ok) {
      onJoined(r);
      router.refresh();
    }
    return r;
  }, null);
  const [linkState, link, linking] = useActionState<JoinState, FormData>(async (prev, fd) => {
    const r = await signInWithCode(prev, fd);
    if (r?.ok) router.refresh();
    return r;
  }, null);

  const back = (
    <button type="button" className="linkish back" onClick={() => setStep("choose")}>
      ← Back
    </button>
  );
  const linkError = linkState && !linkState.ok ? <p className="flash err">{linkState.message}</p> : null;

  return (
    <div className="card gate">
      {step === "choose" && (
        <>
          <h2>Who are you?</h2>
          <p className="sub">Pick your name to add scores. Anyone can look; only players can post.</p>
          <div className="gate-names">
            {names.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => {
                  setPicked(n);
                  setStep("confirm");
                }}
              >
                <span>{n}</span>
                <span className="muted">That&apos;s me</span>
              </button>
            ))}
          </div>
          <div className="gate-actions">
            <button type="button" className="btn" onClick={() => setStep("new")}>
              I&apos;m new here
            </button>
            <button type="button" className="linkish" onClick={() => setStep("link")}>
              Have a sync code? Enter it directly
            </button>
          </div>
        </>
      )}

      {step === "confirm" && picked && (
        <form onSubmit={dispatch(link)}>
          <h2>Welcome back, {picked}! 👋</h2>
          <p className="sub">Enter your sync code to confirm it&apos;s you. It&apos;s under your name on your other device, or ask the admin.</p>
          <input type="hidden" name="name" value={picked} />
          <div className="submit signed-in">
            <input name="code" placeholder="e.g. AB12-CD34" aria-label="Sync code" maxLength={20} autoCapitalize="characters" autoFocus required />
            <button type="submit" disabled={linking}>
              {linking ? "Checking…" : "Confirm it's me"}
            </button>
          </div>
          {linkError}
          {back}
        </form>
      )}

      {step === "link" && (
        <form onSubmit={dispatch(link)}>
          <h2>Sign in with your sync code</h2>
          <p className="sub">The 8-character code you got when you joined.</p>
          <div className="submit signed-in">
            <input name="code" placeholder="e.g. AB12-CD34" aria-label="Sync code" maxLength={20} autoCapitalize="characters" autoFocus required />
            <button type="submit" disabled={linking}>
              {linking ? "Checking…" : "Sign in"}
            </button>
          </div>
          {linkError}
          {back}
        </form>
      )}

      {step === "new" && (
        <form onSubmit={dispatch(join)}>
          <h2>Join the board</h2>
          <p className="sub">What should we call you? You&apos;ll get a sync code to use on other devices.</p>
          <div className="submit signed-in">
            <input name="name" placeholder="e.g. Sebastian" aria-label="Your name" maxLength={30} autoComplete="nickname" autoFocus required />
            <button type="submit" disabled={joining}>
              {joining ? "Joining…" : "Join"}
            </button>
          </div>
          {joinState && !joinState.ok && <p className="flash err">{joinState.message}</p>}
          {names.length > 0 && back}
        </form>
      )}
    </div>
  );
}
