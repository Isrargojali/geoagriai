import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  AUDIT_ACTIONS,
  NOTIFICATION_TYPES,
  type InvoiceDto,
  type PaymentDto,
  type PaymentMethod,
  type SubmitProofInput,
} from '@geoagri/shared';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { audit } from '../../lib/audit.js';
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from '../../lib/errors.js';
import { sendPaymentApprovedEmail, sendPaymentRejectedEmail } from '../../lib/mailer.js';
import { createNotification } from '../notifications/notification.service.js';
import { manualProvider } from './providers/index.js';
import { generateInvoicePdf } from './invoice.pdf.js';

const SUBSCRIPTION_DAYS = 30;
const ALLOWED_SCREENSHOT_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

type PaymentWithRelations = NonNullable<
  Awaited<
    ReturnType<
      typeof prisma.payment.findFirst<{
        where: object;
        include: { plan: true; proof: true; invoice: true };
      }>
    >
  >
>;

const paymentInclude = { plan: true, proof: true, invoice: true };

export function toPaymentDto(p: PaymentWithRelations): PaymentDto {
  return {
    id: p.id,
    planName: p.plan.name,
    amountUsd: p.amountUsd,
    method: p.method as PaymentMethod,
    status: p.status as PaymentDto['status'],
    rejectReason: p.rejectReason,
    proof: p.proof
      ? {
          transactionId: p.proof.transactionId,
          amount: p.proof.amount,
          paymentDate: p.proof.paymentDate.toISOString(),
          method: p.proof.method as PaymentMethod,
          screenshotUrl: `/api/v1/files/uploads/${path.basename(p.proof.screenshotPath)}`,
          notes: p.proof.notes,
        }
      : null,
    invoiceId: p.invoice?.id ?? null,
    createdAt: p.createdAt.toISOString(),
    reviewedAt: p.reviewedAt?.toISOString() ?? null,
  };
}

/** Step 1: user selects a plan + method → create a pending payment and return instructions. */
export async function createPayment(userId: string, planId: string, method: PaymentMethod, ipAddress?: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId } });
  if (!plan || !plan.isActive) throw new NotFoundError('Plan');
  if (plan.slug === 'trial') throw new BadRequestError('The trial plan cannot be purchased');
  if (plan.isContactSales || plan.priceUsd == null) {
    throw new BadRequestError('This plan requires contacting sales');
  }

  const existingPending = await prisma.payment.findFirst({
    where: { userId, status: 'PENDING' },
  });
  if (existingPending) {
    throw new ConflictError(
      'You already have a payment awaiting verification. Wait for review or contact support.',
    );
  }

  const payment = await prisma.payment.create({
    data: { userId, planId, amountUsd: plan.priceUsd, method },
    include: paymentInclude,
  });

  const initiation = await manualProvider.initiatePayment({
    userId,
    planId,
    amountUsd: plan.priceUsd,
    method,
  });

  await audit({
    userId,
    action: AUDIT_ACTIONS.PAYMENT_SUBMITTED,
    resource: 'payment',
    resourceId: payment.id,
    details: { planId, method, amountUsd: plan.priceUsd },
    ipAddress,
  });

  return { payment: toPaymentDto(payment), instructions: initiation.instructions ?? null };
}

