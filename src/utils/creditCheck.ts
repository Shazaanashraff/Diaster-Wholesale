import type { Customer } from '../types'

export const isOverCreditLimit = (
  customer: Customer,
  saleTotal: number
): boolean => {
  if (customer.credit_limit <= 0) return false // 0 means no limit set
  return (customer.outstanding_balance + saleTotal) > customer.credit_limit
}

export const getRemainingCredit = (customer: Customer): number => {
  if (customer.credit_limit <= 0) return Infinity
  return Math.max(0, customer.credit_limit - customer.outstanding_balance)
}
