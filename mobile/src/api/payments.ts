import { apiClient } from './client';

export const paymentsApi = {
  getVnpayUrl: (orderId: string, bankCode?: string) =>
    apiClient.post<any, { paymentUrl: string; txnRef: string }>(
      `/payments/vnpay/${orderId}/url`,
      { bankCode },
    ),
};

