export type Kind = 'income' | 'expense' | 'bill' | 'investment';
export type Tag = {
  id: string;
  name: string;
  color: string;
  type: 'category' | 'label';
  kind: Kind;
  position: number;
};
export type Entry = {
  id: string;
  description: string;
  kind: Kind;
  amount: number;
  date: string;
  month: string;
  done: boolean;
  categoryId: string | null;
  labelIds: string[];
  method: string;
  recurrenceId: string | null;
  percentageBps: number | null;
  incomeCategoryId: string | null;
  estimated: boolean;
  isCarryover: boolean;
  expectedAmount: number | null;
  paidAmount: number | null;
};
export type Recurrence = Omit<
  Entry,
  'date' | 'month' | 'done' | 'recurrenceId' | 'expectedAmount' | 'paidAmount'
> & {
  startMonth: string;
  endMonth: string | null;
  day: number;
};
export type Profile = {
  locale: 'pt-BR' | 'en-US';
  currency: 'BRL' | 'USD' | 'EUR';
};
export type Summary = {
  income: number;
  expenses: number;
  bills: number;
  expectedBills: number;
  invested: number;
  remaining: number;
  unpaid: number;
  estimatedInvested: number;
};
export type Dashboard = {
  month: string;
  carryoverEnabled: boolean;
  previousBalance: number;
  entries: Entry[];
  tags: Tag[];
  recurrences: Recurrence[];
  profile: Profile;
  summary: Summary;
  history: (Summary & { month: string })[];
};
