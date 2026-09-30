import { redirect } from "next/navigation";
import AddressesClient from "@/components/AddressesClient";
import { getAddresses } from "@/lib/data";
import { createClient } from "@/lib/server";

export const dynamic = "force-dynamic";

export default async function AddressesPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/addresses");

  const addresses = await getAddresses(user.id);
  return <AddressesClient initial={addresses} />;
}
