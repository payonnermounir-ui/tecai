import type { PaymentMethod, Transaction } from "../types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Replace this mock service with Supabase RPC/REST calls in production.
export const api = {
  async createDeposit(amount: number, method: PaymentMethod): Promise<Transaction> {
    await delay(450);
    return {
      id: crypto.randomUUID(),
      type: "deposit",
      amount,
      method,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  },

  async createWithdrawal(amount: number, method: PaymentMethod): Promise<Transaction> {
    await delay(450);
    return {
      id: crypto.randomUUID(),
      type: "withdraw",
      amount,
      method,
      status: "pending",
      createdAt: new Date().toISOString(),
    };
  },
};
