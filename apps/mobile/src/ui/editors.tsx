import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { Editor } from "../../App";
import type { Dashboard, PaymentMethod, TagType, TransactionDraft, TransactionKind } from "../domain/models";
import { calculateEstimatedInvestment } from "../domain/finance";
import { formatMoney, localDate, parseMoney } from "./format";
import { Chip, commonStyles } from "./screens";
import { colors, kindColor } from "./theme";

const descriptionExamples = [
  "Ex.: Mercado do bairro",
  "Ex.: Salário mensal",
  "Ex.: Conta de energia",
  "Ex.: Aporte na reserva",
  "Ex.: Almoço de domingo",
  "Ex.: Assinatura mensal",
  "Ex.: Transporte",
  "Ex.: Presente de aniversário",
];

let nextDescriptionExampleIndex = Math.floor(Math.random() * descriptionExamples.length);

function nextDescriptionExample() {
  const example = descriptionExamples[nextDescriptionExampleIndex];
  nextDescriptionExampleIndex = (nextDescriptionExampleIndex + 1) % descriptionExamples.length;
  return example;
}

export function TransactionEditor({ editor, data, close, save, remove, stopRecurrence }: { editor: NonNullable<Editor>; data: Dashboard; close: () => void; save: (draft: TransactionDraft) => Promise<void>; remove?: () => void; stopRecurrence?: () => void }) {
  const source = editor.entry, event = editor.inbox, recurrence = editor.recurrence;
  const recurrenceDate = recurrence ? dateForDay(data.month, recurrence.day) : null;
  const [kind, setKind] = useState<TransactionKind>(source?.kind ?? recurrence?.kind ?? event?.suggestedKind ?? "expense");
  const [description, setDescription] = useState(source?.description ?? recurrence?.description ?? event?.description ?? "");
  const [amount, setAmount] = useState(source ? String((source.expectedAmount ?? source.amount) / 100).replace(".", ",") : recurrence ? String(recurrence.amount / 100).replace(".", ",") : event?.amount != null ? String(event.amount / 100).replace(".", ",") : "");
  const [actualAmount, setActualAmount] = useState(source?.paidAmount != null ? String(source.paidAmount / 100).replace(".", ",") : "");
  const [date, setDate] = useState(source?.date ?? recurrenceDate ?? event?.occurredAt.slice(0, 10) ?? localDate());
  const [method, setMethod] = useState<PaymentMethod>(source?.method ?? recurrence?.method ?? event?.suggestedMethod ?? "pix");
  const [categoryId, setCategoryId] = useState<string | null>(source?.categoryId ?? recurrence?.categoryId ?? null);
  const [labelIds, setLabelIds] = useState<string[]>(source?.labelIds ?? recurrence?.labelIds ?? []);
  const [done, setDone] = useState(recurrence ? false : source?.done ?? !["bill", "investment"].includes(kind));
  const [recurring, setRecurring] = useState(false);
  const [percentageMode, setPercentageMode] = useState((source?.percentageBps ?? recurrence?.percentageBps) != null);
  const [percentage, setPercentage] = useState(String((source?.percentageBps ?? recurrence?.percentageBps ?? 1500) / 100).replace(".", ","));
  const [incomeCategoryId, setIncomeCategoryId] = useState<string | null>(source?.incomeCategoryId ?? recurrence?.incomeCategoryId ?? null);
  const [descriptionPlaceholder] = useState(nextDescriptionExample);
  const [busy, setBusy] = useState(false);
  const selectedCategoryId = source?.categoryId ?? recurrence?.categoryId;
  const selectedLabelIds = source?.labelIds ?? recurrence?.labelIds ?? [];
  const categories = data.tags.filter((tag) => tag.kind === kind && tag.type === "category" && (tag.active || tag.id === selectedCategoryId));
  const availableLabels = data.tags.filter((tag) => tag.kind === kind && tag.type === "label" && (tag.active || selectedLabelIds.includes(tag.id)));
  const incomeCategories = data.tags.filter((tag) => tag.kind === "income" && tag.type === "category" && (tag.active || tag.id === incomeCategoryId));
  const percentageBps = Math.round(Number(percentage.replace(",", ".")) * 100);
  const isPercentageInvestment = kind === "investment" && percentageMode;
  const percentageEntries = data.entries.filter((entry) => entry.id !== source?.id);
  const estimatedAmount = Number.isInteger(percentageBps) ? calculateEstimatedInvestment(percentageEntries, percentageBps, incomeCategoryId) : 0;
  const requestClose = () => { if (Keyboard.isVisible()) Keyboard.dismiss(); else close(); };

  const submit = async () => {
    setBusy(true);
    try {
      if (isPercentageInvestment && (percentageBps < 1 || percentageBps > 10_000)) throw new Error("Informe uma porcentagem entre 0,01% e 100%.");
      const cents = isPercentageInvestment ? estimatedAmount : parseMoney(amount);
      const actual = isPercentageInvestment ? String(estimatedAmount / 100).replace(".", ",") : amount;
      await save({
        description, kind, amount: cents,
        expectedAmount: ["bill", "investment"].includes(kind) ? cents : null,
        paidAmount: done && ["bill", "investment"].includes(kind) ? parseMoney(actualAmount || actual) : null,
        date, done, method, categoryId,
        labelIds,
        percentageBps: isPercentageInvestment ? percentageBps : null,
        incomeCategoryId: isPercentageInvestment ? incomeCategoryId : null,
        recurring: !source && !recurrence && recurring, installmentCount: 1,
      });
    } catch (reason) {
      Alert.alert("Revise os dados", reason instanceof Error ? reason.message : "Há campos inválidos.");
    } finally { setBusy(false); }
  };

  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={requestClose}><SafeAreaView style={styles.modalSafe} edges={["top", "bottom"]}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
    <View style={styles.modalHeader}><Pressable onPress={close}><Text style={styles.link}>Cancelar</Text></Pressable><Text style={styles.modalTitle}>{recurrence ? "Editar recorrência" : source ? "Editar movimentação" : event ? "Revisar evento" : "Nova movimentação"}</Text><Pressable onPress={() => void submit()} disabled={busy}><Text style={[styles.link, busy && { opacity: .4 }]}>Salvar</Text></Pressable></View>
    <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets>
      <Text style={styles.fieldLabel}>Tipo</Text><View style={styles.kindGrid}>{(["income", "expense", "bill", "investment"] as const).map((item) => <Pressable key={item} disabled={!!source?.recurrenceId || !!recurrence} onPress={() => { setKind(item); setCategoryId(null); setLabelIds([]); setDone(!["bill", "investment"].includes(item)); if (item === "expense") setRecurring(false); }} style={[styles.kindButton, kind === item && { borderColor: kindColor[item], backgroundColor: `${kindColor[item]}12` }]}><Text style={[styles.kindButtonText, kind === item && { color: kindColor[item] }]}>{({ income: "Receita", expense: "Despesa", bill: "Conta", investment: "Investimento" })[item]}</Text></Pressable>)}</View>
      <Field label="Descrição" value={description} onChange={setDescription} placeholder={descriptionPlaceholder} />
      {kind === "investment" && <><Text style={styles.fieldLabel}>Como calcular</Text><View style={styles.chips}><Chip label="Valor fixo" selected={!percentageMode} onPress={() => setPercentageMode(false)} /><Chip label="% das receitas" selected={percentageMode} onPress={() => { setPercentageMode(true); if (!source && !recurrence) setRecurring(true); }} /></View></>}
      {isPercentageInvestment && <View style={styles.percentageBox}><Field label="Porcentagem" value={percentage} onChange={setPercentage} placeholder="15" keyboard="decimal-pad" /><Text style={styles.fieldLabel}>Categoria de receita usada como base</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}><Chip label="Todas as receitas" selected={!incomeCategoryId} onPress={() => setIncomeCategoryId(null)} />{incomeCategories.map((tag) => <Chip key={tag.id} label={tag.name} selected={incomeCategoryId === tag.id} onPress={() => setIncomeCategoryId(tag.id)} />)}</ScrollView><View style={styles.estimateLine}><View><Text style={styles.rowDetail}>Valor estimado neste mês</Text><Text style={styles.estimateFormula}>{percentage.replace(".", ",")}% das receitas selecionadas</Text></View><Text style={styles.estimateValue}>{formatMoney(estimatedAmount, data.profile.currency, data.profile.locale)}</Text></View></View>}
      <View style={styles.formRow}>{!isPercentageInvestment && <View style={{ flex: 1 }}><Field label={`Valor (${data.profile.currency})`} value={amount} onChange={setAmount} placeholder="0,00" keyboard="decimal-pad" /></View>}<View style={{ flex: 1 }}><Field label="Data" value={date} onChange={setDate} placeholder="AAAA-MM-DD" /></View></View>
      {(["bill", "investment"] as TransactionKind[]).includes(kind) && !recurrence && <><View style={styles.switchLine}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>{kind === "bill" ? "Já foi paga" : "Já foi aplicado"}</Text><Text style={styles.rowDetail}>Se confirmado, registre também o valor realizado.</Text></View><Switch value={done} onValueChange={setDone} /></View>{done && <Field label="Valor realizado" value={actualAmount} onChange={setActualAmount} placeholder={amount || "0,00"} keyboard="decimal-pad" />}</>}
      {kind !== "investment" && <><Text style={styles.fieldLabel}>Forma</Text><View style={styles.chips}>{(["pix", "credit", "debit", "cash", "transfer"] as const).map((item) => <Chip key={item} selected={method === item} onPress={() => setMethod(item)} label={({ pix: "PIX", credit: "Crédito", debit: "Débito", cash: "Dinheiro", transfer: "Transferência" })[item]} />)}</View></>}
      {categories.length > 0 && <><Text style={styles.fieldLabel}>Categoria</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}><Chip label="Sem categoria" selected={!categoryId} onPress={() => setCategoryId(null)} />{categories.map((tag) => <Chip key={tag.id} label={tag.name} selected={categoryId === tag.id} onPress={() => setCategoryId(tag.id)} />)}</ScrollView></>}
      {availableLabels.length > 0 && <><Text style={styles.fieldLabel}>Etiquetas</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalChips}>{availableLabels.map((tag) => <Chip key={tag.id} label={tag.name} selected={labelIds.includes(tag.id)} onPress={() => setLabelIds(labelIds.includes(tag.id) ? labelIds.filter((id) => id !== tag.id) : [...labelIds, tag.id])} />)}</ScrollView></>}
      {!source && !recurrence && kind !== "expense" && <View style={styles.recurrenceSwitch}><View style={{ flex: 1 }}><Text style={styles.rowTitle}>Repetir mensalmente</Text><Text style={styles.rowDetail}>Cria automaticamente a próxima ocorrência.</Text></View><Switch value={recurring} onValueChange={setRecurring} trackColor={{ false: "#AEB5A8", true: colors.green }} thumbColor="#FFFFFF" ios_backgroundColor="#AEB5A8" /></View>}
      {source?.installmentCount && <Text style={styles.notice}>Parcela {source.installmentNumber} de {source.installmentCount}. Esta edição afeta somente esta parcela.</Text>}
      {source?.recurrenceId && <Text style={styles.notice}>Alterações de descrição e classificação passam a valer também para ocorrências futuras.</Text>}
      {recurrence && <Text style={styles.notice}>As mudanças serão aplicadas à recorrência deste mês em diante. O histórico anterior será preservado.</Text>}
      <Pressable style={styles.primaryButton} onPress={() => void submit()} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Salvar movimentação</Text>}</Pressable>
      {stopRecurrence && <Pressable style={styles.textButton} onPress={stopRecurrence}><Text style={[styles.link, { color: colors.red }]}>{recurrence ? "Excluir recorrência deste mês em diante" : "Parar recorrência a partir deste mês"}</Text></Pressable>}
      {remove && <Pressable style={styles.textButton} onPress={remove}><Text style={[styles.link, { color: colors.red }]}>Remover movimentação</Text></Pressable>}
    </ScrollView>
  </KeyboardAvoidingView></SafeAreaView></Modal>;
}

