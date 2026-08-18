import { AppShell, SessionGate } from "@repo/web-shell";

export default function AppLayout({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <SessionGate>
      <AppShell>{children}</AppShell>
    </SessionGate>
  );
}
