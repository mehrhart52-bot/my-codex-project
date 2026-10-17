import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { landingPage } from "@/lib/types";
import LoginScreen from "@/components/LoginScreen";
import type { Params } from "@/components/ui";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await currentUser();
  if (user) redirect(landingPage(user));
  return <LoginScreen params={await searchParams} />;
}
