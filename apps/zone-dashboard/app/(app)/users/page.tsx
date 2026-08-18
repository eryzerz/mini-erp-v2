"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/ui";
import { RoleGate } from "@repo/web-shell";
import { UserRole } from "@repo/contracts";

export default function UsersPage(): React.ReactElement {
  return (
    <RoleGate roles={[UserRole.ADMIN]} fallback="/dashboard">
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
        <Card>
          <CardHeader>
            <CardTitle>User administration (ADMIN only)</CardTitle>
            <CardDescription>Invite users, rotate roles and passwords.</CardDescription>
          </CardHeader>
          <CardContent>
            The users admin table lands in the next slice; the ADMIN gate and app shell are live today.
          </CardContent>
        </Card>
      </div>
    </RoleGate>
  );
}
