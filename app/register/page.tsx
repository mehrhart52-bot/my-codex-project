import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { landingPage } from "@/lib/types";
import Link from "next/link";
import RegistrationForm from "@/components/RegistrationForm";
import { Flash, type Params } from "@/components/ui";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  const user = await currentUser();
  if (user) redirect(landingPage(user));
  return (
    <div className="auth-shell wide">
      <p className="eyebrow">Join your community</p>
      <h1>Create an account</h1>
      <p className="muted">
        Choose how you would like to help, then enter your contact details. All
        fields are required.
      </p>
      <Flash params={await searchParams} />
      <RegistrationForm />
      <p className="muted">
        Already registered?{" "}
        <Link className="text-link" href="/login">
          Login
        </Link>
      </p>
    </div>
  );
}
