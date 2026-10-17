import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { pool } from "@/lib/db";
import { action } from "@/app/actions";
import { Submit } from "@/components/Submit";
import { Flash, PageHead, date, type Params } from "@/components/ui";
import type { User } from "@/lib/types";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  if (user.role !== "admin") notFound();
  const { rows } = await pool.query<User>(
    "SELECT id,first_name,last_name,email,phone,role,approved,active FROM users ORDER BY approved,created_at DESC",
  );
  const { rows: history } = await pool.query(
    "SELECT a.action,a.details,a.created_at,u.email FROM audit_history a LEFT JOIN users u ON u.id=a.actor_id ORDER BY a.id DESC LIMIT 100",
  );
  return (
    <>
      <Flash params={await searchParams} />
      <PageHead
        eyebrow="Administration"
        title="Keep the community connected"
        description="Approve staff access, manage permissions, and review significant changes."
      />
      <div className="stack">
        {rows.map((u) => (
          <article className="card" key={u.id}>
            <div className="card-top">
              <div>
                <h2>
                  {u.first_name} {u.last_name}
                </h2>
                <p className="muted">
                  {u.email} · {u.phone}
                </p>
              </div>
              {u.role === "social_worker" && !u.approved && (
                <span className="badge cancelled">Approval pending</span>
              )}
            </div>
            <form action={action} className="inline-form">
              <input type="hidden" name="op" value="user" />
              <input type="hidden" name="userId" value={u.id} />
              <label>
                Role
                <select name="role" defaultValue={u.role}>
                  <option value="supporter">Supporter</option>
                  <option value="social_worker">Social worker</option>
                  <option value="admin">Administrator</option>
                </select>
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="approved"
                  value="yes"
                  defaultChecked={u.approved}
                />
                Approved for social work
              </label>
              <label className="check">
                <input
                  type="checkbox"
                  name="active"
                  value="yes"
                  defaultChecked={u.active}
                />
                Account active
              </label>
              <Submit>Save permissions</Submit>
            </form>
          </article>
        ))}
        <section className="card">
          <h2>Recent audit history</h2>
          <p className="muted">
            Most recent 100 events. Complete records remain in the database.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={i}>
                    <td>{date(h.created_at)}</td>
                    <td>{h.email}</td>
                    <td>{h.action}</td>
                    <td>
                      <code>{JSON.stringify(h.details)}</code>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
