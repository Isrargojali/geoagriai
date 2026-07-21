/**
 * PaymentProvider abstraction.
 *
 * The MVP ships with ONLY the ManualPaymentProvider (bank transfer /
 * JazzCash / EasyPaisa with human verification). The interface is designed so
 * that API-based gateways (Stripe, PayPal, …) can be added later without
 * touching the payment flow: each provider declares how a payment is
 * initiated and how it gets confirmed.
 */
import type { PaymentInstructionsDto, PaymentMethod } from '@geoagri/shared';

export interface InitiatePaymentParams {
  userId: string;
  planId: string;
  amountUsd: number;
  method: PaymentMethod;
}

export interface InitiatePaymentResult {
  /**
   * 'manual'  — the user pays externally and uploads proof; an admin approves.
   * 'redirect' — the user is redirected to a hosted checkout (future gateways).
   */
  mode: 'manual' | 'redirect';
  /** Instructions to display for manual payments. */
  instructions?: PaymentInstructionsDto;
  /** Hosted checkout URL for redirect-mode gateways. */
  redirectUrl?: string;
}

export interface PaymentProvider {
  /** Stable identifier, e.g. 'manual', 'stripe'. */
  readonly id: string;
  /** Human-readable name shown in admin tooling. */
  readonly displayName: string;
  /** Whether this provider is currently available for checkout. */
  isEnabled(): boolean;
  /** Payment methods this provider can handle. */
  supportedMethods(): PaymentMethod[];
  /** Begin a payment: returns instructions (manual) or a redirect URL (API gateways). */
  initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult>;
}

export class ProviderNotImplementedError extends Error {
  constructor(providerId: string) {
    super(
      `Payment provider "${providerId}" is scaffolded for future use but not implemented in the MVP. ` +
        'Use the manual payment provider.',
    );
    this.name = 'ProviderNotImplementedError';
  }
}
