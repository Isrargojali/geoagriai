import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import type {
  AnalysisDto,
  FarmDto,
  InvoiceDto,
  NotificationDto,
  Paginated,
  PaymentDto,
  PaymentInstructionsDto,
  PaymentMethod,
  PlanDto,
  ReportDto,
  SettingDto,
  SubscriptionDto,
  GeoSearchResultDto,
  UsageDto,
  UserDto,
  WeatherDto,
} from '@geoagri/shared';
import { api } from '@/lib/api';

// ---------- Farms ----------

export function useFarms() {
  return useQuery({ queryKey: ['farms'], queryFn: () => api<FarmDto[]>('/farms') });
}

export function useFarm(farmId: string | undefined) {
  return useQuery({
    queryKey: ['farms', farmId],
    queryFn: () => api<FarmDto>(`/farms/${farmId}`),
    enabled: Boolean(farmId),
  });
}

export function useCreateFarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: object) => api<FarmDto>('/farms', { body: input }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['farms'] });
      void qc.invalidateQueries({ queryKey: ['usage'] });
    },
  });
}

export function useUploadFarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) => api<FarmDto>('/farms/upload', { formData }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['farms'] });
      void qc.invalidateQueries({ queryKey: ['usage'] });
    },
  });
}

export function useUpdateFarm(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: object) =>
      api<FarmDto>(`/farms/${farmId}`, { method: 'PATCH', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['farms'] }),
  });
}

export function useDeleteFarm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (farmId: string) => api(`/farms/${farmId}`, { method: 'DELETE' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['farms'] });
      void qc.invalidateQueries({ queryKey: ['usage'] });
    },
  });
}

// ---------- Analyses ----------

export function useAnalyses(farmId: string | undefined, page = 1) {
  return useQuery({
    queryKey: ['analyses', farmId, page],
    queryFn: () =>
      api<Paginated<AnalysisDto>>(`/farms/${farmId}/analyses?page=${page}&pageSize=10`),
    enabled: Boolean(farmId),
  });
}

export interface HistoryPoint {
  id: string;
  date: string;
  ndviMean: number;
  ndviMin: number | null;
  ndviMax: number | null;
  healthScore: number | null;
  healthStatus: string | null;
}

export function useAnalysisHistory(farmId: string | undefined) {
  return useQuery({
    queryKey: ['analyses', farmId, 'history'],
    queryFn: () => api<HistoryPoint[]>(`/farms/${farmId}/analyses/history`),
    enabled: Boolean(farmId),
  });
}

export function useAnalysis(analysisId: string | undefined) {
  return useQuery({
    queryKey: ['analysis', analysisId],
    queryFn: () => api<AnalysisDto>(`/analyses/${analysisId}`),
    enabled: Boolean(analysisId),
  });
}

export function useRunAnalysis(farmId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api<AnalysisDto>(`/farms/${farmId}/analyses`, { body: {} }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['analyses', farmId] });
      void qc.invalidateQueries({ queryKey: ['farms'] });
      void qc.invalidateQueries({ queryKey: ['usage'] });
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// ---------- Weather ----------

export function useWeather(farmId: string | undefined) {
  return useQuery({
    queryKey: ['weather', farmId],
    queryFn: () => api<WeatherDto>(`/farms/${farmId}/weather`),
    enabled: Boolean(farmId),
    staleTime: 10 * 60_000,
  });
}

// ---------- Geocoding ----------

/** Search place names / addresses for the farm boundary map search box. */
export function searchLocations(query: string, signal?: AbortSignal) {
  return api<GeoSearchResultDto[]>(`/geo/search?q=${encodeURIComponent(query)}`, { signal });
}

// ---------- Subscription / plans ----------

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: () => api<PlanDto[]>('/plans') });
}

export function useSubscription(options?: Partial<UseQueryOptions<SubscriptionDto>>) {
  return useQuery({
    queryKey: ['subscription'],
    queryFn: () => api<SubscriptionDto>('/subscription'),
    ...options,
  });
}

export function useUsage(options?: Partial<UseQueryOptions<UsageDto>>) {
  return useQuery({
    queryKey: ['usage'],
    queryFn: () => api<UsageDto>('/subscription/usage'),
    ...options,
  });
}

// ---------- Payments ----------

export function usePaymentInstructions(method: PaymentMethod | null) {
  return useQuery({
    queryKey: ['payment-instructions', method],
    queryFn: () => api<PaymentInstructionsDto>(`/payments/instructions/${method}`),
    enabled: Boolean(method),
  });
}

export function useMyPayments() {
  return useQuery({ queryKey: ['payments'], queryFn: () => api<PaymentDto[]>('/payments') });
}

export function useCreatePayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { planId: string; method: PaymentMethod }) =>
      api<{ payment: PaymentDto; instructions: PaymentInstructionsDto | null }>('/payments', {
        body: input,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}

export function useSubmitProof(paymentId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (formData: FormData) =>
      api<PaymentDto>(`/payments/${paymentId}/proof`, { formData }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['payments'] }),
  });
}

export function useMyInvoices() {
  return useQuery({
    queryKey: ['invoices'],
    queryFn: () => api<InvoiceDto[]>('/payments/invoices'),
  });
}

// ---------- Reports ----------

export function useReports() {
  return useQuery({ queryKey: ['reports'], queryFn: () => api<ReportDto[]>('/reports') });
}

export function useGenerateReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { farmId: string; type: 'PDF' | 'CSV'; analysisId?: string }) =>
      api<ReportDto>(`/reports/farms/${input.farmId}`, {
        body: { type: input.type, analysisId: input.analysisId },
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['reports'] }),
  });
}

// ---------- Notifications ----------

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api<NotificationDto[]>('/notifications'),
    refetchInterval: 60_000,
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api('/notifications/read-all', { method: 'POST', body: {} }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ---------- Settings / profile ----------

export function usePublicSettings() {
  return useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => api<SettingDto[]>('/settings/public'),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: object) => api<UserDto>('/users/me', { method: 'PATCH', body: input }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
