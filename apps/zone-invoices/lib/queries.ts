"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomerDto, InvoiceCreateInput, InvoiceDto, InvoiceUpdateInput, Paginated } from "@repo/contracts";
import { api, queryString } from "@repo/web-shared";

// Kept signature-aligned with zone-customers' useCustomers so the two copies
// don't silently diverge (the invoice form is the only caller, with pageSize 100).
export const useCustomers = (params: { page?: number; pageSize?: number; search?: string } = {}) =>
  useQuery({
    queryKey: ["customers", params],
    queryFn: () => api.get<Paginated<CustomerDto>>(`/customers${queryString({ ...params, pageSize: params.pageSize ?? 20 })}`),
  });

export const useInvoices = (params: { page?: number; status?: string; search?: string } = {}) =>
  useQuery({
    queryKey: ["invoices", params],
    queryFn: () => api.get<Paginated<InvoiceDto>>(`/invoices${queryString({ ...params, pageSize: 20 })}`),
  });

export const useInvoice = (id: string) =>
  useQuery({
    queryKey: ["invoices", id],
    queryFn: () => api.get<InvoiceDto>(`/invoices/${id}`),
    enabled: Boolean(id),
  });

export const useCreateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: InvoiceCreateInput) => api.post<InvoiceDto>("/invoices", data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["invoices"] }),
  });
};

export const useUpdateInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: InvoiceUpdateInput }) => api.patch<InvoiceDto>(`/invoices/${id}`, data),
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices", invoice.id] });
    },
  });
};

export const useInvoiceAction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "send" | "mark-paid" | "cancel" }) =>
      api.post<InvoiceDto>(`/invoices/${id}/${action}`, {}),
    // Optimistic update for status transitions: the status flips immediately
    // and rolls back if the request fails.
    onMutate: async ({ id, action }) => {
      await queryClient.cancelQueries({ queryKey: ["invoices", id] });
      const previous = queryClient.getQueryData<InvoiceDto>(["invoices", id]);
      queryClient.setQueryData<InvoiceDto>(["invoices", id], (invoice) => {
        if (!invoice) return invoice;
        const toStatus =
          action === "send" ? "SENT" : action === "mark-paid" ? "PAID" : "CANCELLED";
        return {
          ...invoice,
          status: toStatus,
          ...(action === "send" ? { issueDate: new Date().toISOString().slice(0, 10) } : {}),
          ...(action === "mark-paid" ? { paidAt: new Date().toISOString() } : {}),
        };
      });
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(["invoices", context.previous.id], context.previous);
      }
    },
    onSuccess: (invoice) => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["invoices", invoice.id] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};

export const useDeleteInvoice = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: true }>(`/invoices/${id}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
      void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
};
