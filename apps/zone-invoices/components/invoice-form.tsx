"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useFieldArray, useForm, type Control } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button, Card, CardContent, CardHeader, CardTitle, CurrencyInput, DatePicker, Form, FormControl, FormField, FormItem, FormLabel, FormMessage, Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@repo/ui";
import type { InvoiceDto } from "@repo/contracts";

import { AmountText } from "@/components/amount-text";
import { useCreateInvoice, useCustomers, useUpdateInvoice } from "@/lib/queries";

const itemSchema = z.object({
  description: z.string().min(1, "Required"),
  quantity: z.string().regex(/^\d+(\.\d+)?$/, "Must be a number"),
  unitPrice: z.string().regex(/^\d+(\.\d+)?$/, "Must be a number"),
  taxRate: z.enum(["0.00", "11.00"]),
});

const invoiceSchema = z.object({
  customerId: z.string().min(1, "Select a customer"),
  dueDate: z.string().min(1, "Required"),
  items: z.array(itemSchema).min(1, "Add at least one item"),
});

type InvoiceValues = z.infer<typeof invoiceSchema>;

const DescriptionField = ({ control, index }: { control: Control<InvoiceValues>; index: number }) => (
  <FormField
    control={control}
    name={`items.${index}.description`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Input placeholder="Service or product" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const QuantityField = ({ control, index }: { control: Control<InvoiceValues>; index: number }) => (
  <FormField
    control={control}
    name={`items.${index}.quantity`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Input
            inputMode="decimal"
            {...field}
            onBeforeInput={(event) => {
              const inserted = (event.nativeEvent as InputEvent).data;
              if (inserted == null) return;
              const next = `${event.currentTarget.value}${inserted}`;
              // digits with at most one decimal point, and no leading zero
              // before another digit (0, 0.5 are fine).
              if (!/^\d*\.?\d*$/.test(next) || /^0\d/.test(next)) {
                event.preventDefault();
              }
            }}
          />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const UnitPriceField = ({ control, index }: { control: Control<InvoiceValues>; index: number }) => (
  <FormField
    control={control}
    name={`items.${index}.unitPrice`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <CurrencyInput placeholder="Rp 0" {...field} />
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

const TaxRateField = ({ control, index }: { control: Control<InvoiceValues>; index: number }) => (
  <FormField
    control={control}
    name={`items.${index}.taxRate`}
    render={({ field }) => (
      <FormItem>
        <FormControl>
          <Select value={field.value} onValueChange={field.onChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.00">0%</SelectItem>
              <SelectItem value="11.00">11%</SelectItem>
            </SelectContent>
          </Select>
        </FormControl>
        <FormMessage />
      </FormItem>
    )}
  />
);

export function InvoiceForm({ invoice }: { invoice?: InvoiceDto }) {
  const router = useRouter();
  const { data: customers } = useCustomers({ pageSize: 100 });
  const createMutation = useCreateInvoice();
  const updateMutation = useUpdateInvoice();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<InvoiceValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      customerId: "",
      dueDate: "",
      items: [{ description: "", quantity: "1", unitPrice: "", taxRate: "11.00" }],
    },
  });

  useEffect(() => {
    if (!invoice) return;
    form.reset({
      customerId: invoice.customerId,
      dueDate: invoice.dueDate,
      items: (invoice.items ?? []).map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        taxRate: (item.taxRate === "11.00" ? "11.00" : "0.00") as "11.00" | "0.00",
      })),
    });
  }, [invoice, form]);

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });
  const items = form.watch("items");

  const totals = items.reduce(
    (acc, item) => {
      const valid = item.quantity !== "" && item.unitPrice !== "";
      if (!valid) return acc;
      const subtotal = Number(item.quantity) * Number(item.unitPrice);
      const tax = subtotal * (Number(item.taxRate) / 100);
      return { subtotal: acc.subtotal + subtotal, tax: acc.tax + tax };
    },
    { subtotal: 0, tax: 0 },
  );

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitting(true);
    try {
      const payload = {
        customerId: values.customerId,
        dueDate: values.dueDate,
        items: values.items.map((item) => ({ ...item })),
      };
      if (invoice) {
        await updateMutation.mutateAsync({ id: invoice.id, data: payload });
        toast.success("Draft updated");
        router.push(`/${invoice.id}`);
      } else {
        const created = await createMutation.mutateAsync(payload);
        toast.success("Draft invoice created");
        router.push(`/${created.id}`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save invoice");
    } finally {
      setSubmitting(false);
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={onSubmit} className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="customerId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Customer</FormLabel>
                  <FormControl>
                    {/* The Select must mount with its items already present:
                        Radix cannot display a value that matches no rendered
                        item, so while customers are still loading (e.g. when
                        editing) the trigger would stick on the placeholder. */}
                    {customers ? (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                        <SelectContent>
                          {customers.items.map((customer) => (
                            <SelectItem key={customer.id} value={customer.id}>
                              {customer.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Skeleton className="h-9 w-full" />
                    )}
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due date</FormLabel>
                  <FormControl>
                    <DatePicker id="dueDate" value={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Items</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => append({ description: "", quantity: "1", unitPrice: "", taxRate: "11.00" })}>
              <Plus /> Add item
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Desktop: tabular row layout */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40%]">Description</TableHead>
                    <TableHead className="w-20">Qty</TableHead>
                    <TableHead className="w-28">Unit price</TableHead>
                    <TableHead className="w-24">PPN</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <DescriptionField control={form.control} index={index} />
                      </TableCell>
                      <TableCell>
                        <QuantityField control={form.control} index={index} />
                      </TableCell>
                      <TableCell>
                        <UnitPriceField control={form.control} index={index} />
                      </TableCell>
                      <TableCell>
                        <TaxRateField control={form.control} index={index} />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="icon" aria-label="Remove item" onClick={() => remove(index)} disabled={fields.length === 1}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile: stacked cards with labeled fields, so the inputs get
                real width and the value stays visible while typing. */}
            <div className="space-y-3 md:hidden">
              {fields.map((field, index) => (
                <div key={field.id} className="rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <DescriptionField control={form.control} index={index} />
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove item"
                      onClick={() => remove(index)}
                      disabled={fields.length === 1}
                      className="shrink-0"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr_2fr_1fr] gap-2">
                    <div className="min-w-0">
                      <p className="mb-1 text-xs text-muted-foreground">Qty</p>
                      <QuantityField control={form.control} index={index} />
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-xs text-muted-foreground">Unit price</p>
                      <UnitPriceField control={form.control} index={index} />
                    </div>
                    <div className="min-w-0">
                      <p className="mb-1 text-xs text-muted-foreground">PPN</p>
                      <TaxRateField control={form.control} index={index} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="ml-auto w-full max-w-xs space-y-1 border-t pt-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <AmountText value={totals.subtotal.toFixed(2)} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tax (PPN)</span>
                <AmountText value={totals.tax.toFixed(2)} />
              </div>
              <div className="flex justify-between border-t pt-1 text-base font-semibold">
                <span>Total</span>
                <AmountText value={(totals.subtotal + totals.tax).toFixed(2)} />
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.push(invoice ? `/${invoice.id}` : "/")}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="animate-spin" /> : null}
                {invoice ? "Save changes" : "Save draft"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </Form>
  );
}
