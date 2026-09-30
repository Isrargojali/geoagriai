/** Zod response schemas used for serialization + OpenAPI docs. */
import { z } from 'zod';

export const userDtoSchema = z.object({
  id: z.string(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  phone: z.string().nullable(),
  role: z.string(),
  emailVerified: z.boolean(),
  isActive: z.boolean(),
  createdAt: z.string(),
});

export const tokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const authResponseSchema = z.object({
  user: userDtoSchema,
  tokens: tokensSchema,
});

export const messageSchema = z.object({ message: z.string() });

export const errorSchema = z.object({
  statusCode: z.number(),
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const geometrySchema = z.object({
  type: z.enum(['Polygon', 'MultiPolygon']),
  coordinates: z.any(),
});

export const boundaryDtoSchema = z.object({
  id: z.string(),
  geometry: geometrySchema,
  source: z.string(),
  srid: z.number(),
});

export const analysisSummarySchema = z.object({
  id: z.string(),
  farmId: z.string(),
  type: z.string(),
  status: z.string(),
  imageDate: z.string().nullable(),
  cloudCover: z.number().nullable(),
  ndviMean: z.number().nullable(),
  healthScore: z.number().nullable(),
  healthStatus: z.string().nullable(),
  createdAt: z.string(),
  completedAt: z.string().nullable(),
});

export const ndviStatisticsSchema = z.object({
  min: z.number(),
  max: z.number(),
  mean: z.number(),
  stdDev: z.number(),
  median: z.number(),
  distribution: z.object({
    critical: z.number(),
    poor: z.number(),
    moderate: z.number(),
    good: z.number(),
    excellent: z.number(),
  }),
  pixelCount: z.number(),
});

export const recommendationSchema = z.object({
  summary: z.string(),
  severity: z.enum(['info', 'warning', 'critical']),
  actions: z.array(z.string()),
  reasons: z.array(z.string()),
});

export const weatherSnapshotSchema = z.object({
  temperatureC: z.number(),
  humidityPct: z.number(),
  rainfallMm: z.number(),
  windSpeedKmh: z.number(),
  windDirectionDeg: z.number(),
  weatherCode: z.number(),
  description: z.string(),
  fetchedAt: z.string(),
});

export const forecastDaySchema = z.object({
  date: z.string(),
  tempMinC: z.number(),
  tempMaxC: z.number(),
  rainfallMm: z.number(),
  humidityPct: z.number(),
  windSpeedKmh: z.number(),
  weatherCode: z.number(),
  description: z.string(),
});

export const weatherDtoSchema = z.object({
  current: weatherSnapshotSchema,
  forecast: z.array(forecastDaySchema),
});

export const geoSearchResultSchema = z.object({
  label: z.string(),
  lat: z.number(),
  lng: z.number(),
});

export const analysisDtoSchema = analysisSummarySchema.extend({
  statistics: ndviStatisticsSchema.nullable(),
  recommendation: recommendationSchema.nullable(),
  ndviImageUrl: z.string().nullable(),
  imageBounds: z
    .tuple([z.tuple([z.number(), z.number()]), z.tuple([z.number(), z.number()])])
    .nullable(),
  weather: weatherSnapshotSchema.nullable(),
  error: z.string().nullable(),
  ndviChange: z.number().nullable(),
});

export const farmDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  cropType: z.string().nullable(),
  plantingDate: z.string().nullable(),
  areaHectares: z.number(),
  centroidLat: z.number(),
  centroidLng: z.number(),
  boundary: boundaryDtoSchema.nullable(),
  latestAnalysis: analysisSummarySchema.nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const planDtoSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  priceUsd: z.number().nullable(),
  billingPeriod: z.string(),
  maxFarms: z.number().nullable(),
  maxAnalysesPerDay: z.number().nullable(),
  maxAnalysesTotal: z.number().nullable(),
  features: z.array(z.string()),
  isContactSales: z.boolean(),
  isActive: z.boolean(),
});

export const subscriptionDtoSchema = z.object({
  id: z.string(),
  plan: planDtoSchema,
  status: z.string(),
  startDate: z.string(),
  endDate: z.string().nullable(),
  trialEndsAt: z.string().nullable(),
  daysRemaining: z.number().nullable(),
});

export const usageDtoSchema = z.object({
  farms: z.object({ used: z.number(), limit: z.number().nullable() }),
  analysesToday: z.object({ used: z.number(), limit: z.number().nullable() }),
  analysesTotal: z.object({ used: z.number(), limit: z.number().nullable() }),
  canCreateFarm: z.boolean(),
  canRunAnalysis: z.boolean(),
  blockedReason: z.string().nullable(),
});

export const paymentProofSchema = z.object({
  transactionId: z.string(),
  amount: z.number(),
  paymentDate: z.string(),
  method: z.string(),
  screenshotUrl: z.string(),
  notes: z.string().nullable(),
});

export const paymentDtoSchema = z.object({
  id: z.string(),
  planName: z.string(),
  amountUsd: z.number(),
  method: z.string(),
  status: z.string(),
  rejectReason: z.string().nullable(),
  proof: paymentProofSchema.nullable(),
  invoiceId: z.string().nullable(),
  createdAt: z.string(),
  reviewedAt: z.string().nullable(),
});

export const paymentInstructionsSchema = z.object({
  method: z.string(),
  label: z.string(),
  fields: z.array(z.object({ label: z.string(), value: z.string() })),
  qrCodeUrl: z.string().nullable(),
});

export const invoiceDtoSchema = z.object({
  id: z.string(),
  invoiceNumber: z.string(),
  amountUsd: z.number(),
  planName: z.string(),
  issuedAt: z.string(),
  downloadUrl: z.string(),
});

export const notificationDtoSchema = z.object({
  id: z.string(),
  title: z.string(),
  message: z.string(),
  type: z.string(),
  read: z.boolean(),
  createdAt: z.string(),
});

export const reportDtoSchema = z.object({
  id: z.string(),
  farmId: z.string(),
  farmName: z.string(),
  analysisId: z.string().nullable(),
  type: z.string(),
  fileName: z.string(),
  downloadUrl: z.string(),
  createdAt: z.string(),
});

export const settingDtoSchema = z.object({
  key: z.string(),
  value: z.string(),
  group: z.string(),
  label: z.string(),
  isPublic: z.boolean(),
});

export function paginatedSchema<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    total: z.number(),
    page: z.number(),
    pageSize: z.number(),
    totalPages: z.number(),
  });
}
