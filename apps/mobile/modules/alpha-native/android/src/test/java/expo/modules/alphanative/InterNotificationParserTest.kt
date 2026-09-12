package expo.modules.alphanative

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class InterNotificationParserTest {
  @Test
  fun parsesCreditCardPurchaseWithoutKeepingRawText() {
    val parsed = InterNotificationParser.parse(
      "br.com.intermedium",
      "Você acaba de gastar R$ 47,90. A compra foi realizada no cartão de crédito.",
    )
    assertEquals(4_790L, parsed?.amount)
    assertEquals("expense", parsed?.suggestedKind)
    assertEquals("credit", parsed?.suggestedMethod)
    assertEquals("Compra no cartão (Inter)", parsed?.description)
  }

  @Test
  fun ignoresPixWithoutAmountRatherThanInventingOne() {
    assertNull(InterNotificationParser.parse(
      "br.com.intermedium",
      "Você recebeu um PIX. Abra o app para consultar.",
    ))
  }

  @Test
  fun ignoresAnIdenticalMessageFromAnotherApplication() {
    assertNull(InterNotificationParser.parse(
      "com.example.untrusted",
      "Você acaba de gastar R$ 47,90 no cartão de crédito.",
    ))
  }

  @Test
  fun parsesPixReceivedWithBrazilianThousandsSeparator() {
    val parsed = InterNotificationParser.parse(
      "br.com.inter",
      "PIX recebido no valor de R$ 1.234,56.",
    )
    assertEquals(123_456L, parsed?.amount)
    assertEquals("income", parsed?.suggestedKind)
    assertEquals("pix", parsed?.suggestedMethod)
  }
}
