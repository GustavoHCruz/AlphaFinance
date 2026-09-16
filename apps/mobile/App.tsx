import { Ionicons } from "@expo/vector-icons";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, AppState, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { BackupService } from "./src/application/backup-service";
import { SQLiteFinanceRepository } from "./src/data/sqlite-finance-repository";
import type { Dashboard, InboxEvent, Recurrence, TagType, Transaction, TransactionKind } from "./src/domain/models";
import { AndroidNotificationProvider } from "./src/providers/android-notification-provider";
import type { NotificationListenerStatus } from "./modules/alpha-native";
import { EntityModal, TransactionEditor } from "./src/ui/editors";
import { Home, Inbox, More, Transactions } from "./src/ui/screens";
import { localMonth, monthLabel, moveMonth } from "./src/ui/format";
import { colors } from "./src/ui/theme";

export type Tab = "home" | "transactions" | "inbox" | "more";
export type TransactionFilter = "all" | TransactionKind;
export type Editor = { entry?: Transaction; inbox?: InboxEvent; recurrence?: Recurrence } | null;
export type EntityEditor = {
  type: TagType;
  source?: { name: string; color: string; kinds: TransactionKind[] };
} | null;

const repository = new SQLiteFinanceRepository();
const notificationProvider = new AndroidNotificationProvider();
const backupService = new BackupService(repository);

export default function App() {
  const [tab, setTab] = useState<Tab>("home");
  const [month, setMonth] = useState(localMonth());
  const [data, setData] = useState<Dashboard | null>(null);
  const [inbox, setInbox] = useState<InboxEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<Editor>(null);
  const [entityEditor, setEntityEditor] = useState<EntityEditor>(null);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<NotificationListenerStatus | null>(null);
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>("all");

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setRefreshing(true);
    try {
      await notificationProvider.ingest(repository);
      const [dashboard, pending, access, listenerStatus] = await Promise.all([
        repository.dashboard(month),
        repository.listInbox(),
        notificationProvider.isEnabled(),
        notificationProvider.status(),
      ]);
      setData(dashboard);
      setInbox(pending);
      setNotificationEnabled(access);
      setNotificationStatus(listenerStatus);
      setError(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar os dados locais.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month]);

  useEffect(() => { void repository.initialize().then(() => refresh(true)); }, [refresh]);
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void refresh(true);
    });
    return () => subscription.remove();
  }, [refresh]);

  const action = async (work: () => Promise<unknown>, success?: string) => {
    try {
      await work();
      setEditor(null);
      setEntityEditor(null);
      await refresh(true);
      if (success) Alert.alert("Tudo certo", success);
    } catch (reason) {
      Alert.alert("Não foi possível concluir", reason instanceof Error ? reason.message : "Tente novamente.");
    }
  };

  return <SafeAreaProvider><SafeAreaView style={styles.safe} edges={["top"]}>
    <StatusBar style="dark" />
    <View style={styles.header}>
      <View><Text style={styles.brand}>AlphaFinance</Text><Text style={styles.brandCaption}>Seu dinheiro, no seu aparelho</Text></View>
      {(tab === "home" || tab === "transactions") && <View style={styles.monthPicker}>
        <Pressable onPress={() => setMonth(moveMonth(month, -1))} hitSlop={12}><Ionicons name="chevron-back" size={20} color={colors.ink} /></Pressable>
        <Text style={styles.monthText}>{monthLabel(month, data?.profile.locale)}</Text>
        <Pressable onPress={() => setMonth(moveMonth(month, 1))} hitSlop={12}><Ionicons name="chevron-forward" size={20} color={colors.ink} /></Pressable>
      </View>}
    </View>
    {error && <Pressable style={styles.error} onPress={() => refresh()}><Text style={styles.errorText}>{error} · toque para tentar novamente</Text></Pressable>}
    {loading || !data ? <View style={styles.center}><ActivityIndicator color={colors.gold} /><Text style={styles.loadingText}>Preparando seu espaço local…</Text></View> : <>
      <View style={styles.content}>
        {tab === "home" && <Home data={data} refreshing={refreshing} refresh={refresh} onEntry={(entry) => setEditor({ entry })} onNew={() => setEditor({})} onToggleDone={(entry) => action(() => repository.setTransactionDone(entry.id, !entry.done, !entry.done ? entry.expectedAmount ?? entry.amount : undefined))} onSeeAll={(filter) => { setTransactionFilter(filter); setTab("transactions"); }} />}
        {tab === "transactions" && <Transactions data={data} filter={transactionFilter} onFilter={setTransactionFilter} refreshing={refreshing} refresh={refresh} onEntry={(entry) => setEditor({ entry })} onRecurrence={(recurrence) => setEditor({ recurrence })} onDeleteRecurrence={(recurrence) => Alert.alert("Excluir recorrência?", "Os lançamentos anteriores permanecem. A ocorrência deste mês e as próximas serão removidas.", [{ text: "Cancelar", style: "cancel" }, { text: "Excluir", style: "destructive", onPress: () => void action(() => repository.stopRecurrence(recurrence.id, month)) }])} />}
        {tab === "inbox" && <Inbox events={inbox} data={data} refreshing={refreshing} refresh={refresh} onAccept={(event) => setEditor({ inbox: event })} onIgnore={(event) => action(() => repository.ignoreInbox(event.id))} />}
        {tab === "more" && <More data={data} notificationEnabled={notificationEnabled} notificationStatus={notificationStatus} refreshing={refreshing} refresh={refresh} openEntity={setEntityEditor} action={action} backupService={backupService} repository={repository} notificationProvider={notificationProvider} />}
      </View>
      <BottomBar tab={tab} inboxCount={inbox.length} onTab={setTab} onNew={() => setEditor({})} />
    </>}
    {data && editor && <TransactionEditor key={`${editor.entry?.id ?? editor.inbox?.id ?? editor.recurrence?.id ?? "new"}-${data.month}`} editor={editor} data={data} close={() => setEditor(null)} save={(draft) => action(() => editor.inbox ? repository.acceptInbox(editor.inbox.id, draft) : editor.recurrence ? repository.updateRecurrence(editor.recurrence.id, draft, month) : editor.entry ? repository.updateTransaction(editor.entry.id, draft) : repository.createTransaction(draft))} remove={editor.entry ? () => Alert.alert("Remover movimentação?", "Ela deixará de aparecer nos totais, mas o registro será mantido para consistência.", [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: () => void action(() => repository.deleteTransaction(editor.entry!.id)) }]) : undefined} stopRecurrence={editor.recurrence ? () => Alert.alert("Excluir recorrência?", "Os lançamentos anteriores permanecem; este mês e os próximos serão removidos.", [{ text: "Cancelar", style: "cancel" }, { text: "Excluir", style: "destructive", onPress: () => void action(() => repository.stopRecurrence(editor.recurrence!.id, month)) }]) : editor.entry?.recurrenceId ? () => Alert.alert("Parar recorrência?", "As ocorrências anteriores permanecem; esta e as futuras serão encerradas.", [{ text: "Cancelar", style: "cancel" }, { text: "Parar", style: "destructive", onPress: () => void action(() => repository.stopRecurrence(editor.entry!.recurrenceId!, editor.entry!.month)) }]) : undefined} />}
    {data && entityEditor && <EntityModal editor={entityEditor} close={() => setEntityEditor(null)} saveTags={(value) => action(async () => {
      if (entityEditor.source) await repository.updateTagGroup(entityEditor.source.name, value);
      else for (const kind of value.kinds) await repository.saveTag({ name: value.name, color: value.color, type: value.type, kind });
    })} remove={entityEditor.source ? () => Alert.alert(
      `Excluir ${entityEditor.type === "category" ? "categoria" : "etiqueta"}?`,
      "Ela será removida das movimentações em que é usada.",
      [{ text: "Cancelar", style: "cancel" }, { text: "Excluir", style: "destructive", onPress: () => void action(() => repository.deleteTagGroup(entityEditor.source!.name, entityEditor.type)) }],
    ) : undefined} />}
  </SafeAreaView></SafeAreaProvider>;
}

