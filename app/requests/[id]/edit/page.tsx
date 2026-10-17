import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { canManage } from "@/lib/types";
import { catalog, requestDetails } from "@/lib/service";
import { Flash, PageHead, type Params } from "@/components/ui";
import RequestForm from "@/components/RequestForm";
export default async function Edit({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Params>;
}) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^[1-9]\d{0,17}$/.test(id)) notFound();
  const data = await requestDetails(user, id);
  if (!data || !canManage(user, data.request)) notFound();
  const r = data.request;
  return (
    <>
      <Flash params={await searchParams} />
      <PageHead eyebrow={r.number} title="Edit household request" />
      {r.status === "open" ? (
        <RequestForm
          catalog={await catalog()}
          initial={{
            id: r.id,
            summary: r.summary,
            narrative: r.narrative!,
            items: data.items,
          }}
        />
      ) : (
        <p className="notice">
          An administrator must reopen this request before it can be edited.
        </p>
      )}
    </>
  );
}
