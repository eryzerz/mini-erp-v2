"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, PasswordInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@repo/ui";
import { UserRole } from "@repo/contracts";
import type { UserDto } from "@repo/contracts";

import { useCreateUser, useUpdateUser } from "@/lib/queries";

const baseSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email"),
  role: z.enum([UserRole.ADMIN, UserRole.ACCOUNTANT]),
});

type UserValues = z.infer<typeof baseSchema> & { password?: string };

const userSchema = (editing: boolean) =>
  editing
    ? baseSchema.extend({
        password: z.string().min(6, "At least 6 characters").optional().or(z.literal("")),
      })
    : baseSchema.extend({
        password: z.string().min(6, "Password must be at least 6 characters"),
      });

export function UserDialog({ user, trigger }: { user?: UserDto; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();

  const form = useForm<UserValues>({
    resolver: zodResolver(userSchema(Boolean(user))),
    defaultValues: { name: "", email: "", role: UserRole.ACCOUNTANT, password: "" },
  });

  useEffect(() => {
    if (!open) return;
    form.reset(
      user
        ? { name: user.name, email: user.email, role: user.role, password: "" }
        : { name: "", email: "", role: UserRole.ACCOUNTANT, password: "" },
    );
  }, [open, user, form]);

  const submitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      if (user) {
        await updateMutation.mutateAsync({
          id: user.id,
          data: {
            name: values.name,
            role: values.role,
            ...(values.password ? { password: values.password } : {}),
          },
        });
        toast.success("User updated");
      } else {
        await createMutation.mutateAsync({
          name: values.name,
          email: values.email,
          role: values.role,
          password: values.password ?? "",
        });
        toast.success("User created");
      }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save user");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{user ? "Edit user" : "New user"}</DialogTitle>
          <DialogDescription>{user ? "Update the account's details." : "Create an account for the system."}</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={onSubmit} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Dewi Lestari" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input type="email" placeholder="dewi@slm.local" autoComplete="off" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <FormControl>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                          <SelectItem value={UserRole.ACCOUNTANT}>Accountant</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <FormLabel>{user ? "New password" : "Password"}</FormLabel>
                    <FormControl>
                      <PasswordInput
                        placeholder={user ? "Leave blank to keep" : "At least 6 characters"}
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Plus />}
                {user ? "Save changes" : "Create user"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
        <DialogClose className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