function BottomBar({ tab, inboxCount, onTab, onNew }: { tab: Tab; inboxCount: number; onTab: (tab: Tab) => void; onNew: () => void }) {
  const insets = useSafeAreaInsets();
  const items: Array<{ id: Tab; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { id: "home", label: "Início", icon: "home-outline" },
    { id: "transactions", label: "Movimentações", icon: "swap-horizontal-outline" },
    { id: "inbox", label: "Inbox", icon: "file-tray-outline" },
    { id: "more", label: "Mais", icon: "grid-outline" },
  ];
  const button = (item: typeof items[number]) => <View key={item.id} style={{ flex: 1 }}><Pressable style={styles.tabButton} onPress={() => onTab(item.id)}><Ionicons name={item.icon} size={22} color={tab === item.id ? colors.green : colors.muted} /><Text style={[styles.tabLabel, tab === item.id && styles.tabActive]}>{item.label}</Text></Pressable>{item.id === "inbox" && inboxCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{Math.min(inboxCount, 99)}</Text></View>}</View>;
  return <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, 7) }]}><View style={styles.bottomInner}>{items.slice(0, 2).map(button)}<Pressable style={styles.fab} onPress={onNew}><Ionicons name="add" size={30} color="#fff" /></Pressable>{items.slice(2).map(button)}</View></View>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { flex: 1 }, center: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12 }, loadingText: { color: colors.muted, fontSize: 12 },
  header: { paddingHorizontal: 20, height: 72, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomColor: colors.line, borderBottomWidth: StyleSheet.hairlineWidth }, brand: { color: colors.ink, fontSize: 19, fontWeight: "800" }, brandCaption: { color: colors.muted, fontSize: 9, marginTop: 2 }, monthPicker: { flexDirection: "row", alignItems: "center", gap: 6 }, monthText: { color: colors.ink, width: 118, textAlign: "center", fontSize: 11, fontWeight: "700" },
  bottom: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: StyleSheet.hairlineWidth }, bottomInner: { height: 66, flexDirection: "row", alignItems: "center", paddingHorizontal: 7 }, tabButton: { flex: 1, alignItems: "center", justifyContent: "center", gap: 3, minHeight: 58 }, tabLabel: { color: colors.muted, fontSize: 9 }, tabActive: { color: colors.green, fontWeight: "700" }, fab: { width: 54, height: 54, marginHorizontal: 5, marginTop: -24, borderRadius: 27, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", elevation: 5 }, badge: { position: "absolute", top: 6, right: 16, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 4, backgroundColor: colors.red, alignItems: "center", justifyContent: "center" }, badgeText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  error: { backgroundColor: colors.redSoft, padding: 9, alignItems: "center" }, errorText: { color: colors.red, fontSize: 10, fontWeight: "600" },
});
