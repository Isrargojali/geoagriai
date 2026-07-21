import { PAYMENT_METHODS, SETTING_KEYS, type PaymentInstructionsDto, type PaymentMethod } from '@geoagri/shared';
import { getSettingsMap } from '../../settings/setting.service.js';
import type {
  InitiatePaymentParams,
  InitiatePaymentResult,
  PaymentProvider,
} from './payment-provider.js';

/**
 * Manual payment verification — the only active provider in the MVP.
 * The user pays via JazzCash, EasyPaisa or bank transfer using the
 * admin-configured account details, then uploads proof for review.
 */
export class ManualPaymentProvider implements PaymentProvider {
  readonly id = 'manual';
  readonly displayName = 'Manual Payment Verification';

  isEnabled(): boolean {
    return true;
  }

  supportedMethods(): PaymentMethod[] {
    return [
      PAYMENT_METHODS.JAZZCASH,
      PAYMENT_METHODS.EASYPAISA,
      PAYMENT_METHODS.BANK_TRANSFER,
    ];
  }

  async initiatePayment(params: InitiatePaymentParams): Promise<InitiatePaymentResult> {
    const instructions = await this.getInstructions(params.method);
    return { mode: 'manual', instructions };
  }

  /** Build display instructions for a method from admin-configured settings. */
  async getInstructions(method: PaymentMethod): Promise<PaymentInstructionsDto> {
    const settings = await getSettingsMap();
    const qrUrl = (key: string): string | null => {
      const value = settings[key];
      return value ? `/api/v1/files/qr/${value}` : null;
    };

    switch (method) {
      case PAYMENT_METHODS.JAZZCASH:
        return {
          method,
          label: 'JazzCash',
          fields: compact([
            field('Account Number', settings[SETTING_KEYS.JAZZCASH_NUMBER]),
            field('Account Title', settings[SETTING_KEYS.JAZZCASH_ACCOUNT_TITLE]),
          ]),
          qrCodeUrl: qrUrl(SETTING_KEYS.JAZZCASH_QR),
        };
      case PAYMENT_METHODS.EASYPAISA:
        return {
          method,
          label: 'EasyPaisa',
          fields: compact([
            field('Account Number', settings[SETTING_KEYS.EASYPAISA_NUMBER]),
            field('Account Title', settings[SETTING_KEYS.EASYPAISA_ACCOUNT_TITLE]),
          ]),
          qrCodeUrl: qrUrl(SETTING_KEYS.EASYPAISA_QR),
        };
      case PAYMENT_METHODS.BANK_TRANSFER:
      default:
        return {
          method,
          label: 'Direct Bank Transfer',
          fields: compact([
            field('Bank Name', settings[SETTING_KEYS.BANK_NAME]),
            field('Branch', settings[SETTING_KEYS.BANK_BRANCH]),
            field('Account Title', settings[SETTING_KEYS.BANK_ACCOUNT_TITLE]),
            field('Account Number', settings[SETTING_KEYS.BANK_ACCOUNT_NUMBER]),
            field('IBAN', settings[SETTING_KEYS.BANK_IBAN]),
            field('SWIFT Code', settings[SETTING_KEYS.BANK_SWIFT]),
          ]),
          qrCodeUrl: null,
        };
    }
  }
}

function field(label: string, value: string | undefined): { label: string; value: string } | null {
  return value ? { label, value } : null;
}

function compact<T>(items: Array<T | null>): T[] {
  return items.filter((i): i is T => i !== null);
}
