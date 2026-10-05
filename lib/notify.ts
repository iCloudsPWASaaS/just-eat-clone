import { siteUrl } from "./env";

function formatMoney(amount: number): string {
  return "�" + amount.toFixed(2);
}

export async function sendNtfyNotification({
  reference,
  fulfilment,
  totals,
  lines,
  address,
  customerNotes,
  user,
}: {
  reference: string;
  fulfilment: "delivery" | "collection";
  totals: {
    subtotal: number;
    deliveryFee: number;
    serviceFee: number;
    discount: number;
    total: number;
    etaMinutes: number | null;
  };
  lines: Array<{
    name: string;
    variationName: string | null;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    modifiers: Array<{ name: string; quantity: number }>;
    notes: string | null;
  }>;
  address: {
    firstName: string;
    lastName: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    postcode: string;
    phone: string | null;
    deliveryNotes: string | null;
  } | null;
  customerNotes: string | null;
  user: {
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
}): Promise<void> {
  try {
    const topic = process.env.NTFY_TOPIC;
    const server = process.env.NTFY_SERVER || "https://ntfy.sh";
    const token = process.env.NTFY_TOKEN;

    if (!topic) {
      console.info("[notify] ntfy notification skipped: topic not configured.");
      return;
    }

    const linesOut: string[] = [];

    const customerName =
      (user?.firstName || user?.lastName)
        ? ((user.firstName ?? "") + " " + (user.lastName ?? "")).trim()
        : address
        ? (address.firstName + " " + address.lastName).trim()
        : null;
    if (customerName) {
      linesOut.push("Customer: " + customerName);
    }
    const phone = address?.phone ?? user?.phone ?? null;
    if (phone) {
      linesOut.push("Phone: " + phone);
    }
    if (user?.email) {
      linesOut.push("Email: " + user.email);
    }

    linesOut.push("Type: " + (fulfilment === "delivery" ? "Delivery" : "Pickup"));
    linesOut.push("Reference: " + reference);
    linesOut.push("");

    if (fulfilment === "delivery" && address) {
      linesOut.push("Delivery Address:");
      linesOut.push("  " + address.firstName + " " + address.lastName);
      linesOut.push("  " + address.addressLine1);
      if (address.addressLine2) linesOut.push("  " + address.addressLine2);
      linesOut.push("  " + address.city + " " + address.postcode);
      if (address.deliveryNotes) {
        linesOut.push("  Delivery Notes: " + address.deliveryNotes);
      }
      linesOut.push("");
    }

    if (lines.length > 0) {
      linesOut.push("Items:");
      lines.forEach((item, idx) => {
        const variation = item.variationName ? " (" + item.variationName + ")" : "";
        const modifierText = item.modifiers
          .filter((m) => m.quantity > 0)
          .map((m) => "+ " + m.name + (m.quantity > 1 ? " x" + m.quantity : ""))
          .join(", ");
        const notes = item.notes ? " [Notes: " + item.notes + "]" : "";
        linesOut.push(
          "  " + (idx + 1) + ". " + item.name + variation + " x" + item.quantity + " = " + formatMoney(item.lineTotal)
        );
        if (modifierText) {
          linesOut.push("     " + modifierText);
        }
        if (notes) {
          linesOut.push("     " + notes);
        }
      });
      linesOut.push("");
    }

    linesOut.push("Subtotal: " + formatMoney(totals.subtotal));
    if (totals.discount > 0) {
      linesOut.push("Discount: -" + formatMoney(totals.discount));
    }
    if (totals.deliveryFee > 0) {
      linesOut.push("Delivery Fee: " + formatMoney(totals.deliveryFee));
    }
    if (totals.serviceFee > 0) {
      linesOut.push("Service Fee: " + formatMoney(totals.serviceFee));
    }
    linesOut.push("Total: " + formatMoney(totals.total));
    if (totals.etaMinutes) {
      linesOut.push("ETA: ~" + totals.etaMinutes + " min");
    }
    if (customerNotes) {
      linesOut.push("");
      linesOut.push("Customer Notes: " + customerNotes);
    }

    const text = linesOut.join("\n");
    const baseUrl = server.replace(/\/$/, "");
    const url = baseUrl + "/" + encodeURIComponent(topic);

    const headers: Record<string, string> = {
      Title: "New Online Order #" + reference,
      Priority: "high",
      Tags: "shopping_cart",
    };

    if (token) {
      headers["Authorization"] = "Bearer " + token;
    }

    fetch(url, {
      method: "POST",
      headers,
      body: text,
      cache: "no-store",
    }).then((res) => {
      if (!res.ok) {
        res.text().catch(() => res.statusText).then((t) => {
          console.info("[notify] ntfy notification failed: " + t);
        });
      }
    }).catch((exception: any) => {
      console.info("[notify] ntfy notification error: " + exception.message);
    });
  } catch (exception: any) {
    console.info("[notify] ntfy notification error: " + exception.message);
  }
}
