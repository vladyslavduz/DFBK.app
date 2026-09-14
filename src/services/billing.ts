import { apiRequest } from '../lib/api';

export const billingService = {
  checkout: () => apiRequest('/billing/checkout', { method: 'POST' })
};
