/** Application-wide constants shared between frontend and backend. */

export const APP_NAME = 'GeoAgri AI';
export const APP_TAGLINE = 'Smart Farming from Space';

// ---------- Roles ----------
export const ROLES = {
  ADMIN: 'ADMIN',
  FARMER: 'FARMER',
} as const;
export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// ---------- Subscription ----------
export const TRIAL_DAYS = 14;

export const TRIAL_LIMITS = {
  maxFarms: 1,
  maxAnalysesPerDay: 5,
  maxAnalysesTotal: 30,
} as const;

export const SUBSCRIPTION_STATUS = {
  TRIAL: 'TRIAL',
  ACTIVE: 'ACTIVE',
  EXPIRED: 'EXPIRED',
  CANCELLED: 'CANCELLED',
} as const;
export type SubscriptionStatus =
  (typeof SUBSCRIPTION_STATUS)[keyof typeof SUBSCRIPTION_STATUS];

export const PLAN_SLUGS = {
  TRIAL: 'trial',
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;
export type PlanSlug = (typeof PLAN_SLUGS)[keyof typeof PLAN_SLUGS];

// ---------- Payments ----------
export const PAYMENT_METHODS = {
  JAZZCASH: 'JAZZCASH',
  EASYPAISA: 'EASYPAISA',
  BANK_TRANSFER: 'BANK_TRANSFER',
} as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[keyof typeof PAYMENT_METHODS];

export const PAYMENT_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;
export type PaymentStatus = (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

// ---------- Analysis ----------
export const ANALYSIS_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;
export type AnalysisStatus = (typeof ANALYSIS_STATUS)[keyof typeof ANALYSIS_STATUS];

export const ANALYSIS_TYPES = {
  NDVI: 'NDVI',
} as const;
export type AnalysisType = (typeof ANALYSIS_TYPES)[keyof typeof ANALYSIS_TYPES];

// ---------- Crop health classification ----------
export const HEALTH_STATUS = {
  EXCELLENT: 'EXCELLENT',
  GOOD: 'GOOD',
  MODERATE: 'MODERATE',
  POOR: 'POOR',
  CRITICAL: 'CRITICAL',
} as const;
export type HealthStatus = (typeof HEALTH_STATUS)[keyof typeof HEALTH_STATUS];

/**
 * NDVI thresholds used to classify mean farm NDVI into a health status.
 * These follow common agronomic interpretation of Sentinel-2 NDVI:
 *   < 0.2  bare soil / severely stressed vegetation
 *   0.2-0.4 sparse or stressed vegetation
 *   0.4-0.6 moderate vegetation
 *   0.6-0.8 dense healthy vegetation
 *   > 0.8  very dense, vigorous canopy
 */
export const NDVI_HEALTH_THRESHOLDS: ReadonlyArray<{
  min: number;
  status: HealthStatus;
}> = [
  { min: 0.7, status: HEALTH_STATUS.EXCELLENT },
  { min: 0.55, status: HEALTH_STATUS.GOOD },
  { min: 0.4, status: HEALTH_STATUS.MODERATE },
  { min: 0.25, status: HEALTH_STATUS.POOR },
  { min: -1, status: HEALTH_STATUS.CRITICAL },
];

// ---------- Farm boundary ----------
export const BOUNDARY_SOURCES = {
  DRAWN: 'DRAWN',
  GEOJSON: 'GEOJSON',
  KML: 'KML',
} as const;
export type BoundarySource = (typeof BOUNDARY_SOURCES)[keyof typeof BOUNDARY_SOURCES];

/** Max farm area accepted by the platform (hectares). */
export const MAX_FARM_AREA_HA = 10_000;
/** Min farm area accepted by the platform (hectares). */
export const MIN_FARM_AREA_HA = 0.01;

// ---------- Reports ----------
export const REPORT_TYPES = {
  PDF: 'PDF',
  CSV: 'CSV',
} as const;
export type ReportType = (typeof REPORT_TYPES)[keyof typeof REPORT_TYPES];

// ---------- Notifications ----------
export const NOTIFICATION_TYPES = {
  ANALYSIS_COMPLETED: 'ANALYSIS_COMPLETED',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  PAYMENT_APPROVED: 'PAYMENT_APPROVED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  TRIAL_EXPIRING: 'TRIAL_EXPIRING',
  TRIAL_EXPIRED: 'TRIAL_EXPIRED',
  SYSTEM: 'SYSTEM',
} as const;
export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

// ---------- Settings keys (admin-configurable, stored in DB) ----------
export const SETTING_KEYS = {
  JAZZCASH_NUMBER: 'payment.jazzcash.number',
  JAZZCASH_ACCOUNT_TITLE: 'payment.jazzcash.accountTitle',
  JAZZCASH_QR: 'payment.jazzcash.qrCodePath',
  EASYPAISA_NUMBER: 'payment.easypaisa.number',
  EASYPAISA_ACCOUNT_TITLE: 'payment.easypaisa.accountTitle',
  EASYPAISA_QR: 'payment.easypaisa.qrCodePath',
  BANK_NAME: 'payment.bank.name',
  BANK_BRANCH: 'payment.bank.branch',
  BANK_ACCOUNT_TITLE: 'payment.bank.accountTitle',
  BANK_ACCOUNT_NUMBER: 'payment.bank.accountNumber',
  BANK_IBAN: 'payment.bank.iban',
  BANK_SWIFT: 'payment.bank.swiftCode',
  SUPPORT_EMAIL: 'support.email',
  SUPPORT_WHATSAPP: 'support.whatsapp',
} as const;
export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// ---------- Audit actions ----------
export const AUDIT_ACTIONS = {
  USER_REGISTERED: 'USER_REGISTERED',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  USER_UPDATED: 'USER_UPDATED',
  PASSWORD_RESET_REQUESTED: 'PASSWORD_RESET_REQUESTED',
  PASSWORD_RESET_COMPLETED: 'PASSWORD_RESET_COMPLETED',
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  FARM_CREATED: 'FARM_CREATED',
  FARM_UPDATED: 'FARM_UPDATED',
  FARM_DELETED: 'FARM_DELETED',
  ANALYSIS_REQUESTED: 'ANALYSIS_REQUESTED',
  ANALYSIS_COMPLETED: 'ANALYSIS_COMPLETED',
  ANALYSIS_FAILED: 'ANALYSIS_FAILED',
  REPORT_GENERATED: 'REPORT_GENERATED',
  PAYMENT_SUBMITTED: 'PAYMENT_SUBMITTED',
  PAYMENT_APPROVED: 'PAYMENT_APPROVED',
  PAYMENT_REJECTED: 'PAYMENT_REJECTED',
  SUBSCRIPTION_ACTIVATED: 'SUBSCRIPTION_ACTIVATED',
  SUBSCRIPTION_CANCELLED: 'SUBSCRIPTION_CANCELLED',
  PLAN_UPDATED: 'PLAN_UPDATED',
  SETTINGS_UPDATED: 'SETTINGS_UPDATED',
  ADMIN_USER_UPDATED: 'ADMIN_USER_UPDATED',
} as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
