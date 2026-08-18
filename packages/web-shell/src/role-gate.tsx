"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { UserRole } from "@repo/contracts";
import { useSession } from "@repo/web-shared";

/**
 * Route-level assignment gate (ticket 07: the users admin page is ADMIN-only).
 * SessionGate above it already guarantees an authenticated user; this one
 * additionally redirects users whose role isn't in `roles` to `fallback`.
 * Like SessionGate it renders nothing while deciding, to avoid a flash.
 */
export const RoleGate = ({
  roles,
  fallback,
  children,
}: {
  roles: UserRole[];
  fallback: string;
  children: React.ReactNode;
}): React.ReactElement | null => {
  const { user, loading } = useSession();
  const router = useRouter();
  const allowed = !!user && roles.includes(user.role);

  useEffect(() => {
    if (!loading && user && !allowed) {
      router.replace(fallback);
    }
  }, [loading, user, allowed, router, fallback]);

  if (loading || !allowed) {
    return null;
  }
  return <>{children}</>;
};
