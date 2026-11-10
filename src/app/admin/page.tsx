import { Suspense } from "react";
import { connection } from "next/server";
import { adminConfigured, isAdmin } from "@/lib/auth";
import { listMembers } from "@/lib/db";
import { adminLogout } from "./actions";
import { AdminLogin, DeleteScoreForm, RenameForm } from "@/components/admin/AdminForms";
import { formatCode } from "@/lib/sync-code";

export default function AdminPage() {
  return (
    <>
      <h1>Admin</h1>
      <Suspense fallback={<p className="empty">Loading…</p>}>
        <Admin />
      </Suspense>
    </>
  );
}

async function Admin() {
  await connection();
  if (!adminConfigured()) {
    return (
      <div className="card">
        <h2>Admin is switched off</h2>
        <p className="sub" style={{ margin: 0 }}>
          Set <code>ADMIN_PASSWORD</code> in the server&apos;s environment (for example in <code>.env.local</code>) and restart the
          server.
        </p>
      </div>
    );
  }
  if (!(await isAdmin())) return <AdminLogin />;

  const members = await listMembers();
  return (
    <>
      <p className="sub">Look up sync codes for people who lost theirs, fix names and remove wrong scores.</p>
      <section className="card">
        <h2>Players</h2>
        <p className="sub">A sync code is a player&apos;s login. Only share it with that player.</p>
        <div className="scroll-x">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Sync code</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    <RenameForm id={m.id} name={m.name} />
                  </td>
                  <td className="mono">{formatCode(m.code)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card">
        <h2>Delete a score</h2>
        <p className="sub">For a mistaken paste. The player can then paste the right one.</p>
        <DeleteScoreForm players={members.map((m) => ({ id: m.id, name: m.name }))} />
      </section>
      <form action={adminLogout}>
        <button type="submit" className="linkish">
          Sign out of admin
        </button>
      </form>
    </>
  );
}
