export type NativeNotificationCandidate = {
  sourceEventId: string;
  institution: "INTER";
  amount: number;
  suggestedKind: "income" | "expense" | "bill" | "investment";
  suggestedMethod: "pix" | "credit" | "debit" | "cash" | "transfer";
  description: string;
  occurredAt: string;
  confidence: number;
};
