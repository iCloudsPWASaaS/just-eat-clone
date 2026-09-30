import { redirect } from "next/navigation";
import ProfileClient from "@/components/ProfileClient";
import { createClient } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/profile");

  return (
    <ProfileClient
      user={{
        id: user.id,
        email: user.email ?? "",
        firstName: user.user_metadata?.firstName ?? null,
        lastName: user.user_metadata?.lastName ?? null,
        phone: user.user_metadata?.phone ?? null,
      }}
    />
  );
}
