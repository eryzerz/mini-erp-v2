"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, Textarea } from "@repo/ui";
import type { CustomerDto } from "@repo/contracts";
import { formatPhone, formatTaxId } from "@repo/common/format";

import { useCreateCustomer, useUpdateCustomer } from "@/lib/queries";

const customerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  taxId: z.string().optional().or(z.literal("")),
  address: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

type CustomerValues = z.infer<typeof customerSchema>;

export function CustomerDialog({
  customer,
  trigger,
}: {
  customer?: CustomerDto;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();

  const form = useForm<CustomerValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: {
      name: "",
      email: "",
      phone: "",
      taxId: "",
      address: "",
      notes: "",
    },
  });

  useEffect(() => {
    if (!open) return;
    if (customer) {
      form.reset({
        name: customer.name,
        email: customer.email ?? "",
        phone: customer.phone ?? "",
        taxId: customer.taxId ?? "",
        address: customer.address ?? "",
        notes: customer.notes ?? "",
      });
    } else {
      form.reset({ name: "", email: "", phone: "", taxId: "", address: "", notes: "" });
    }
  }, [open, customer, form]);

  const submitting = createMutation.isPending || updateMutation.isPending;

  const onSubmit = form.handleSubmit(async (values) => {
    const data = {
      name: values.name,
      ...(values.email ? { email: values.email } : {}),
      ...(values.phone ? { phone: values.phone } : {}),
      ...(values.taxId ? { taxId: values.taxId } : {}),
      ...(values.address ? { address: values.address } : {}),
      ...(values.notes ? { notes: values.notes } : {}),
    };
    try {
      if (customer) {
        await updateMutation.mutateAsync({ id: customer.id, data });
        toast.success("Customer updated");
      } else {
        await createMutation.mutateAsync(data);
        toast.success("Customer created");
      }
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save customer");
    }
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{customer ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>{customer ? "Update the customer's details." : "Add a customer to invoice."}</DialogDescription>
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
                    <Input placeholder="PT Maju Jaya" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="hello@company.id" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="+62 21 555 0134"
                        inputMode="tel"
                        autoComplete="tel"
                        {...field}
                        onChange={(event) => field.onChange(formatPhone(event.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="taxId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tax ID (NPWP)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="01.234.567.8-901.000"
                      inputMode="numeric"
                      autoComplete="off"
                      {...field}
                      onChange={(event) => field.onChange(formatTaxId(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Jl. Sudirman Kav. 52, Jakarta" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional internal notes" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : <Plus />}
                {customer ? "Save changes" : "Create customer"}
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
