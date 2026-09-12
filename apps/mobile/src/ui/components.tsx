import { Ionicons } from "@expo/vector-icons";
import type { PropsWithChildren, ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { Transaction, TransactionKind } from "../domain/models";
import { formatMoney } from "./format";
import { colors, kindColor } from "./theme";

export function Card({ children, style }: PropsWithChildren<{ style?: object }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <View style={styles.sectionTitle}><View style={{ flex: 1 }}><Text style={styles.sectionHeading}>{title}</Text>{subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}</View>{action}</View>;
}

const kindMeta: Record<TransactionKind, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  income: { label: "Receita", icon: "arrow-down" },
  expense: { label: "Despesa", icon: "arrow-up" },
  bill: { label: "Conta", icon: "receipt-outline" },
  investment: { label: "Investimento", icon: "trending-up" },
};

export function TransactionRow({ entry, currency, locale, onPress }: { entry: Transaction; currency: string; locale: string; onPress: () => void }) {
  const meta = kindMeta[entry.kind];
  const amountColor = entry.kind === "income" ? colors.green : colors.ink;
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.transaction, pressed && { opacity: 0.65 }]}>
    <View style={[styles.transactionIcon, { backgroundColor: `${kindColor[entry.kind]}18` }]}><Ionicons name={meta.icon} color={kindColor[entry.kind]} size={19} /></View>
    <View style={{ flex: 1 }}>
      <Text style={styles.transactionName} numberOfLines={1}>{entry.description}</Text>
      <Text style={styles.transactionMeta}>{entry.date.slice(8, 10)}/{entry.date.slice(5, 7)} · {meta.label}{entry.installmentCount ? ` · ${entry.installmentNumber}/${entry.installmentCount}` : ""}{entry.recurrenceId ? " · Mensal" : ""}</Text>
    </View>
    <View style={{ alignItems: "flex-end" }}>
      <Text style={[styles.transactionAmount, { color: amountColor }]}>{entry.kind === "income" ? "+" : "−"}{formatMoney(Math.abs(entry.amount), currency, locale)}</Text>
      {(entry.kind === "bill" || entry.kind === "investment") && <Text style={[styles.status, { color: entry.done ? colors.green : colors.gold }]}>{entry.done ? (entry.kind === "bill" ? "Pago" : "Aplicado") : "Pendente"}</Text>}
    </View>
  </Pressable>;
}

export function EmptyState({ icon, title, detail }: { icon: keyof typeof Ionicons.glyphMap; title: string; detail: string }) {
  return <View style={styles.empty}><Ionicons name={icon} size={30} color={colors.gold} /><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.line, borderWidth: 1, borderRadius: 18, padding: 18 },
  sectionTitle: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  sectionHeading: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  sectionSubtitle: { color: colors.muted, fontSize: 12, marginTop: 3 },
  transaction: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  transactionIcon: { width: 38, height: 38, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  transactionName: { color: colors.ink, fontSize: 14, fontWeight: "600" },
  transactionMeta: { color: colors.muted, fontSize: 10, marginTop: 4 },
  transactionAmount: { fontSize: 13, fontWeight: "700" },
  status: { fontSize: 10, marginTop: 4, fontWeight: "600" },
  empty: { alignItems: "center", paddingVertical: 32, paddingHorizontal: 20 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: "700", marginTop: 10 },
  emptyDetail: { color: colors.muted, textAlign: "center", fontSize: 12, lineHeight: 18, marginTop: 5 },
});
