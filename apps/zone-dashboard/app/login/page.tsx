"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  PasswordInput,
} from "@repo/ui";
import { useSession } from "@repo/web-shared";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { user, login } = useSession();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginValues>({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (user) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    setError(null);
    try {
      await login(values.email, values.password);
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <h1 className="text-xl font-semibold leading-none tracking-tight">
            SLM <span className="text-primary">ERP</span>
          </h1>
          <CardDescription>Sign in to the invoicing system</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={onSubmit} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="admin@slm.local" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <PasswordInput placeholder="••••••••" autoComplete="current-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                Sign in
              </Button>
            </form>
          </Form>
          <p className="mt-6 border-t pt-4 text-center text-xs text-muted-foreground">
            Demo account · admin@slm.local / admin123
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
