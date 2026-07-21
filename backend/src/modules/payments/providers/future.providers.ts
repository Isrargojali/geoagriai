/**
 * Future payment gateway scaffolds.
 *
 * These providers exist so the architecture is ready for API-based payments,
 * but per the MVP scope they are intentionally NOT implemented and are never
 * enabled. Adding a real integration means implementing `initiatePayment`
 * (plus a webhook route) and flipping `isEnabled` — no changes to the
 * checkout flow are required.
 */
import type { PaymentMethod } from '@geoagri/shared';
import {
  ProviderNotImplementedError,
  type InitiatePaymentParams,
  type InitiatePaymentResult,
  type PaymentProvider,
} from './payment-provider.js';

abstract class FutureProvider implements PaymentProvider {
  abstract readonly id: string;
  abstract readonly displayName: string;

  isEnabled(): boolean {
    return false;
  }

  supportedMethods(): PaymentMethod[] {
    return [];
  }

  async initiatePayment(_params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    throw new ProviderNotImplementedError(this.id);
  }
}

export class StripeProvider extends FutureProvider {
  readonly id = 'stripe';
  readonly displayName = 'Stripe';
}

export class PayPalProvider extends FutureProvider {
  readonly id = 'paypal';
  readonly displayName = 'PayPal';
}

export class GooglePayProvider extends FutureProvider {
  readonly id = 'googlepay';
  readonly displayName = 'Google Pay';
}

export class ApplePayProvider extends FutureProvider {
  readonly id = 'applepay';
  readonly displayName = 'Apple Pay';
}

export class PaddleProvider extends FutureProvider {
  readonly id = 'paddle';
  readonly displayName = 'Paddle';
}

export class LemonSqueezyProvider extends FutureProvider {
  readonly id = 'lemonsqueezy';
  readonly displayName = 'Lemon Squeezy';
}

export class JazzCashApiProvider extends FutureProvider {
  readonly id = 'jazzcash-api';
  readonly displayName = 'JazzCash API';
}

export class EasyPaisaApiProvider extends FutureProvider {
  readonly id = 'easypaisa-api';
  readonly displayName = 'EasyPaisa API';
}
