"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@repo/web-shared";

import { DASHBOARD_LOGIN_URL } from "./zone-bases";

export const SessionGate = ({ children }: { children: React.ReactNode }): React.ReactElement | null => {
  const { user, loading } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      // Login lives only in the dashboard zone (ticket 07), so a logged-out
      // user on any zone returns there.
      router.replace(DASHBOARD_LOGIN_URL);
    }
  }, [loading, user, router]);

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
