import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";
import { Alert, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import type { EntityEditor, TransactionFilter } from "../../App";
import type { BackupService } from "../application/backup-service";
import type { SQLiteFinanceRepository } from "../data/sqlite-finance-repository";
import type { Dashboard, InboxEvent, Recurrence, Tag, TagType, Transaction, TransactionKind } from "../domain/models";
import type { AndroidNotificationProvider } from "../providers/android-notification-provider";
import type { NotificationListenerStatus } from "../../modules/alpha-native";
import { Card, EmptyState, SectionTitle, TransactionRow } from "./components";
import { formatMoney, monthLabel } from "./format";
import { colors } from "./theme";

type RefreshProps = { refreshing: boolean; refresh: () => Promise<void> };
const kindLabels: Record<TransactionKind, string> = { income: "Receita", expense: "Despesa", bill: "Conta", investment: "Investimento" };
const kinds: TransactionKind[] = ["income", "expense", "bill", "investment"];

export function Home({ data, refreshing, refresh, onEntry, onNew, onToggleDone, onSeeAll }: RefreshProps & { data: Dashboard; onEntry: (entry: Transaction) => void; onNew: () => void; onToggleDone: (entry: Transaction) => void; onSeeAll: (filter: TransactionKind) => void }) {
  const currency = data.profile.currency, locale = data.profile.locale;
  const bills = useMemo(() => checklistOrder(data.entries.filter((entry) => entry.kind === "bill" && !entry.done)), [data.entries]);
  const investments = useMemo(() => checklistOrder(data.entries.filter((entry) => entry.kind === "investment")), [data.entries]);
  const recent = useMemo(() => data.entries
    .filter((entry) => !["bill", "investment"].includes(entry.kind) || entry.done)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8), [data.entries]);
  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}>
    <Text style={styles.eyebrow}>VISÃO DO MÊS</Text><Text style={styles.title}>Olá</Text><Text style={styles.subtitle}>Um retrato simples do que entrou, saiu e ficou.</Text>
    <Card style={styles.balanceCard}><Text style={styles.balanceLabel}>SALDO DISPONÍVEL</Text><Text style={[styles.balance, data.summary.remaining < 0 && { color: "#FFB6AE" }]}>{formatMoney(data.summary.remaining, currency, locale)}</Text><Text style={styles.balanceHint}>Contas e investimentos pendentes não reduzem este valor.</Text></Card>
    <View style={styles.summaryGrid}>
      <Summary label="Receitas" value={data.summary.income} color={colors.green} currency={currency} locale={locale} onPress={() => onSeeAll("income")} />
      <Summary label="Despesas" value={data.summary.expenses} color={colors.red} currency={currency} locale={locale} onPress={() => onSeeAll("expense")} />
      <Summary label="Investimentos" value={data.summary.invested} color={colors.blue} currency={currency} locale={locale} onPress={() => onSeeAll("investment")} />
      <Summary label="Contas pagas" value={data.summary.bills - data.summary.unpaid} secondary={{ label: "Pendente", value: data.summary.unpaid }} color={colors.gold} currency={currency} locale={locale} onPress={() => onSeeAll("bill")} />
    </View>
    <FinanceCharts data={data} />
    <ChecklistSection title="Contas" rows={bills} data={data} onEntry={onEntry} onToggle={onToggleDone} onSeeAll={() => onSeeAll("bill")} emptyMessage="Nenhuma conta pendente! Parabéns!" />
    <ChecklistSection title="Investimentos" rows={investments} data={data} onEntry={onEntry} onToggle={onToggleDone} onSeeAll={() => onSeeAll("investment")} subtitle={investments.length ? `${investments.length} investimento(s) neste mês` : undefined} />
    <View style={styles.sectionGap}><SectionTitle title="Movimentações recentes" subtitle="Toque para revisar ou editar" action={<Pressable onPress={onNew}><Text style={styles.link}>Adicionar</Text></Pressable>} />
      <Card>{recent.length ? recent.map((entry) => <TransactionRow key={entry.id} entry={entry} currency={currency} locale={locale} onPress={() => onEntry(entry)} />) : <EmptyState icon="leaf-outline" title="Um mês em branco" detail="Adicione a primeira receita ou despesa. Tudo ficará somente neste aparelho." />}</Card>
    </View>
    <Card style={[styles.privacyCard, styles.sectionGap]}><Ionicons name="lock-closed-outline" size={22} color={colors.green} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Privado por arquitetura</Text><Text style={styles.rowDetail}>Sem analytics, crash reporting remoto, contas bancárias, agregadores ou servidor. SQLite é a fonte de verdade.</Text></View></Card>
  </ScrollView>;
}

