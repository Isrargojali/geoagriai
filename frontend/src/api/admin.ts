import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  AdminAnalyticsDto,
  Paginated,
  PaymentDto,
  PlanDto,
  SettingDto,
  SubscriptionDto,
  UserDto,
} from '@geoagri/shared';
import { api } from '@/lib/api';

export interface AdminOwner {
  id: string;
  email: string;
  name: string;
}

export interface AdminUser extends UserDto {
  farmCount: number;
  subscription: SubscriptionDto | null;
}

export interface AdminFarm {
  id: string;
  name: string;
  areaHectares: number;
  cropType: string | null;
  centroidLat: number;
  centroidLng: number;
  analysisCount: number;
  owner: AdminOwner;
  createdAt: string;
}

export type AdminPayment = PaymentDto & { user: AdminOwner };
export type AdminSubscription = SubscriptionDto & { user: AdminOwner };

export function useAdminAnalytics() {
  return useQuery({
    queryKey: ['admin', 'analytics'],
    queryFn: () => api<AdminAnalyticsDto>('/admin/analytics'),
  });
}

export function useAdminUsers(page: number, search: string) {
  return useQuery({
    queryKey: ['admin', 'users', page, search],
    queryFn: () =>
      api<Paginated<AdminUser>>(
        `/admin/users?page=${page}&pageSize=20${search ? `&search=${encodeURIComponent(search)}` : ''}`,
      ),
  });
}

export function useAdminUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { userId: string; updates: object }) =>
      api<UserDto>(`/admin/users/${input.userId}`, { method: 'PATCH', body: input.updates }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useAdminFarms(page: number) {
  return useQuery({
    queryKey: ['admin', 'farms', page],
    queryFn: () => api<Paginated<AdminFarm>>(`/admin/farms?page=${page}&pageSize=20`),
  });
}

export function useAdminPayments(status: string | undefined, page: number) {
  return useQuery({
    queryKey: ['admin', 'payments', status, page],
    queryFn: () =>
      api<Paginated<AdminPayment>>(
        `/admin/payments?page=${page}&pageSize=20${status ? `&status=${status}` : ''}`,
      ),
  });
}

export function useApprovePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paymentId: string) =>
      api<PaymentDto>(`/admin/payments/${paymentId}/approve`, { method: 'POST', body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin'] });
    },
  });
}

export function useRejectPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { paymentId: string; reason: string }) =>
      api<PaymentDto>(`/admin/payments/${input.paymentId}/reject`, {
        method: 'POST',
        body: { reason: input.reason },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin'] }),
  });
}

export function useAdminSubscriptions(page: number) {
  return useQuery({
    queryKey: ['admin', 'subscriptions', page],
    queryFn: () =>
      api<Paginated<AdminSubscription>>(`/admin/subscriptions?page=${page}&pageSize=20`),
  });
}

export function useAdminCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscriptionId: string) =>
      api<SubscriptionDto>(`/admin/subscriptions/${subscriptionId}/cancel`, {
        method: 'POST',
        body: {},
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['admin', 'subscriptions'] }),
  });
}

export function useAdminPlans() {
  return useQuery({
    queryKey: ['admin', 'plans'],
    queryFn: () => api<PlanDto[]>('/admin/plans'),
  });
}

export function useAdminUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { planId: string; plan: object }) =>
      api<PlanDto>(`/admin/plans/${input.planId}`, { method: 'PUT', body: input.plan }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'plans'] });
      void qc.invalidateQueries({ queryKey: ['plans'] });
    },
  });
}

export function useAdminSettings() {
  return useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api<SettingDto[]>('/admin/settings'),
  });
}

export function useAdminUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Array<{ key: string; value: string }>) =>
      api<SettingDto[]>('/admin/settings', { method: 'PUT', body: { settings } }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
      void qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
