"use client";

import { startTransition, useActionState } from "react";
import { useRouter } from "next/navigation";
import { adminDeleteScore, adminLogin, adminRename, type AdminState } from "@/app/admin/actions";

// Keeps typed values when the server rejects them, and refreshes the page data when it accepts.
function useAdminAction(fn: (prev: AdminState, fd: FormData) => Promise<AdminState>) {
  const router = useRouter();
  const [state, action, pending] = useActionState<AdminState, FormData>(async (prev, fd) => {
    const r = await fn(prev, fd);
    if (r?.ok) router.refresh();
    return r;
  }, null);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  return { state, onSubmit, pending };
}

const Flash = ({ state }: { state: AdminState }) =>
  state ? <span className={`flash ${state.ok ? "ok" : "err"}`} style={{ margin: 0 }}>{state.message}</span> : null;

export function AdminLogin() {
  const { state, onSubmit, pending } = useAdminAction(adminLogin);
  return (
    <form className="card" onSubmit={onSubmit}>
      <h2>Admin sign-in</h2>
      <div className="admin-form" style={{ marginTop: 10 }}>
        <input type="password" name="password" placeholder="Admin password" aria-label="Admin password" autoFocus required />
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Checking…" : "Sign in"}
        </button>
        <Flash state={state} />
      </div>
    </form>
  );
}

export function RenameForm({ id, name }: { id: number; name: string }) {
  const { state, onSubmit, pending } = useAdminAction(adminRename);
  return (
    <form className="admin-row" onSubmit={onSubmit}>
      <input type="hidden" name="id" value={id} />
      <input name="name" defaultValue={name} aria-label={`Name for ${name}`} maxLength={30} required />
      <button type="submit" className="btn" disabled={pending}>
        Rename
      </button>
      <Flash state={state} />
    </form>
  );
}

export function DeleteScoreForm({ players }: { players: { id: number; name: string }[] }) {
  const { state, onSubmit, pending } = useAdminAction(adminDeleteScore);
  return (
    <form
      className="admin-form"
      onSubmit={(e) => {
        if (!confirm("Delete this score?")) return e.preventDefault();
        onSubmit(e);
      }}
    >
      <select name="playerId" aria-label="Player" required defaultValue="">
        <option value="" disabled>
          Player…
        </option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <input name="dayNumber" type="number" min={1} placeholder="Dive #" aria-label="Dive number" style={{ width: 100 }} required />
      <button type="submit" className="btn danger" disabled={pending}>
        Delete score
      </button>
      <Flash state={state} />
    </form>
  );
}