function dateForDay(month: string, day: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0, 12)).getUTCDate();
  return `${month}-${String(Math.min(day, lastDay)).padStart(2, "0")}`;
}

function Field({ label, value, onChange, placeholder, keyboard = "default" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboard?: "default" | "decimal-pad" | "number-pad" }) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput style={styles.input} value={value} onChangeText={onChange} placeholder={placeholder} placeholderTextColor={colors.muted} keyboardType={keyboard} /></View>;
}

const tagColors = [colors.green, colors.red, colors.gold, colors.blue, "#8267A8", "#C06B3E"];
const kindLabels: Record<TransactionKind, string> = { income: "Receita", expense: "Despesa", bill: "Conta", investment: "Investimento" };

export function EntityModal({ type, close, saveTags }: { type: TagType; close: () => void; saveTags: (value: { name: string; color: string; type: TagType; kinds: TransactionKind[] }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [kinds, setKinds] = useState<TransactionKind[]>(["expense"]);
  const [color, setColor] = useState(type === "category" ? colors.red : colors.gold);
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name.trim()) return Alert.alert("Informe um nome.");
    if (!kinds.length) return Alert.alert("Escolha pelo menos um tipo de movimentação.");
    setBusy(true);
    try {
      await saveTags({ name: name.trim(), color, type, kinds });
    } finally { setBusy(false); }
  };
  const toggleKind = (kind: TransactionKind) => setKinds((current) => current.includes(kind) ? current.filter((item) => item !== kind) : [...current, kind]);
  const requestClose = () => { if (Keyboard.isVisible()) Keyboard.dismiss(); else close(); };
  return <Modal visible transparent animationType="fade" onRequestClose={requestClose}><KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : "height"}><SafeAreaView edges={["bottom"]} style={styles.dialog}><View style={styles.modalHeader}><Pressable onPress={close}><Text style={styles.link}>Cancelar</Text></Pressable><Text style={styles.modalTitle}>Nova {type === "category" ? "categoria" : "etiqueta"}</Text><View style={{ width: 45 }} /></View><ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets><Field label="Nome" value={name} onChange={setName} placeholder={type === "category" ? "Ex.: Alimentação" : "Ex.: Essencial"} /><Text style={styles.fieldLabel}>Válida para</Text><View style={styles.checkGrid}>{(["income", "expense", "bill", "investment"] as const).map((kind) => <Pressable key={kind} onPress={() => toggleKind(kind)} style={styles.checkOption}><Ionicons name={kinds.includes(kind) ? "checkbox" : "square-outline"} size={22} color={kinds.includes(kind) ? colors.green : colors.muted} /><Text style={styles.checkLabel}>{kindLabels[kind]}</Text></Pressable>)}</View><Text style={styles.fieldLabel}>Cor</Text><View style={styles.colorChoices}>{tagColors.map((item) => <Pressable accessibilityLabel={`Cor ${item}`} key={item} onPress={() => setColor(item)} style={[styles.colorChoice, { backgroundColor: item }, color === item && styles.colorChoiceSelected]}>{color === item && <Ionicons name="checkmark" size={16} color="#fff" />}</Pressable>)}</View><Pressable style={styles.primaryButton} onPress={() => void submit()} disabled={busy}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Salvar</Text>}</Pressable></ScrollView></SafeAreaView></KeyboardAvoidingView></Modal>;
}

