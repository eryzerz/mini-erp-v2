import { redirect } from "next/navigation";

// The list lives at /customers/list: the edge that routes this zone by path
// prefix cannot serve RSC requests for the bare /customers path (client-side
// navigations would fall back to full page loads), so the zone home redirects
// into the subpath and all internal navigation targets it directly.
export const dynamic = "force-dynamic";

export default function CustomersHome(): React.ReactElement {
  redirect("/customers/list");
}