function checklistOrder(rows: Transaction[]) {
  return [...rows].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    return a.done ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });
}

function ChecklistSection({ title, rows, data, onEntry, onToggle, onSeeAll, emptyMessage, subtitle }: { title: string; rows: Transaction[]; data: Dashboard; onEntry: (entry: Transaction) => void; onToggle: (entry: Transaction) => void; onSeeAll: () => void; emptyMessage?: string; subtitle?: string }) {
  return <View style={styles.sectionGap}><SectionTitle title={title} subtitle={rows.length ? subtitle ?? `${rows.filter((entry) => !entry.done).length} pendente(s) neste mês` : emptyMessage ?? "Nenhum lançamento neste mês"} action={<SeeAll onPress={onSeeAll} />} /><Card>{rows.length ? rows.map((entry) => <View key={entry.id} style={styles.checklistRow}><Pressable onPress={() => onToggle(entry)} hitSlop={8} accessibilityLabel={`${entry.done ? "Desmarcar" : "Marcar"} ${entry.description}`}><Ionicons name={entry.done ? "checkbox" : "square-outline"} size={25} color={entry.done ? colors.green : colors.gold} /></Pressable><Pressable style={styles.checklistContent} onPress={() => onEntry(entry)}><Text style={[styles.rowTitle, entry.done && styles.completedText]} numberOfLines={1}>{entry.description}</Text><Text style={styles.rowDetail}>{entry.date.slice(8, 10)}/{entry.date.slice(5, 7)} · {entry.done ? (entry.kind === "bill" ? "Paga" : "Aplicado") : "Pendente"}</Text></Pressable><Text style={[styles.checklistAmount, entry.done && { color: colors.muted }]}>{formatMoney(entry.amount, data.profile.currency, data.profile.locale)}</Text></View>) : <View style={styles.congratulations}><Ionicons name="checkmark-circle" size={24} color={colors.green} /><Text style={styles.congratulationsText}>{emptyMessage ?? `A lista aparecerá aqui quando houver ${title.toLocaleLowerCase(data.profile.locale)}.`}</Text></View>}</Card></View>;
}

function SeeAll({ onPress }: { onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.seeAll}><Text style={styles.link}>Ver todos</Text><Ionicons name="arrow-forward" size={15} color={colors.green} /></Pressable>;
}

