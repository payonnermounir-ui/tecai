export type Language = "ar" | "en" | "zh";

export type Theme = "dark" | "light";

export type AppTab = "dashboard" | "deposit" | "withdraw" | "team" | "admin";

export type PaymentMethod = "USDT-TRC20" | "USDT-BEP20" | "D17" | "Flouci" | "Bank";

export interface Transaction {
  id: string;
  type: "deposit" | "withdraw";
  amount: number;
  method: PaymentMethod;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface User {
  id: string;
  name: string;
  balance: number;
  teamCount: number;
}
