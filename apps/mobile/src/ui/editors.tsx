import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import type { Editor, EntityEditor } from "../../App";
import type { Account, Card as PaymentCard, Dashboard, PaymentMethod, Tag, TransactionDraft, TransactionKind } from "../domain/models";
import { localDate, parseMoney } from "./format";
import { Chip, commonStyles } from "./screens";
import { colors, kindColor } from "./theme";

export function TransactionEditor({ editor, data, close, save, remove, stopRecurrence }: { editor: NonNullable<Editor>; data: Dashboard; close: () => void; save: (draft: TransactionDraft) => Promise<void>; remove?: () => void; stopRecurrence?: () => void }) {
  const source = editor.entry, event = editor.inbox;
  const [kind, setKind] = useState<TransactionKind>(source?.kind ?? event?.suggestedKind ?? "expense");
  const [description, setDescription] = useState(source?.description ?? event?.description ?? "");
  const [amount, setAmount] = useState(source ? String((source.expectedAmount ?? source.amount) / 100).replace(".", ",") : event?.amount != null ? String(event.amount / 100).replace(".", ",") : "");
  const [actualAmount, setActualAmount] = useState(source?.paidAmount != null ? String(source.paidAmount / 100).replace(".", ",") : "");
  const [date, setDate] = useState(source?.date ?? event?.occurredAt.slice(0, 10) ?? localDate());
  const [method, setMethod] = useState<PaymentMethod>(source?.method ?? event?.suggestedMethod ?? "pix");
  const [categoryId, setCategoryId] = useState<string | null>(source?.categoryId ?? null);
  const [accountId, setAccountId] = useState<string | null>(source?.accountId ?? null);
  const [cardId, setCardId] = useState<string | null>(source?.cardId ?? null);
  const [labelIds, setLabelIds] = useState<string[]>(source?.labelIds ?? []);
  const [done, setDone] = useState(source?.done ?? !["bill", "investment"].includes(kind));
  const [recurring, setRecurring] = useState(false);
  const [installments, setInstallments] = useState("1");
  const [busy, setBusy] = useState(false);
  const categories = data.tags.filter((tag) => tag.kind === kind && tag.type === "category");
  const availableLabels = data.tags.filter((tag) => tag.kind === kind && tag.type === "label");

  const submit = async () => {
    setBusy(true);
    try {
      const cents = parseMoney(amount);
      await save({
        description, kind, amount: cents,
        expectedAmount: ["bill", "investment"].includes(kind) ? cents : null,
        paidAmount: done && ["bill", "investment"].includes(kind) ? parseMoney(actualAmount || amount) : null,
        date, done, method, categoryId: kind === "investment" ? null : categoryId,
        labelIds, accountId, cardId: method === "credit" ? cardId : null,
        recurring: !source && recurring, installmentCount: !source ? Number(installments || 1) : 1,
      });
    } catch (reason) {
      Alert.alert("Revise os dados", reason instanceof Error ? reason.message : "Há campos inválidos.");
    } finally { setBusy(false); }
  };

  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={close}><View style={styles.modalSafe}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <View style={styles.modalHeader}><Pressable onPress={close}><Text style={styles.link}>Cancelar</Text></Pressable><Text style={styles.modalTitle}>{source ? "Editar movimentação" : event ? "Revisar evento" : "Nova movimentação"}</Text><Pressable onPress={() => void submit()} disabled={busy}><Text style={[styles.link, busy && { opacity: .4 }]}>Salvar</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
      <Text style={styles.fieldLabel}>Tipo</Text><View style={styles.kindGrid}>{(["income", "expense", "bill", "investment"] as const).map((item) => <Pressable key={item} disabled={!!source?.recurrenceId} onPress={() => { setKind(item); setCategoryId(null); setLabelIds([]); setDone(!["bill", "investment"].includes(item)); }} style={[styles.kindButton, kind === item && { borderColor: kindColor[item], backgroundColor: `${kindColor[item]}12` }]}><Text style={[styles.kindButtonText, kind === item && { color: kindColor[item] }]}>{({ income: "Receita", expense: "Despesa", bill: "Conta", investment: "Investimento" })[item]}</Text></Pressable>)}</View>
      <Field label="Descrição" value={description} onChange={setDescription} placeholder="Ex.: Mercado do bairro" />
      <View style={styles.formRow}><View style={{ flex: 1 }}><Field label={`Valor (${data.profile.currency})`} value={amount} onChange={setAmount} placeholder="0,00" keyboard="decimal-pad" /></View><View style={{ flex: 1 }}><Field label="Data" value={date} onChange={setDate} placeholder="AAAA-MM-DD" /></View></View>
      {(["bill", "investment"] as TransactionKind[]).includes(kind) && <><View style={styles.switchLine}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{kind === "bill" ? "Já foi paga" : "Já foi aplicado"}</Text><Text style={styles.rowDetail}>Se confirmado, registre também o valor realizado.</Text></View><Switch value={done} onValueChange={setDone} /></View>{done && <Field label="Valor realizado" value={actualAmount} onChange={setActualAmount} placeholder={amount || "0,00"} keyboard="decimal-pad" />}</>}
      {kind !== "investment" && <><Text style={styles.fieldLabel}>Forma</Text><View style={styles.chips}>{(["pix", "credit", "debit", "cash", "transfer"] as const).map((item) => <Chip key={item} selected={method === item} onPress={() => setMethod(item)} label={({ pix: "PIX", credit: "Crédito", debit: "Débito", cash: "Dinheiro", transfer: "Transferência" })[item]} />)}</View></>}
      {categories.length > 0 && <><Text style={styles.fieldLabel}>Categoria</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="Sem categoria" selected={!categoryId} onPress={() => setCategoryId(null)} />{categories.map((tag) => <Chip key={tag.id} label={tag.name} selected={categoryId === tag.id} onPress={() => setCategoryId(tag.id)} />)}</ScrollView></>}
      {availableLabels.length > 0 && <><Text style={styles.fieldLabel}>Etiquetas</Text><View style={styles.chips}>{availableLabels.map((tag) => <Chip key={tag.id} label={tag.name} selected={labelIds.includes(tag.id)} onPress={() => setLabelIds(labelIds.includes(tag.id) ? labelIds.filter((id) => id !== tag.id) : [...labelIds, tag.id])} />)}</View></>}
      {data.accounts.length > 0 && <><Text style={styles.fieldLabel}>Conta</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}><Chip label="Não atribuída" selected={!accountId} onPress={() => setAccountId(null)} />{data.accounts.filter((item) => !item.archived).map((item) => <Chip key={item.id} label={item.name} selected={accountId === item.id} onPress={() => setAccountId(item.id)} />)}</ScrollView></>}
      {method === "credit" && data.cards.length > 0 && <><Text style={styles.fieldLabel}>Cartão</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>{data.cards.filter((item) => !item.archived).map((item) => <Chip key={item.id} label={item.name} selected={cardId === item.id} onPress={() => setCardId(item.id)} />)}</ScrollView></>}
      {!source && <><View style={styles.switchLine}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Repetir mensalmente</Text><Text style={styles.rowDetail}>Disponível para receitas, contas e investimentos.</Text></View><Switch value={recurring} disabled={kind === "expense" || Number(installments) > 1} onValueChange={setRecurring} /></View><Field label="Número de parcelas" value={installments} onChange={(value) => { setInstallments(value); if (Number(value) > 1) setRecurring(false); }} placeholder="1" keyboard="number-pad" /></>}
      {source?.installmentCount && <Text style={styles.notice}>Parcela {source.installmentNumber} de {source.installmentCount}. Esta edição afeta somente esta parcela.</Text>}
      {source?.recurrenceId && <Text style={styles.notice}>Alterações de descrição e classificação passam a valer também para ocorrências futuras.</Text>}
      <Pressable style={styles.primaryButton} onPress={() => void submit()} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Salvar movimentação</Text>}</Pressable>
      {stopRecurrence && <Pressable style={styles.textButton} onPress={stopRecurrence}><Text style={[styles.link, { color: colors.red }]}>Parar recorrência a partir deste mês</Text></Pressable>}
      {remove && <Pressable style={styles.textButton} onPress={remove}><Text style={[styles.link, { color: colors.red }]}>Remover movimentação</Text></Pressable>}
    </ScrollView>
  </KeyboardAvoidingView></View></Modal>;
}

