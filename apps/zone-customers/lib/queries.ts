"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CustomerDto, Paginated } from "@repo/contracts";
import { api, queryString } from "@repo/web-shared";

export interface ListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
}

export interface CustomerInput {
  name: string;
  email?: string;
  phone?: string;
  taxId?: string;
  address?: string;
  notes?: string;
}

export const useCustomers = (params: { page?: number; pageSize?: number; search?: string } = {}) =>
  useQuery({
    queryKey: ["customers", params],
    queryFn: () => api.get<Paginated<CustomerDto>>(`/customers${queryString({ ...params, pageSize: params.pageSize ?? 20 })}`),
  });

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CustomerInput) => api.post<CustomerDto>("/customers", data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CustomerInput> }) => api.patch<CustomerDto>(`/customers/${id}`, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: true }>(`/customers/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["customers"] }),
  });
};
