import type {
  AlphaFinanceSnapshot,
  Dashboard,
  InboxEvent,
  NativeNotificationCandidate,
  Profile,
  Recurrence,
  Tag,
  Transaction,
  TransactionDraft,
} from "./models";

export interface FinanceRepository {
  initialize(): Promise<void>;
  dashboard(month: string): Promise<Dashboard>;
  createTransaction(draft: TransactionDraft): Promise<Transaction[]>;
  updateTransaction(id: string, draft: Partial<TransactionDraft>): Promise<void>;
  deleteTransaction(id: string): Promise<void>;
  setTransactionDone(id: string, done: boolean, actualAmount?: number): Promise<void>;
  setCarryover(month: string, enabled: boolean): Promise<void>;
  stopRecurrence(id: string, fromMonth: string): Promise<void>;
  saveTag(tag: Omit<Tag, "id" | "position"> & { id?: string }): Promise<void>;
  deleteTag(id: string): Promise<void>;
  saveProfile(profile: Profile): Promise<void>;
  enqueueNotification(candidate: NativeNotificationCandidate): Promise<void>;
  listInbox(status?: InboxEvent["status"]): Promise<InboxEvent[]>;
  acceptInbox(id: string, draft: TransactionDraft): Promise<void>;
  ignoreInbox(id: string): Promise<void>;
  exportSnapshot(): Promise<AlphaFinanceSnapshot>;
  importSnapshot(snapshot: AlphaFinanceSnapshot): Promise<void>;
}

export interface FinancialEventProvider {
  id: string;
  collect(): Promise<NativeNotificationCandidate[]>;
}

export type RecurrenceRepository = Pick<
  FinanceRepository,
  "stopRecurrence"
> & { readonly recurrence?: Recurrence };
