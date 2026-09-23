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

export type NotificationListenerStatus = {
  listenerConnected: boolean;
  lastConnectedAt: string | null;
  lastSupportedNotificationAt: string | null;
  lastParsedAt: string | null;
  lastScanAt: string | null;
  lastScanMatchCount: number;
  lastBackgroundNotificationAt: string | null;
  unparsedSupportedCount: number;
  pendingEventCount: number;
};