/** Step 2: user uploads proof (transaction id, amount, date, screenshot). */
export async function submitProof(
  userId: string,
  paymentId: string,
  input: SubmitProofInput,
  screenshot: { buffer: Buffer; mimetype: string },
  ipAddress?: string,
): Promise<PaymentDto> {
  const payment = await prisma.payment.findFirst({
    where: { id: paymentId, userId },
    include: paymentInclude,
  });
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status !== 'PENDING') {
    throw new ConflictError(`This payment has already been ${payment.status.toLowerCase()}`);
  }
  if (payment.proof) {
    throw new ConflictError('Proof has already been submitted for this payment');
  }
  if (!ALLOWED_SCREENSHOT_TYPES.has(screenshot.mimetype)) {
    throw new BadRequestError('Screenshot must be a PNG, JPEG or WebP image');
  }

  const ext = screenshot.mimetype === 'image/png' ? 'png' : screenshot.mimetype === 'image/webp' ? 'webp' : 'jpg';
  const fileName = `proof-${payment.id}-${randomUUID().slice(0, 8)}.${ext}`;
  const filePath = path.join(env.uploadsDir, fileName);
  await writeFile(filePath, screenshot.buffer);

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      method: input.method,
      proof: {
        create: {
          transactionId: input.transactionId,
          amount: input.amount,
          paymentDate: new Date(input.paymentDate),
          method: input.method,
          screenshotPath: filePath,
          notes: input.notes ?? null,
        },
      },
    },
    include: paymentInclude,
  });

  await audit({
    userId,
    action: AUDIT_ACTIONS.PAYMENT_SUBMITTED,
    resource: 'payment',
    resourceId: payment.id,
    details: { step: 'proof', transactionId: input.transactionId, amount: input.amount },
    ipAddress,
  });

  return toPaymentDto(updated);
}

export async function listMyPayments(userId: string): Promise<PaymentDto[]> {
  const payments = await prisma.payment.findMany({
    where: { userId },
    include: paymentInclude,
    orderBy: { createdAt: 'desc' },
  });
  return payments.map(toPaymentDto);
}

/** Admin approval: activates the subscription and generates an invoice. */
export async function approvePayment(adminId: string, paymentId: string, ipAddress?: string): Promise<PaymentDto> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { ...paymentInclude, user: true },
  });
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status !== 'PENDING') {
    throw new ConflictError(`Payment is already ${payment.status.toLowerCase()}`);
  }
  if (!payment.proof) {
    throw new BadRequestError('Cannot approve a payment without submitted proof');
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + SUBSCRIPTION_DAYS * 86_400_000);

  const { updatedPayment, invoice } = await prisma.$transaction(async (tx) => {
    // Retire any previous subscription and start the paid one.
    await tx.subscription.updateMany({
      where: { userId: payment.userId, status: { in: ['TRIAL', 'ACTIVE'] } },
      data: { status: 'CANCELLED' },
    });
    const subscription = await tx.subscription.create({
      data: {
        userId: payment.userId,
        planId: payment.planId,
        status: 'ACTIVE',
        startDate: now,
        endDate,
      },
    });

    const invoiceNumber = await nextInvoiceNumber(tx);
    const createdInvoice = await tx.invoice.create({
      data: {
        invoiceNumber,
        paymentId: payment.id,
        userId: payment.userId,
        amountUsd: payment.amountUsd,
      },
    });

    const updated = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: 'APPROVED',
        subscriptionId: subscription.id,
        reviewedById: adminId,
        reviewedAt: now,
      },
      include: paymentInclude,
    });

    return { updatedPayment: updated, invoice: createdInvoice };
  });

  // Generate the invoice PDF outside the transaction (best-effort).
  try {
    const pdfPath = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      amountUsd: payment.amountUsd,
      planName: payment.plan.name,
      customerName: `${payment.user.firstName} ${payment.user.lastName}`,
      customerEmail: payment.user.email,
      method: payment.method,
      transactionId: payment.proof.transactionId,
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath } });
  } catch (err) {
    console.error('[payments] invoice PDF generation failed', err);
  }

  await audit({
    userId: adminId,
    action: AUDIT_ACTIONS.PAYMENT_APPROVED,
    resource: 'payment',
    resourceId: payment.id,
    details: { targetUserId: payment.userId, invoiceNumber: invoice.invoiceNumber },
    ipAddress,
  });
  await audit({
    userId: adminId,
    action: AUDIT_ACTIONS.SUBSCRIPTION_ACTIVATED,
    resource: 'subscription',
    details: { targetUserId: payment.userId, planId: payment.planId },
    ipAddress,
  });
  await createNotification(payment.userId, {
    title: 'Payment approved',
    message: `Your ${payment.plan.name} subscription is now active. Invoice ${invoice.invoiceNumber} is available in Billing.`,
    type: NOTIFICATION_TYPES.PAYMENT_APPROVED,
  });
  await sendPaymentApprovedEmail(
    payment.user.email,
    payment.user.firstName,
    payment.plan.name,
    invoice.invoiceNumber,
  );

  return toPaymentDto(updatedPayment);
}

