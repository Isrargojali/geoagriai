import type { PaymentProvider } from './payment-provider.js';
import { ManualPaymentProvider } from './manual.provider.js';
import {
  ApplePayProvider,
  EasyPaisaApiProvider,
  GooglePayProvider,
  JazzCashApiProvider,
  LemonSqueezyProvider,
  PaddleProvider,
  PayPalProvider,
  StripeProvider,
} from './future.providers.js';

export const manualProvider = new ManualPaymentProvider();

/** Registry of all known providers (only `manual` is enabled in the MVP). */
export const paymentProviders: readonly PaymentProvider[] = [
  manualProvider,
  new StripeProvider(),
  new PayPalProvider(),
  new GooglePayProvider(),
  new ApplePayProvider(),
  new PaddleProvider(),
  new LemonSqueezyProvider(),
  new JazzCashApiProvider(),
  new EasyPaisaApiProvider(),
];

export function getEnabledProvider(): PaymentProvider {
  const enabled = paymentProviders.find((p) => p.isEnabled());
  if (!enabled) throw new Error('No payment provider is enabled');
  return enabled;
}

export * from './payment-provider.js';
export { ManualPaymentProvider } from './manual.provider.js';
