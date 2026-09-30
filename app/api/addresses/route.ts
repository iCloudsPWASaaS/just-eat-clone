import { jsonError, jsonOk, requireUser, requireString } from "@/lib/api";
import { getAddresses } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;
  return jsonOk({ addresses: await getAddresses(auth.userId) });
}

export async function POST(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const fields = ["firstName", "lastName", "addressLine1", "city", "postcode"] as const;
  const values: Record<string, string> = {};

  for (const f of fields) {
    const res = requireString(body, f, { maxLength: 120 });
    if ("error" in res) return jsonError(res.error);
    values[f] = res.value;
  }

  const { error } = await auth.supabase.from("addresses").insert({
    user_id: auth.userId,
    label: typeof body.label === "string" && body.label.trim() ? body.label.trim().slice(0, 40) : "Home",
    first_name: values.firstName,
    last_name: values.lastName,
    address_line1: values.addressLine1,
    address_line2: typeof body.addressLine2 === "string" ? body.addressLine2.trim().slice(0, 120) : null,
    city: values.city,
    postcode: values.postcode.toUpperCase(),
    phone: typeof body.phone === "string" ? body.phone.trim().slice(0, 40) : null,
    delivery_notes: typeof body.deliveryNotes === "string" ? body.deliveryNotes.trim().slice(0, 500) : null,
    is_default: body.isDefault === true,
  });

  if (error) return jsonError(error.message, 500);
  return jsonOk({ addresses: await getAddresses(auth.userId) }, 201);
}

export async function PUT(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const id = typeof body.id === "string" ? body.id : null;
  if (!id) return jsonError("`id` is required.");

  const patch: Record<string, unknown> = {};
  const text = (key: string, column: string, max = 120) => {
    if (typeof body[key] === "string") patch[column] = (body[key] as string).trim().slice(0, max);
  };

  text("label", "label", 40);
  text("firstName", "first_name");
  text("lastName", "last_name");
  text("addressLine1", "address_line1");
  text("addressLine2", "address_line2");
  text("city", "city");
  text("phone", "phone", 40);
  text("deliveryNotes", "delivery_notes", 500);
  if (typeof body.postcode === "string") patch.postcode = body.postcode.toUpperCase();
  if (body.isDefault === true) patch.is_default = true;

  if (Object.keys(patch).length === 0) return jsonError("Nothing to update.");

  // RLS scopes the update to the caller's own rows.
  const { error } = await auth.supabase.from("addresses").update(patch).eq("id", id);
  if (error) return jsonError(error.message, 500);

  return jsonOk({ addresses: await getAddresses(auth.userId) });
}

export async function DELETE(req: Request) {
  const auth = await requireUser();
  if ("response" in auth) return auth.response;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return jsonError("`id` is required.");

  const { error } = await auth.supabase.from("addresses").delete().eq("id", id);
  if (error) return jsonError(error.message, 500);

  return jsonOk({ addresses: await getAddresses(auth.userId) });
}