const styles = StyleSheet.create({
  ...commonStyles,
  modalSafe: { flex: 1, backgroundColor: colors.background }, modalHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: colors.surface }, modalTitle: { color: colors.ink, fontSize: 14, fontWeight: "800" }, form: { padding: 20, paddingBottom: 60 }, formRow: { flexDirection: "row", gap: 10 }, field: { marginBottom: 16 }, horizontalChips: { flexDirection: "row", gap: 7, paddingRight: 14, marginBottom: 16 },
  kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 18 }, kindButton: { width: "48.5%", borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 12, alignItems: "center" }, kindButtonText: { color: colors.muted, fontSize: 11, fontWeight: "700" }, notice: { color: colors.muted, backgroundColor: colors.goldSoft, borderRadius: 10, padding: 12, fontSize: 11, lineHeight: 16, marginBottom: 15 },
  recurrenceSwitch: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 17, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: colors.surface }, percentageBox: { marginBottom: 4, padding: 13, borderRadius: 12, backgroundColor: colors.blueSoft, borderWidth: 1, borderColor: "#C6D8E5" }, estimateLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 }, estimateFormula: { color: colors.muted, fontSize: 9, marginTop: 2 }, estimateValue: { color: colors.blue, fontSize: 14, fontWeight: "800" },
  overlay: { flex: 1, backgroundColor: "#18211CCC", justifyContent: "flex-end" }, dialog: { maxHeight: "90%", flexShrink: 1, backgroundColor: colors.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: "hidden" },
  checkGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 }, checkOption: { width: "48%", minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 10, paddingHorizontal: 10, backgroundColor: colors.surface }, checkLabel: { color: colors.ink, fontSize: 11, fontWeight: "600" },
  colorChoices: { flexDirection: "row", gap: 12, marginBottom: 22 }, colorChoice: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" }, colorChoiceSelected: { borderWidth: 3, borderColor: colors.ink },
});
