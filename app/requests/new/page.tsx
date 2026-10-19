import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/types";
import { catalog } from "@/lib/service";
import { contactFromUser, summaryLimit } from "@/lib/request-contact";
import { Flash, PageHead, date, type Params } from "@/components/ui";
import RequestForm from "@/components/RequestForm";
export default async function NewRequest({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  return (
    <>
      <Flash params={await searchParams} />
      <PageHead
        eyebrow="A new beginning"
        title="Create New Request"
        description="Share the essentials a neighbor needs to settle into permanent housing."
      />
      {canCreate(user) ? (
        <div className="stack">
          <section
            className="card two-grid"
            aria-label="Automatic request details"
          >
            <div>
              <strong>Request number</strong>
              <p className="hint">Assigned automatically when submitted</p>
            </div>
            <div>
              <strong>Date created</strong>
              <p className="hint">
                {date(new Date())} · exact time recorded on submission
              </p>
            </div>
            <div>
              <strong>Requesting social worker</strong>
              <p className="hint">
                {user.first_name} {user.last_name}
              </p>
            </div>
            <div>
              <strong>Initial status</strong>
              <p className="hint">Open</p>
            </div>
          </section>
          <RequestForm
            catalog={await catalog()}
            summaryMaxLength={summaryLimit(contactFromUser(user))}
          />
        </div>
      ) : (
        <div className="notice">
          Only approved social workers and administrators can create requests.
          If you registered as a social worker, contact your administrator for
          approval.
        </div>
      )}
    </>
  );
}
