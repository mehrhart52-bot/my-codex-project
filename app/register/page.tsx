import Link from "next/link";
import RegistrationForm from "@/components/RegistrationForm";
import { Flash, type Params } from "@/components/ui";
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<Params>;
}) {
  return (
    <div className="auth-shell wide">
      <p className="eyebrow">Join your community</p>
      <h1>Be part of a fresh start.</h1>
      <p className="muted">
        All fields are required. Your contact information is shared only with
        authorized request managers when you commit to items.
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
