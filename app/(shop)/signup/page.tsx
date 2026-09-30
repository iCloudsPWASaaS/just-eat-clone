import { redirect } from "next/navigation";

/** The template's original signup route — registration now lives at /register. */
export default function SignupRedirect() {
  redirect("/register");
}
