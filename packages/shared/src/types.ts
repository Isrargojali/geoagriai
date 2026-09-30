/** API data-transfer-object types shared between frontend and backend. */

import type {
  AnalysisStatus,
  AnalysisType,
  BoundarySource,
  HealthStatus,
  NotificationType,
  PaymentMethod,
  PaymentStatus,
  ReportType,
  RoleName,
  SubscriptionStatus,
} from './constants.js';

// ---------- GeoJSON (minimal subset used by the platform) ----------
export interface GeoJsonPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}

export interface GeoJsonMultiPolygon {
  type: 'MultiPolygon';
  coordinates: number[][][][];
}

export type FarmGeometry = GeoJsonPolygon | GeoJsonMultiPolygon;

// ---------- Auth / User ----------
export interface UserDto {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: RoleName;
  emailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: UserDto;
  tokens: AuthTokens;
}

// ---------- Farm ----------
export interface FarmDto {
  id: string;
  name: string;
  description: string | null;
  cropType: string | null;
  plantingDate: string | null;
  areaHectares: number;
  centroidLat: number;
  centroidLng: number;
  boundary: FarmBoundaryDto | null;
  latestAnalysis: AnalysisSummaryDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface FarmBoundaryDto {
  id: string;
  geometry: FarmGeometry;
  source: BoundarySource;
  srid: number;
}

// ---------- Analysis ----------
export interface NdviStatistics {
  min: number;
  max: number;
  mean: number;
  stdDev: number;
  median: number;
  /** Fraction of pixels in each health band, 0..1 */
  distribution: {
    critical: number;
    poor: number;
    moderate: number;
    good: number;
    excellent: number;
  };
  pixelCount: number;
}

export interface RecommendationDto {
  summary: string;
  severity: 'info' | 'warning' | 'critical';
  actions: string[];
  /** Why this recommendation was generated (explainability). */
  reasons: string[];
}

export interface AnalysisSummaryDto {
  id: string;
  farmId: string;
  type: AnalysisType;
  status: AnalysisStatus;
  imageDate: string | null;
  cloudCover: number | null;
  ndviMean: number | null;
  healthScore: number | null;
  healthStatus: HealthStatus | null;
  createdAt: string;
  completedAt: string | null;
}

export interface AnalysisDto extends AnalysisSummaryDto {
  statistics: NdviStatistics | null;
  recommendation: RecommendationDto | null;
  ndviImageUrl: string | null;
  /** [ [minLng, minLat], [maxLng, maxLat] ] bounds of the NDVI overlay */
  imageBounds: [[number, number], [number, number]] | null;
  weather: WeatherSnapshotDto | null;
  error: string | null;
  /** Change in mean NDVI vs the previous completed analysis, if any. */
  ndviChange: number | null;
}

// ---------- Weather ----------
export interface WeatherSnapshotDto {
  temperatureC: number;
  humidityPct: number;
  rainfallMm: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  weatherCode: number;
  description: string;
  fetchedAt: string;
}

export interface ForecastDayDto {
  date: string;
  tempMinC: number;
  tempMaxC: number;
  rainfallMm: number;
  humidityPct: number;
  windSpeedKmh: number;
  weatherCode: number;
  description: string;
}

export interface WeatherDto {
  current: WeatherSnapshotDto;
  forecast: ForecastDayDto[];
}

// ---------- Geocoding ----------
export interface GeoSearchResultDto {
  label: string;
  lat: number;
  lng: number;
}

// ---------- Reports ----------
export interface ReportDto {
  id: string;
  farmId: string;
  farmName: string;
  analysisId: string | null;
  type: ReportType;
  fileName: string;
  downloadUrl: string;
  createdAt: string;
}

// ---------- Notifications ----------
export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
}

// ---------- Plans / Subscriptions ----------
export interface PlanDto {
  id: string;
  name: string;
  slug: string;
  priceUsd: number | null;
  billingPeriod: 'monthly' | 'yearly' | 'trial' | 'custom';
  maxFarms: number | null;
  maxAnalysesPerDay: number | null;
  maxAnalysesTotal: number | null;
  features: string[];
  isContactSales: boolean;
  isActive: boolean;
}

export interface SubscriptionDto {
  id: string;
  plan: PlanDto;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string | null;
  trialEndsAt: string | null;
  daysRemaining: number | null;
}

export interface UsageDto {
  farms: { used: number; limit: number | null };
  analysesToday: { used: number; limit: number | null };
  analysesTotal: { used: number; limit: number | null };
  canCreateFarm: boolean;
  canRunAnalysis: boolean;
  blockedReason: string | null;
}

// ---------- Payments ----------
export interface PaymentInstructionsDto {
  method: PaymentMethod;
  label: string;
  fields: { label: string; value: string }[];
  qrCodeUrl: string | null;
}

export interface PaymentDto {
  id: string;
  planName: string;
  amountUsd: number;
  method: PaymentMethod;
  status: PaymentStatus;
  rejectReason: string | null;
  proof: PaymentProofDto | null;
  invoiceId: string | null;
  createdAt: string;
  reviewedAt: string | null;
}

export interface PaymentProofDto {
  transactionId: string;
  amount: number;
  paymentDate: string;
  method: PaymentMethod;
  screenshotUrl: string;
  notes: string | null;
}

export interface InvoiceDto {
  id: string;
  invoiceNumber: string;
  amountUsd: number;
  planName: string;
  issuedAt: string;
  downloadUrl: string;
}

// ---------- Settings ----------
export interface SettingDto {
  key: string;
  value: string;
  group: string;
  label: string;
  isPublic: boolean;
}

// ---------- Admin ----------
export interface AdminUserDto extends UserDto {
  farmCount: number;
  subscription: SubscriptionDto | null;
}

export interface AdminAnalyticsDto {
  totalUsers: number;
  activeSubscriptions: number;
  trialUsers: number;
  totalFarms: number;
  totalAnalyses: number;
  pendingPayments: number;
  revenueUsd: number;
  usersLast30Days: { date: string; count: number }[];
  analysesLast30Days: { date: string; count: number }[];
}

// ---------- Common API envelope ----------
export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