function Field({ label, value, onChange, placeholder, keyboard = "default" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboard?: "default" | "decimal-pad" | "number-pad" }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboard} /></View>;
}

export function EntityModal({ type, data, close, saveAccount, saveCard, saveTag }: { type: NonNullable<EntityEditor>; data: Dashboard; close: () => void; saveAccount: (value: Omit<Account, "id">) => Promise<void>; saveCard: (value: Omit<PaymentCard, "id">) => Promise<void>; saveTag: (value: Omit<Tag, "id" | "position">) => Promise<void> }) {
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [lastFour, setLastFour] = useState("");
  const [dueDay, setDueDay] = useState("");
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [tagType, setTagType] = useState<Tag["type"]>("category");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return Alert.alert("Informe um nome.");
    setBusy(true);
    try {
      if (type === "account") await saveAccount({ name, type: "checking", institution: institution || null, color: colors.green, openingBalance: 0, archived: false });
      else if (type === "card") await saveCard({ name, accountId: data.accounts[0]?.id ?? null, lastFour: lastFour || null, closingDay: null, dueDay: dueDay ? Number(dueDay) : null, limitCents: null, color: colors.gold, archived: false });
      else await saveTag({ name, color: colors.gold, type: tagType, kind });
    } finally { setBusy(false); }
  };
  return <Modal visible transparent animationType="fade" onRequestClose={close}><View style={styles.overlay}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.dialog}><View style={styles.modalHeader}><Pressable onPress={close}><Text style={styles.link}>Cancelar</Text></Pressable><Text style={styles.modalTitle}>{type === "account" ? "Nova conta" : type === "card" ? "Novo cartão" : "Nova classificação"}</Text><View style={{ width: 45 }} /></View><ScrollView contentContainerStyle={styles.form}><Field label="Nome" value={name} onChange={setName} placeholder={type === "account" ? "Ex.: Conta Inter" : type === "card" ? "Ex.: Inter Gold" : "Ex.: Alimentação"} />{type === "account" && <Field label="Instituição (opcional)" value={institution} onChange={setInstitution} placeholder="Ex.: Banco Inter" />}{type === "card" && <View style={styles.formRow}><View style={{ flex: 1 }}><Field label="Últimos 4 dígitos" value={lastFour} onChange={setLastFour} keyboard="number-pad" /></View><View style={{ flex: 1 }}><Field label="Dia de vencimento" value={dueDay} onChange={setDueDay} keyboard="number-pad" /></View></View>}{type === "tag" && <><Text style={styles.fieldLabel}>Aplicar a</Text><View style={styles.chips}>{(["income", "expense", "bill", "investment"] as const).map((item) => <Chip key={item} label={({ income: "Receita", expense: "Despesa", bill: "Conta", investment: "Investimento" })[item]} selected={kind === item} onPress={() => { setKind(item); if (item === "investment") setTagType("label"); }} />)}</View><Text style={styles.fieldLabel}>Tipo</Text><View style={styles.chips}><Chip label="Categoria" selected={tagType === "category"} onPress={() => kind !== "investment" && setTagType("category")} /><Chip label="Etiqueta" selected={tagType === "label"} onPress={() => setTagType("label")} /></View></>}<Pressable style={styles.primaryButton} onPress={() => void submit()} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Salvar</Text>}</Pressable></ScrollView></KeyboardAvoidingView></View></Modal>;
}

const styles = StyleSheet.create({
  ...commonStyles,
  modalSafe: { flex: 1, backgroundColor: colors.background }, modalHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: colors.surface }, modalTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" }, form: { padding: 20, paddingBottom: 60 }, formRow: { flexDirection: "row", gap: 10 }, field: { marginBottom: 16 },
  kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 18 }, kindButton: { width: "48.5%", borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 12, alignItems: "center" }, kindButtonText: { color: colors.muted, fontSize: 11, fontWeight: "700" }, notice: { color: colors.muted, backgroundColor: colors.goldSoft, borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 16, marginBottom: 15 },
  overlay: { flex: 1, backgroundColor: "#18211CCC", justifyContent: "flex-end" }, dialog: { maxHeight: "84%", backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
});
