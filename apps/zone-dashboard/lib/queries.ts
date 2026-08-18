"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DashboardSummary, Paginated, UserDto, UserRole } from "@repo/contracts";
import { api } from "@repo/web-shared";

const queryString = (params: Record<string, string | number | undefined>): string => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const str = search.toString();
  return str ? `?${str}` : "";
};

export const useDashboard = (params: { from?: string; to?: string } = {}) =>
  useQuery({
    queryKey: ["dashboard", params],
    queryFn: () => api.get<DashboardSummary>(`/dashboard/summary${queryString(params)}`),
  });

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserInput {
  name?: string;
  role?: UserRole;
  password?: string;
}

export const useUsers = (params: { page?: number; search?: string } = {}) =>
  useQuery({
    queryKey: ["users", params],
    queryFn: () => api.get<Paginated<UserDto>>(`/users${queryString({ ...params, pageSize: 20 })}`),
  });

export const useCreateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateUserInput) => api.post<UserDto>("/users", data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserInput }) => api.patch<UserDto>(`/users/${id}`, data),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete<{ success: true }>(`/users/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
};
