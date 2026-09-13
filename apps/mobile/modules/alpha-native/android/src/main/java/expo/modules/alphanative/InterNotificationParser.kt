package expo.modules.alphanative

import java.math.BigDecimal
import java.math.RoundingMode
import java.text.Normalizer
import java.util.Locale

object InterNotificationParser {
  private val supportedPackages = setOf("br.com.intermedium", "br.com.inter")
  private val moneyPattern = Regex("(?:R\\$\\s*)?([0-9]{1,3}(?:\\.[0-9]{3})*,[0-9]{2}|[0-9]+,[0-9]{2})", RegexOption.IGNORE_CASE)

  data class Parsed(val amount: Long, val suggestedKind: String, val suggestedMethod: String, val description: String, val confidence: Double)

  fun parse(packageName: String, text: String): Parsed? {
    if (packageName !in supportedPackages) return null
    val normalized = normalize(text)
    val amount = moneyPattern.find(normalized)?.groupValues?.getOrNull(1)?.let(::parseCents) ?: return null
    if (normalized.contains("pix recebido") || normalized.contains("recebeu um pix"))
      return Parsed(amount, "income", "pix", "PIX recebido (Inter)", 0.92)
    if (normalized.contains("enviou um pix") || normalized.contains("pix enviado") || normalized.contains("realizou um pix"))
      return Parsed(amount, "expense", "pix", "PIX enviado (Inter)", 0.92)
    if (normalized.contains("cartao de credito") || normalized.contains("compra no credito") || normalized.contains("compra foi realizada no cartao"))
      return Parsed(amount, "expense", "credit", "Compra no cartão (Inter)", 0.96)
    if (normalized.contains("cartao de debito") || normalized.contains("compra no debito") ||
      normalized.contains("comprar no debito") || normalized.contains("comprou no debito") ||
      normalized.contains("compra no debido") || normalized.contains("comprar no debido") || normalized.contains("comprou no debido"))
      return Parsed(amount, "expense", "debit", "Compra no débito (Inter)", 0.94)
    if (normalized.contains("pagamento") || normalized.contains("transferencia"))
      return Parsed(amount, "expense", "transfer", "Pagamento (Inter)", 0.75)
    return null
  }

  private fun normalize(value: String): String = Normalizer.normalize(value.lowercase(Locale.forLanguageTag("pt-BR")), Normalizer.Form.NFD)
    .replace(Regex("\\p{Mn}+"), "").replace('\u00a0', ' ')
  private fun parseCents(value: String): Long? = try {
    BigDecimal(value.replace(".", "").replace(',', '.')).setScale(2, RoundingMode.UNNECESSARY).movePointRight(2).longValueExact()
  } catch (_: Exception) { null }
}
