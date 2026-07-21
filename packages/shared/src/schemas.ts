/** Zod validation schemas shared between frontend forms and backend API. */

import { z } from 'zod';
import { MAX_FARM_AREA_HA, PAYMENT_METHODS } from './constants.js';

// ---------- Common ----------
export const idSchema = z.string().min(10).max(40);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------- Auth ----------
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter')
  .regex(/[0-9]/, 'Password must contain a digit');

export const registerSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.toLowerCase().trim()),
  password: passwordSchema,
  firstName: z.string().min(1).max(100).trim(),
  lastName: z.string().min(1).max(100).trim(),
  phone: z
    .string()
    .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone number')
    .optional(),
});

export const loginSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
  password: z.string().min(1),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(20),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().transform((v) => v.toLowerCase().trim()),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: passwordSchema,
});

export const verifyEmailSchema = z.object({
  token: z.string().min(20),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).trim().optional(),
  lastName: z.string().min(1).max(100).trim().optional(),
  phone: z
    .string()
    .regex(/^\+?[0-9\s-]{7,20}$/, 'Invalid phone number')
    .nullable()
    .optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: passwordSchema,
});

// ---------- Geometry ----------
const positionSchema = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).rest(z.number());

const linearRingSchema = z
  .array(positionSchema)
  .min(4, 'A polygon ring needs at least 4 positions');

export const polygonSchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(linearRingSchema).min(1),
});

export const multiPolygonSchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(linearRingSchema).min(1)).min(1),
});

export const farmGeometrySchema = z.union([polygonSchema, multiPolygonSchema]);

// ---------- Farm ----------
export const createFarmSchema = z.object({
  name: z.string().min(1).max(150).trim(),
  description: z.string().max(2000).optional(),
  cropType: z.string().max(100).optional(),
  plantingDate: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
  geometry: farmGeometrySchema,
});

export const updateFarmSchema = z.object({
  name: z.string().min(1).max(150).trim().optional(),
  description: z.string().max(2000).nullable().optional(),
  cropType: z.string().max(100).nullable().optional(),
  plantingDate: z
    .string()
    .datetime({ offset: true })
    .or(z.string().date())
    .nullable()
    .optional(),
  geometry: farmGeometrySchema.optional(),
});

// ---------- Analysis ----------
export const requestAnalysisSchema = z.object({
  /** Optional target date; defaults to most recent cloud-free image. */
  endDate: z.string().date().optional(),
  /** Search window in days before endDate. */
  windowDays: z.coerce.number().int().min(5).max(120).default(30),
});

// ---------- Payments ----------
export const paymentMethodSchema = z.enum([
  PAYMENT_METHODS.JAZZCASH,
  PAYMENT_METHODS.EASYPAISA,
  PAYMENT_METHODS.BANK_TRANSFER,
]);

export const createPaymentSchema = z.object({
  planId: idSchema,
  method: paymentMethodSchema,
});

export const submitProofSchema = z.object({
  transactionId: z.string().min(3).max(100).trim(),
  amount: z.coerce.number().positive().max(100_000),
  paymentDate: z.string().date(),
  method: paymentMethodSchema,
  notes: z.string().max(1000).optional(),
});

export const rejectPaymentSchema = z.object({
  reason: z.string().min(3).max(500),
});

// ---------- Admin ----------
export const updateUserAdminSchema = z.object({
  isActive: z.boolean().optional(),
  role: z.enum(['ADMIN', 'FARMER']).optional(),
  emailVerified: z.boolean().optional(),
});

export const upsertPlanSchema = z.object({
  name: z.string().min(1).max(100),
  priceUsd: z.number().min(0).nullable(),
  billingPeriod: z.enum(['monthly', 'yearly', 'trial', 'custom']),
  maxFarms: z.number().int().min(1).nullable(),
  maxAnalysesPerDay: z.number().int().min(1).nullable(),
  maxAnalysesTotal: z.number().int().min(1).nullable(),
  features: z.array(z.string().max(200)).max(20),
  isContactSales: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateSettingsSchema = z.object({
  settings: z
    .array(
      z.object({
        key: z.string().min(1).max(100),
        value: z.string().max(2000),
      }),
    )
    .min(1)
    .max(50),
});

// Sanity guard reused by farm area validation messages
export const maxFarmAreaHa = MAX_FARM_AREA_HA;

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateFarmInput = z.infer<typeof createFarmSchema>;
export type UpdateFarmInput = z.infer<typeof updateFarmSchema>;
export type RequestAnalysisInput = z.infer<typeof requestAnalysisSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type SubmitProofInput = z.infer<typeof submitProofSchema>;
export type UpsertPlanInput = z.infer<typeof upsertPlanSchema>;
