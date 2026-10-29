import { buildPaymentUrl, buildSignData, formatVnpDate, isVnpSuccess, signVnp, verifyVnpSignature } from './vnpay.util';

describe('vnpay.util', () => {
  const secret = 'TESTSECRETKEY1234567890';

  it('buildSignData sorts keys and encodes spaces as +', () => {
    expect(buildSignData({ vnp_b: 'x y', vnp_a: '1' })).toBe('vnp_a=1&vnp_b=x+y');
  });

  it('signature round-trips through buildPaymentUrl + verifyVnpSignature', () => {
    const url = buildPaymentUrl(
      'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      { vnp_Amount: '15000000', vnp_TxnRef: 'ABC123', vnp_OrderInfo: 'Thanh toan don hang', vnp_BankCode: '' },
      secret,
    );
    const query = Object.fromEntries(new URL(url).searchParams.entries());
    expect(query.vnp_BankCode).toBeUndefined(); // tham số rỗng bị loại bỏ
    expect(verifyVnpSignature(query, secret)).toBe(true);
  });

  it('rejects tampered amount', () => {
    const params = { vnp_Amount: '15000000', vnp_TxnRef: 'ABC123', vnp_ResponseCode: '00' };
    const query = { ...params, vnp_SecureHash: signVnp(params, secret), vnp_SecureHashType: 'HmacSHA512' };
    expect(verifyVnpSignature(query, secret)).toBe(true);
    expect(verifyVnpSignature({ ...query, vnp_Amount: '100' }, secret)).toBe(false);
    expect(verifyVnpSignature(query, 'wrong-secret')).toBe(false);
    expect(verifyVnpSignature({ ...query, vnp_SecureHash: undefined }, secret)).toBe(false);
  });

  it('formatVnpDate uses GMT+7', () => {
    expect(formatVnpDate(new Date('2024-01-31T20:05:09Z'))).toBe('20240201030509');
  });

  it('isVnpSuccess requires response code 00', () => {
    expect(isVnpSuccess({ vnp_ResponseCode: '00', vnp_TransactionStatus: '00' })).toBe(true);
    expect(isVnpSuccess({ vnp_ResponseCode: '24', vnp_TransactionStatus: '02' })).toBe(false);
  });
});

