export type TransactionKind = "income" | "expense" | "bill" | "investment";
export type PaymentMethod = "pix" | "credit" | "debit" | "cash" | "transfer";
export type TagType = "category" | "label";
export type InboxStatus = "PENDING" | "ACCEPTED" | "IGNORED";
export type InboxSource =
  | "MANUAL"
  | "ANDROID_NOTIFICATION"
  | "CSV_IMPORT"
  | "LEGACY_IMPORT"
  | "FUTURE";

export type Profile = {
  locale: "pt-BR" | "en-US";
  currency: "BRL" | "USD" | "EUR";
};

export type Tag = {
  id: string;
  name: string;
  color: string;
  type: TagType;
  kind: TransactionKind;
  position: number;
};

export type Account = {
  id: string;
  name: string;
  type: "checking" | "savings" | "cash" | "other";
  institution: string | null;
  color: string;
  openingBalance: number;
  archived: boolean;
};

export type Card = {
  id: string;
  name: string;
  accountId: string | null;
  lastFour: string | null;
  closingDay: number | null;
  dueDay: number | null;
  limitCents: number | null;
  color: string;
  archived: boolean;
};

export type Transaction = {
  id: string;
  description: string;
  kind: TransactionKind;
  amount: number;
  date: string;
  month: string;
  done: boolean;
  categoryId: string | null;
  labelIds: string[];
  method: PaymentMethod;
  recurrenceId: string | null;
  deleted: boolean;
  percentageBps: number | null;
  incomeCategoryId: string | null;
  estimated: boolean;
  isCarryover: boolean;
  expectedAmount: number | null;
  paidAmount: number | null;
  accountId: string | null;
  cardId: string | null;
  installmentGroupId: string | null;
  installmentNumber: number | null;
  installmentCount: number | null;
  inboxEventId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Recurrence = {
  id: string;
  description: string;
  kind: TransactionKind;
  amount: number;
  day: number;
  startMonth: string;
  endMonth: string | null;
  categoryId: string | null;
  labelIds: string[];
  method: PaymentMethod;
  percentageBps: number | null;
  incomeCategoryId: string | null;
  accountId: string | null;
  cardId: string | null;
};

export type InboxEvent = {
  id: string;
  source: InboxSource;
  sourceEventId: string | null;
  institution: string | null;
  amount: number | null;
  suggestedKind: TransactionKind | null;
  suggestedMethod: PaymentMethod | null;
  description: string | null;
  occurredAt: string;
  status: InboxStatus;
  confidence: number | null;
  transactionId: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type TransactionDraft = {
  description: string;
  kind: TransactionKind;
  amount: number;
  date: string;
  done?: boolean;
  categoryId?: string | null;
  labelIds?: string[];
  method?: PaymentMethod;
  recurring?: boolean;
  percentageBps?: number | null;
  incomeCategoryId?: string | null;
  expectedAmount?: number | null;
  paidAmount?: number | null;
  accountId?: string | null;
  cardId?: string | null;
  installmentCount?: number;
  inboxEventId?: string | null;
};

export type MonthSummary = {
  income: number;
  expenses: number;
  bills: number;
  expectedBills: number;
  invested: number;
  estimatedInvested: number;
  unpaid: number;
  remaining: number;
};

export type Dashboard = {
  month: string;
  carryoverEnabled: boolean;
  previousBalance: number;
  entries: Transaction[];
  tags: Tag[];
  accounts: Account[];
  cards: Card[];
  recurrences: Recurrence[];
  profile: Profile;
  summary: MonthSummary;
  history: Array<MonthSummary & { month: string }>;
  pendingInboxCount: number;
};

export type NativeNotificationCandidate = {
  sourceEventId: string;
  institution: "INTER";
  amount: number;
  suggestedKind: TransactionKind;
  suggestedMethod: PaymentMethod;
  description: string;
  occurredAt: string;
  confidence: number;
};

export type AlphaFinanceSnapshot = {
  format: "alphafinance.snapshot";
  version: 1;
  createdAt: string;
  profile: Profile;
  tags: Tag[];
  accounts: Account[];
  cards: Card[];
  recurrences: Recurrence[];
  transactions: Transaction[];
  inboxEvents: InboxEvent[];
  monthSettings: Array<{ month: string; carryover: boolean }>;
};
