import type { Customer } from '../types'

export const isOverCreditLimit = (
  customer: Customer,
  saleTotal: number
): boolean => {
  const creditLimit = customer.credit_limit || 0;
  const balance = customer.outstanding_balance || 0;

  if (creditLimit <= 0) return false; // 0 means no limit set
  return (balance + saleTotal) > creditLimit;
}

export const getRemainingCredit = (customer: Customer): number => {
  const creditLimit = customer.credit_limit || 0;
  const balance = customer.outstanding_balance || 0;

  if (creditLimit <= 0) return Infinity;
  return Math.max(0, creditLimit - balance);
}
