"use client";

import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { useSession } from "@repo/web-shared";

import { DASHBOARD_LOGIN_URL } from "./zone-bases";

export const SessionGate = ({ children }: { children: React.ReactNode }): React.ReactElement | null => {
  const { user, loading } = useSession();

  useEffect(() => {
    if (!loading && !user) {
      // Login lives only in the dashboard zone, so a logged-out user on any
      // zone returns there. This is a cross-zone hop: a full page load
      // (window.location) so this zone's basePath is not prepended to /login,
      // and `replace` so Back does not loop back into the gate.
      window.location.replace(DASHBOARD_LOGIN_URL);
    }
  }, [loading, user]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
};