export async function rejectPayment(
  adminId: string,
  paymentId: string,
  reason: string,
  ipAddress?: string,
): Promise<PaymentDto> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { ...paymentInclude, user: true },
  });
  if (!payment) throw new NotFoundError('Payment');
  if (payment.status !== 'PENDING') {
    throw new ConflictError(`Payment is already ${payment.status.toLowerCase()}`);
  }

  const updated = await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: 'REJECTED',
      rejectReason: reason,
      reviewedById: adminId,
      reviewedAt: new Date(),
    },
    include: paymentInclude,
  });

  await audit({
    userId: adminId,
    action: AUDIT_ACTIONS.PAYMENT_REJECTED,
    resource: 'payment',
    resourceId: payment.id,
    details: { targetUserId: payment.userId, reason },
    ipAddress,
  });
  await createNotification(payment.userId, {
    title: 'Payment rejected',
    message: `Your payment for the ${payment.plan.name} plan was rejected: ${reason}`,
    type: NOTIFICATION_TYPES.PAYMENT_REJECTED,
  });
  await sendPaymentRejectedEmail(
    payment.user.email,
    payment.user.firstName,
    payment.plan.name,
    reason,
  );

  return toPaymentDto(updated);
}

export async function listMyInvoices(userId: string): Promise<InvoiceDto[]> {
  const invoices = await prisma.invoice.findMany({
    where: { userId },
    include: { payment: { include: { plan: true } } },
    orderBy: { issuedAt: 'desc' },
  });
  return invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    amountUsd: inv.amountUsd,
    planName: inv.payment.plan.name,
    issuedAt: inv.issuedAt.toISOString(),
    downloadUrl: `/api/v1/payments/invoices/${inv.id}/download`,
  }));
}

export async function getInvoicePdfPath(
  userId: string,
  invoiceId: string,
  isAdmin: boolean,
): Promise<string> {
  const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice || (!isAdmin && invoice.userId !== userId)) throw new NotFoundError('Invoice');
  if (!invoice.pdfPath) {
    // Regenerate on demand if the PDF is missing (e.g. volume was recreated).
    const payment = await prisma.payment.findUnique({
      where: { id: invoice.paymentId },
      include: { plan: true, user: true, proof: true },
    });
    if (!payment) throw new NotFoundError('Invoice');
    const pdfPath = await generateInvoicePdf({
      invoiceNumber: invoice.invoiceNumber,
      issuedAt: invoice.issuedAt,
      amountUsd: invoice.amountUsd,
      planName: payment.plan.name,
      customerName: `${payment.user.firstName} ${payment.user.lastName}`,
      customerEmail: payment.user.email,
      method: payment.method,
      transactionId: payment.proof?.transactionId ?? 'N/A',
    });
    await prisma.invoice.update({ where: { id: invoice.id }, data: { pdfPath } });
    return pdfPath;
  }
  return invoice.pdfPath;
}

/** Sequential invoice numbers: GA-YYYY-000001 */
async function nextInvoiceNumber(tx: {
  invoice: { count: (args?: object) => Promise<number> };
}): Promise<string> {
  const year = new Date().getFullYear();
  const count = await tx.invoice.count();
  return `GA-${year}-${String(count + 1).padStart(6, '0')}`;
}