function Summary({ label, value, secondary, color, currency, locale, onPress }: { label: string; value: number; secondary?: { label: string; value: number }; color: string; currency: string; locale: string; onPress: () => void }) {
  const secondaryDescription = secondary ? `. ${secondary.label}: ${formatMoney(secondary.value, currency, locale)}` : "";
  return <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${formatMoney(value, currency, locale)}${secondaryDescription}. Ver movimentações`} onPress={onPress} style={({ pressed }) => [styles.summaryPressable, pressed && styles.summaryPressed]}><Card style={styles.summaryCard}><View style={styles.summaryHeading}><View style={[styles.summaryDot, { backgroundColor: color }]} /><Ionicons name="arrow-forward" size={14} color={colors.muted} /></View><Text style={styles.summaryLabel}>{label}</Text><View style={styles.summaryAmounts}><Text style={[styles.summaryValue, secondary && styles.summaryValueWithSecondary]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatMoney(value, currency, locale)}</Text>{secondary && <View style={styles.summarySecondary}><Text style={styles.summarySecondaryLabel}>{secondary.label}</Text><Text style={styles.summarySecondaryValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>{formatMoney(secondary.value, currency, locale)}</Text></View>}</View></Card></Pressable>;
}

function FinanceCharts({ data }: { data: Dashboard }) {
  const [page, setPage] = useState(0);
  const [pageWidth, setPageWidth] = useState(320);
  const handlePage = (event: NativeSyntheticEvent<NativeScrollEvent>) => setPage(Math.round(event.nativeEvent.contentOffset.x / Math.max(1, pageWidth)));
  return <Card style={styles.chartCard}><View onLayout={(event) => setPageWidth(Math.round(event.nativeEvent.layout.width))}>
    <ScrollView horizontal pagingEnabled nestedScrollEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={handlePage}>
      <View style={[styles.chartPage, { width: pageWidth }]}><SectionTitle title="Fluxo dos últimos 6 meses" subtitle="Entradas e saídas · deslize para detalhar" /><CashFlow data={data} /></View>
      <View style={[styles.chartPage, { width: pageWidth }]}><SectionTitle title="Pra onde foi seu dinheiro" subtitle="Despesas pagas por categoria neste mês" /><CategoryPie data={data} /></View>
      <View style={[styles.chartPage, { width: pageWidth }]}><SectionTitle title="Gastos do mês por etiqueta" subtitle="Despesas com várias etiquetas aparecem em cada uma" /><LabelExpenses data={data} /></View>
    </ScrollView>
    <View style={styles.pageDots}>{[0, 1, 2].map((index) => <View key={index} style={[styles.pageDot, page === index && styles.pageDotActive]} />)}</View>
  </View></Card>;
}

function CashFlow({ data }: { data: Dashboard }) {
  const max = Math.max(1, ...data.history.flatMap((item) => [item.income, item.invested, item.expenses, item.bills - item.unpaid]));
  const bars = [
    { label: "Receitas", color: colors.green, amount: (item: Dashboard["history"][number]) => item.income },
    { label: "Investimentos", color: colors.blue, amount: (item: Dashboard["history"][number]) => item.invested },
    { label: "Despesas", color: colors.red, amount: (item: Dashboard["history"][number]) => item.expenses },
    { label: "Contas pagas", color: colors.gold, amount: (item: Dashboard["history"][number]) => item.bills - item.unpaid },
  ];
  return <><View style={styles.chart}>{data.history.map((item) => <View key={item.month} style={styles.barGroup}><View style={styles.bars}>{bars.map((bar) => <View key={bar.label} style={[styles.bar, { height: Math.max(2, 92 * Math.max(0, bar.amount(item)) / max), backgroundColor: bar.color }]} />)}</View><Text style={styles.barLabel}>{new Date(`${item.month}-01T12:00:00`).toLocaleDateString(data.profile.locale, { month: "short" }).replace(".", "")}</Text></View>)}</View><View style={styles.cashFlowLegend}>{bars.map((bar) => <View key={bar.label} style={styles.cashFlowLegendItem}><View style={[styles.colorDot, { backgroundColor: bar.color }]} /><Text style={styles.cashFlowLegendLabel}>{bar.label}</Text></View>)}</View></>;
}

function CategoryPie({ data }: { data: Dashboard }) {
  const slices = useMemo(() => {
    const tags = new Map(data.tags.map((tag) => [tag.id, tag]));
    const grouped = new Map<string, { name: string; color: string; amount: number }>();
    for (const entry of data.entries.filter((item) => !item.isCarryover && (item.kind === "expense" || (item.kind === "bill" && item.done)) && item.amount > 0)) {
      const tag = entry.categoryId ? tags.get(entry.categoryId) : undefined;
      const name = tag?.name ?? "Sem categoria";
      const key = name.trim().toLocaleLowerCase(data.profile.locale);
      const current = grouped.get(key) ?? { name, color: tag?.color ?? colors.muted, amount: 0 };
      current.amount += entry.amount;
      grouped.set(key, current);
    }
    return [...grouped.values()].sort((a, b) => b.amount - a.amount);
  }, [data.entries, data.profile.locale, data.tags]);
  const total = slices.reduce((sum, item) => sum + item.amount, 0);
  if (!total) return <View style={styles.pieEmpty}><Ionicons name="pie-chart-outline" size={34} color={colors.gold} /><Text style={styles.emptyInline}>Classifique despesas para ver a distribuição do mês.</Text></View>;
  const size = 124, radius = 45, circumference = 2 * Math.PI * radius;
  let offset = 0;
  return <View style={styles.pieLayout}><View style={{ width: size, height: size }}><Svg width={size} height={size}><Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={colors.line} strokeWidth={23} />{slices.map((slice) => { const length = slice.amount / total * circumference; const dashOffset = -offset; offset += length; return <Circle key={slice.name} cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={slice.color} strokeWidth={23} strokeDasharray={`${length} ${circumference}`} strokeDashoffset={dashOffset} rotation={-90} origin={`${size / 2}, ${size / 2}`} />; })}</Svg><View style={styles.pieCenter}><Text style={styles.pieCenterLabel}>Total</Text><Text style={styles.pieCenterValue}>{formatMoney(total, data.profile.currency, data.profile.locale)}</Text></View></View><View style={styles.pieLegend}>{slices.map((slice) => <View key={slice.name} style={styles.legendRow}><View style={[styles.colorDot, { backgroundColor: slice.color }]} /><View style={{ flex: 1 }}><Text style={styles.legendName} numberOfLines={1}>{slice.name}</Text><Text style={styles.legendValue} numberOfLines={1}>{formatMoney(slice.amount, data.profile.currency, data.profile.locale)}</Text></View></View>)}</View></View>;
}

function LabelExpenses({ data }: { data: Dashboard }) {
  const rows = useMemo(() => {
    const tags = new Map(data.tags.map((tag) => [tag.id, tag]));
    const grouped = new Map<string, { name: string; color: string; amount: number }>();
    for (const entry of data.entries.filter((item) => !item.isCarryover && item.kind === "expense" && item.amount > 0)) {
      const entryLabels = entry.labelIds.map((labelId) => tags.get(labelId)).filter((tag): tag is Tag => !!tag);
      const labels = entryLabels.length ? entryLabels : [null];
      for (const tag of labels) {
        const name = tag?.name ?? "Sem etiqueta";
        const key = name.trim().toLocaleLowerCase(data.profile.locale);
        const current = grouped.get(key) ?? { name, color: tag?.color ?? colors.muted, amount: 0 };
        current.amount += entry.amount;
        grouped.set(key, current);
      }
    }
    const sorted = [...grouped.values()].sort((a, b) => b.amount - a.amount);
    if (sorted.length <= 5) return sorted;
    return [...sorted.slice(0, 4), { name: "Outras etiquetas", color: colors.gold, amount: sorted.slice(4).reduce((sum, item) => sum + item.amount, 0) }];
  }, [data.entries, data.profile.locale, data.tags]);
  if (!rows.length) return <View style={styles.pieEmpty}><Ionicons name="pricetags-outline" size={34} color={colors.gold} /><Text style={styles.emptyInline}>Adicione etiquetas às despesas para comparar os gastos do mês.</Text></View>;
  const max = Math.max(...rows.map((row) => row.amount));
  return <View style={styles.labelChart}>{rows.map((row) => <View key={row.name} style={styles.labelChartRow}><View style={styles.labelChartHeading}><View style={styles.labelChartName}><View style={[styles.colorDot, { backgroundColor: row.color }]} /><Text style={styles.legendName} numberOfLines={1}>{row.name}</Text></View><Text style={styles.labelChartValue}>{formatMoney(row.amount, data.profile.currency, data.profile.locale)}</Text></View><View style={styles.labelTrack}><View style={[styles.labelBar, { width: `${Math.max(3, row.amount / max * 100)}%` as `${number}%`, backgroundColor: row.color }]} /></View></View>)}</View>;
}

export function Transactions({ data, filter, onFilter, refreshing, refresh, onEntry, onRecurrence, onDeleteRecurrence }: RefreshProps & { data: Dashboard; filter: TransactionFilter; onFilter: (filter: TransactionFilter) => void; onEntry: (entry: Transaction) => void; onRecurrence: (recurrence: Recurrence) => void; onDeleteRecurrence: (recurrence: Recurrence) => void }) {
  const rows = filter === "all" ? data.entries : data.entries.filter((item) => item.kind === filter);
  const activeRecurrences = data.recurrences.filter((item) => item.startMonth <= data.month && (!item.endMonth || item.endMonth >= data.month) && (filter === "all" || item.kind === filter));
  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}><Text style={styles.title}>Movimentações</Text><Text style={styles.subtitle}>Tudo o que compõe {monthLabel(data.month, data.profile.locale)}.</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{(["all", "income", "expense", "bill", "investment"] as const).map((item) => <Chip key={item} selected={filter === item} onPress={() => onFilter(item)} label={{ all: "Todas", income: "Receitas", expense: "Despesas", bill: "Contas", investment: "Investimentos" }[item]} />)}</ScrollView>
    <Card>{rows.length ? rows.map((entry) => <TransactionRow key={entry.id} entry={entry} currency={data.profile.currency} locale={data.profile.locale} onPress={() => onEntry(entry)} />) : <EmptyState icon="receipt-outline" title="Nada por aqui" detail="Não há movimentações com este filtro no mês." />}</Card>
    {!!activeRecurrences.length && <View style={styles.sectionGap}><SectionTitle title="Recorrências ativas" subtitle="Toque para editar; a lixeira encerra deste mês em diante" /><Card>{activeRecurrences.map((item) => <View key={item.id} style={styles.recurrenceRow}><Pressable onPress={() => onRecurrence(item)} style={styles.recurrenceContent}><Ionicons name="repeat" size={18} color={colors.gold} /><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{item.description}</Text><Text style={styles.rowDetail}>{kindLabels[item.kind]} · todo dia {item.day} · {formatMoney(item.amount, data.profile.currency, data.profile.locale)}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.muted} /></Pressable><Pressable onPress={() => onDeleteRecurrence(item)} hitSlop={9} style={styles.deleteRecurrence}><Ionicons name="trash-outline" size={19} color={colors.red} /></Pressable></View>)}</Card></View>}
  </ScrollView>;
}

export function Inbox({ events, data, refreshing, refresh, onAccept, onIgnore }: RefreshProps & { events: InboxEvent[]; data: Dashboard; onAccept: (event: InboxEvent) => void; onIgnore: (event: InboxEvent) => void }) {
  return <ScrollView contentContainerStyle={styles.scroll} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}><Text style={styles.title}>Inbox financeiro</Text><Text style={styles.subtitle}>Sinais aguardam sua revisão. Nada vira movimentação sem você.</Text>
    {events.length ? events.map((event) => <Card key={event.id} style={styles.inboxCard}><View style={styles.inboxTop}><View style={styles.sourceIcon}><Ionicons name="notifications-outline" size={19} color={colors.gold} /></View><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{event.description ?? "Evento incompleto"}</Text><Text style={styles.rowDetail}>{event.institution ?? event.source} · {new Date(event.occurredAt).toLocaleString(data.profile.locale)}</Text></View>{event.amount != null && <Text style={styles.inboxAmount}>{formatMoney(event.amount, data.profile.currency, data.profile.locale)}</Text>}</View><View style={styles.inboxActions}><Pressable style={styles.secondaryButton} onPress={() => onIgnore(event)}><Text style={styles.secondaryButtonText}>Ignorar</Text></Pressable><Pressable style={styles.primaryButton} onPress={() => onAccept(event)}><Text style={styles.primaryButtonText}>Revisar</Text></Pressable></View></Card>) : <Card><EmptyState icon="checkmark-circle-outline" title="Inbox em dia" detail="Notificações úteis e futuras importações aparecerão aqui para sua confirmação." /></Card>}
  </ScrollView>;
}

type TagGroup = { key: string; name: string; color: string; type: TagType; byKind: Partial<Record<TransactionKind, Tag>> };

function groupTags(tags: Tag[], type: TagType, locale: string): TagGroup[] {
  const groups = new Map<string, TagGroup>();
  for (const tag of tags.filter((item) => item.type === type)) {
    const key = `${type}:${tag.name.trim().toLocaleLowerCase(locale)}`;
    const group = groups.get(key) ?? { key, name: tag.name, color: tag.color, type, byKind: {} };
    if (tag.active) group.byKind[tag.kind] = tag;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name, locale));
}

function TagManager({ type, groups, openEntity, action, repository }: { type: TagType; groups: TagGroup[]; openEntity: (editor: EntityEditor) => void; action: (work: () => Promise<unknown>, success?: string) => Promise<void>; repository: SQLiteFinanceRepository }) {
  const title = type === "category" ? "Categorias" : "Etiquetas";
  const kindIcons: Record<TransactionKind, keyof typeof Ionicons.glyphMap> = { income: "download-outline", expense: "arrow-up-outline", bill: "receipt-outline", investment: "trending-up" };
  return <><SectionTitle title={title} subtitle="Marque onde cada item pode ser usado" /><Card><View style={styles.tagKindsHeader}><View style={{ flex: 1 }} />{kinds.map((kind) => <View key={kind} style={styles.kindIconHeader}><Ionicons name={kindIcons[kind]} size={14} color={kindColorForHeader(kind)} /></View>)}</View>{groups.length ? groups.map((group) => <View key={group.key} style={styles.tagManagerRow}><Pressable accessibilityLabel={`Editar ${group.name}`} onPress={() => openEntity({ type, source: { name: group.name, color: group.color, kinds: kinds.filter((kind) => !!group.byKind[kind]) } })} style={styles.tagManagerName}><View style={[styles.colorDot, { backgroundColor: group.color }]} /><Text style={[styles.rowTitle, { flex: 1 }]} numberOfLines={1}>{group.name}</Text><Ionicons name="create-outline" size={16} color={colors.muted} /></Pressable>{kinds.map((kind) => <Pressable key={kind} accessibilityLabel={`${group.name}: ${kindLabels[kind]}`} hitSlop={5} onPress={() => void action(() => repository.setTagApplicability(group, kind, !group.byKind[kind]))} style={styles.kindCheckbox}><Ionicons name={group.byKind[kind] ? "checkbox" : "square-outline"} size={22} color={group.byKind[kind] ? colors.green : colors.muted} /></Pressable>)}</View>) : <Text style={styles.emptyInline}>Nenhum item criado.</Text>}<Pressable style={styles.secondaryButton} onPress={() => openEntity({ type })}><Text style={styles.secondaryButtonText}>+ Nova {type === "category" ? "categoria" : "etiqueta"}</Text></Pressable></Card></>;
}

function kindColorForHeader(kind: TransactionKind) {
  return { income: colors.green, expense: colors.red, bill: colors.gold, investment: colors.blue }[kind];
}

export function More({ data, notificationEnabled, notificationStatus, refreshing, refresh, openEntity, action, backupService, repository, notificationProvider }: RefreshProps & { data: Dashboard; notificationEnabled: boolean; notificationStatus: NotificationListenerStatus | null; openEntity: (editor: EntityEditor) => void; action: (work: () => Promise<unknown>, success?: string) => Promise<void>; backupService: BackupService; repository: SQLiteFinanceRepository; notificationProvider: AndroidNotificationProvider }) {
  const [passphrase, setPassphrase] = useState("");
  const [currency, setCurrency] = useState(data.profile.currency);
  const notificationActive = notificationEnabled && !!notificationStatus?.listenerConnected;
  const categories = useMemo(() => groupTags(data.tags, "category", data.profile.locale), [data.profile.locale, data.tags]);
  const labels = useMemo(() => groupTags(data.tags, "label", data.profile.locale), [data.profile.locale, data.tags]);
  return <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}><Text style={styles.title}>Organizar e proteger</Text><Text style={styles.subtitle}>Categorias, automação e backups sob seu controle.</Text>
    <TagManager type="category" groups={categories} openEntity={openEntity} action={action} repository={repository} />
    <View style={styles.sectionGap}><TagManager type="label" groups={labels} openEntity={openEntity} action={action} repository={repository} /></View>
    <View style={styles.sectionGap}><SectionTitle title="Notificações Android" subtitle="Fonte opcional; o app funciona sem ela" /><Card><View style={styles.switchLine}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{!notificationEnabled ? "Acesso não concedido" : notificationActive ? "Leitura em segundo plano ativa" : "Acesso concedido; aguardando conexão"}</Text><Text style={styles.rowDetail}>O AlphaFinance captura notificações do Inter mesmo fechado e também verifica as que ainda estão visíveis quando você abre o app. Eventos repetidos são ignorados e o texto bruto não é salvo.</Text></View><Ionicons name={notificationActive ? "shield-checkmark" : "shield-outline"} size={27} color={notificationActive ? colors.green : colors.muted} /></View>{notificationEnabled && <NotificationDiagnostics status={notificationStatus} locale={data.profile.locale} />}<Pressable style={styles.secondaryButton} onPress={() => void notificationProvider.openSettings()}><Text style={styles.secondaryButtonText}>Abrir acesso às notificações</Text></Pressable></Card></View>
    <View style={styles.sectionGap}><SectionTitle title="Backup criptografado" subtitle="Você escolhe a pasta, inclusive um provedor do seletor Android" /><Card><TextInput value={passphrase} onChangeText={setPassphrase} placeholder="Senha do backup (mín. 10 caracteres)" placeholderTextColor={colors.muted} secureTextEntry style={styles.input} /><View style={styles.twoButtons}><Pressable style={styles.primaryButton} onPress={() => void action(() => backupService.create(passphrase), "Backup criado no local escolhido.")}><Text style={styles.primaryButtonText}>Criar backup</Text></Pressable><Pressable style={styles.secondaryButton} onPress={() => Alert.alert("Restaurar backup?", "O conteúdo validado substituirá os dados atuais. Uma cópia privada de recuperação será criada antes.", [{ text: "Cancelar", style: "cancel" }, { text: "Continuar", style: "destructive", onPress: () => void action(() => backupService.restore(passphrase), "Backup restaurado e verificado.") }])}><Text style={styles.secondaryButtonText}>Restaurar</Text></Pressable></View></Card></View>
    <View style={styles.sectionGap}><SectionTitle title="Preferências" /><Card><Text style={styles.fieldLabel}>Moeda</Text><View style={styles.chips}>{(["BRL", "USD", "EUR"] as const).map((item) => <Chip key={item} label={item} selected={currency === item} onPress={() => setCurrency(item)} />)}</View><Pressable style={styles.primaryButton} onPress={() => void action(() => repository.saveProfile({ ...data.profile, currency }), "Preferências salvas.")}><Text style={styles.primaryButtonText}>Salvar preferências</Text></Pressable></Card></View>
  </ScrollView>;
}

function NotificationDiagnostics({ status, locale }: { status: NotificationListenerStatus | null; locale: string }) {
  const date = (value: string | null | undefined) => value ? new Date(value).toLocaleString(locale) : "ainda não registrado";
  const parserMissedLatest = !!status?.lastSupportedNotificationAt && (!status.lastParsedAt || status.lastSupportedNotificationAt > status.lastParsedAt);
  const disconnected = status != null && !status.listenerConnected;
  const title = !status ? "Verificando conexão do Android" : disconnected ? "A leitura em segundo plano não está conectada" : parserMissedLatest ? "O Inter foi encontrado, mas a mensagem não foi reconhecida" : "Captura e recuperação ativas";
  return <View style={[styles.notificationDiagnostics, (disconnected || parserMissedLatest) && styles.notificationWarning]}><Text style={styles.diagnosticTitle}>{title}</Text>{disconnected && <Text style={styles.diagnosticCount}>Confira se todas as opções de leitura e acesso estão habilitadas nas configurações do Android.</Text>}<Text style={styles.rowDetail}>Última notificação recebida pelo serviço: {date(status?.lastBackgroundNotificationAt)}{"\n"}Última varredura ao abrir: {date(status?.lastScanAt)} ({status?.lastScanMatchCount ?? 0} reconhecida(s)){"\n"}Último candidato criado: {date(status?.lastParsedAt)}</Text>{!!status?.unparsedSupportedCount && <Text style={styles.diagnosticCount}>{status.unparsedSupportedCount} tentativa(s) de leitura do Inter não reconhecida(s).</Text>}</View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}><Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text></Pressable>;
}

export const commonStyles = StyleSheet.create({
  primaryButton: { minHeight: 43, borderRadius: 11, paddingHorizontal: 17, paddingVertical: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.green }, primaryButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" }, secondaryButton: { minHeight: 41, borderRadius: 11, paddingHorizontal: 16, paddingVertical: 11, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface }, secondaryButtonText: { color: colors.ink, fontSize: 11, fontWeight: "700" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 16 }, chip: { borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 }, chipSelected: { backgroundColor: colors.greenSoft, borderColor: colors.green }, chipText: { color: colors.muted, fontSize: 11, fontWeight: "600" }, chipTextSelected: { color: colors.green }, fieldLabel: { color: colors.ink, fontSize: 11, fontWeight: "700", marginBottom: 7 }, input: { minHeight: 45, borderRadius: 11, borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", paddingHorizontal: 13, color: colors.ink, fontSize: 14 }, switchLine: { flexDirection: "row", alignItems: "center", gap: 12 }, rowTitle: { color: colors.ink, fontSize: 13, fontWeight: "700" }, rowDetail: { color: colors.muted, fontSize: 10, lineHeight: 15, marginTop: 3 }, link: { color: colors.green, fontSize: 12, fontWeight: "800" }, textButton: { alignItems: "center", padding: 13, marginTop: 4 }, twoButtons: { flexDirection: "row", gap: 9, marginTop: 15 },
});

const styles = StyleSheet.create({
  ...commonStyles,
  scroll: { padding: 20, paddingBottom: 120 }, eyebrow: { color: colors.gold, fontSize: 10, fontWeight: "800", letterSpacing: 1.4 }, title: { color: colors.ink, fontSize: 27, lineHeight: 33, fontWeight: "800", marginTop: 6 }, subtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 5, marginBottom: 20 },
  balanceCard: { backgroundColor: colors.ink, borderColor: colors.ink, marginBottom: 12 }, balanceLabel: { color: "#CCD7C6", fontSize: 10, fontWeight: "700", letterSpacing: 1.1 }, balance: { color: "#fff", fontSize: 31, fontWeight: "800", marginTop: 10 }, balanceHint: { color: "#AEBBA8", fontSize: 10, marginTop: 7 },
  summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 12 }, summaryPressable: { width: "48%", borderRadius: 18 }, summaryPressed: { opacity: .72, transform: [{ scale: .985 }] }, summaryCard: { height: 112, padding: 15 }, summaryHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 }, summaryDot: { width: 8, height: 8, borderRadius: 4 }, summaryLabel: { color: colors.muted, fontSize: 10, fontWeight: "700" }, summaryAmounts: { flexDirection: "row", alignItems: "flex-end", gap: 5, marginTop: 7 }, summaryValue: { color: colors.ink, fontSize: 16, fontWeight: "800", flexShrink: 1 }, summaryValueWithSecondary: { flex: 1, fontSize: 14 }, summarySecondary: { flex: 1, minWidth: 0, alignItems: "flex-end" }, summarySecondaryLabel: { color: colors.muted, fontSize: 8 }, summarySecondaryValue: { color: colors.gold, fontSize: 10, fontWeight: "700", maxWidth: "100%" },
  chartCard: { marginBottom: 12, overflow: "hidden" }, chartPage: { minHeight: 184 }, chart: { height: 128, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-around", paddingTop: 4 }, barGroup: { alignItems: "center", flex: 1 }, bars: { height: 96, flexDirection: "row", alignItems: "flex-end", gap: 2 }, bar: { width: 7, borderTopLeftRadius: 3, borderTopRightRadius: 3 }, barLabel: { color: colors.muted, fontSize: 9, marginTop: 7 }, cashFlowLegend: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", columnGap: 10, rowGap: 4, marginTop: 7 }, cashFlowLegendItem: { flexDirection: "row", alignItems: "center", gap: 3 }, cashFlowLegendLabel: { color: colors.muted, fontSize: 8 }, pageDots: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 5 }, pageDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.line }, pageDotActive: { width: 17, backgroundColor: colors.green },
  pieLayout: { minHeight: 128, flexDirection: "row", alignItems: "center", gap: 9 }, pieCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" }, pieCenterLabel: { color: colors.muted, fontSize: 8 }, pieCenterValue: { color: colors.ink, fontSize: 9, fontWeight: "800", marginTop: 2 }, pieLegend: { flex: 1, flexDirection: "row", flexWrap: "wrap", columnGap: 5, rowGap: 5 }, legendRow: { width: "48%", minHeight: 27, flexDirection: "row", alignItems: "center", gap: 5 }, legendName: { color: colors.ink, fontSize: 8, fontWeight: "700" }, legendValue: { color: colors.muted, fontSize: 7, marginTop: 1 }, pieEmpty: { minHeight: 128, alignItems: "center", justifyContent: "center", gap: 10 },
  labelChart: { minHeight: 128, gap: 8, paddingTop: 3 }, labelChartRow: { gap: 4 }, labelChartHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }, labelChartName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }, labelChartValue: { color: colors.ink, fontSize: 8, fontWeight: "700" }, labelTrack: { height: 7, overflow: "hidden", borderRadius: 4, backgroundColor: colors.line }, labelBar: { height: 7, borderRadius: 4 },
  sectionGap: { marginTop: 25 }, seeAll: { flexDirection: "row", alignItems: "center", gap: 3 }, checklistRow: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, checklistContent: { flex: 1, paddingVertical: 11 }, checklistAmount: { color: colors.ink, fontSize: 12, fontWeight: "700" }, completedText: { color: colors.muted, textDecorationLine: "line-through" }, congratulations: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 9 }, congratulationsText: { flex: 1, color: colors.green, fontSize: 12, fontWeight: "700" },
  recurrenceRow: { flexDirection: "row", alignItems: "stretch", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, recurrenceContent: { flex: 1, minHeight: 67, flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 11 }, deleteRecurrence: { width: 42, alignItems: "center", justifyContent: "center" },
  inboxCard: { marginBottom: 10 }, inboxTop: { flexDirection: "row", alignItems: "center", gap: 10 }, sourceIcon: { width: 36, height: 36, backgroundColor: colors.goldSoft, borderRadius: 11, justifyContent: "center", alignItems: "center" }, inboxAmount: { color: colors.ink, fontSize: 14, fontWeight: "800" }, inboxActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  tagKindsHeader: { flexDirection: "row", alignItems: "center", paddingBottom: 6 }, kindIconHeader: { width: 35, alignItems: "center", justifyContent: "center" }, tagManagerRow: { minHeight: 52, flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, tagManagerName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }, kindCheckbox: { width: 35, alignItems: "center", justifyContent: "center" }, colorDot: { width: 9, height: 9, borderRadius: 5 }, emptyInline: { color: colors.muted, fontSize: 11, lineHeight: 17, paddingVertical: 10, marginBottom: 10 }, privacyCard: { flexDirection: "row", gap: 13, alignItems: "flex-start", backgroundColor: colors.greenSoft }, notificationDiagnostics: { marginVertical: 14, padding: 12, borderRadius: 10, backgroundColor: colors.greenSoft }, notificationWarning: { backgroundColor: colors.goldSoft }, diagnosticTitle: { color: colors.ink, fontSize: 10, fontWeight: "800", marginBottom: 4 }, diagnosticCount: { color: colors.gold, fontSize: 9, fontWeight: "700", lineHeight: 14, marginTop: 5 },
});
