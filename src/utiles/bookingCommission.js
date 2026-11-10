const SITE_COMMISSION_RATE = 0.15;

exports.calculateBookingCommission = price => {
  if (!Number.isFinite(price) || price <= 0) {
    throw new TypeError('Price must be a positive finite number');
  }
  const grossPrice = Math.round(price * 100) / 100;
  const commissionAmount = Math.round(grossPrice * SITE_COMMISSION_RATE * 100) / 100;
  return {
    grossPrice,
    commissionRate: SITE_COMMISSION_RATE,
    commissionAmount,
    providerNetAmount: Math.round((grossPrice - commissionAmount) * 100) / 100
  };
};
