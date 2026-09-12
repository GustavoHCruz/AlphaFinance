package expo.modules.alphanative

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class AlphaNotificationListenerService : NotificationListenerService() {
  override fun onNotificationPosted(notification: StatusBarNotification) {
    val extras = notification.notification.extras ?: return
    val text = listOfNotNull(extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(), extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(), extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(), extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString(" ")).distinct().joinToString(" ").take(2_000)
    if (text.isBlank()) return
    val parsed = InterNotificationParser.parse(notification.packageName, text) ?: return
    val fingerprint = sha256("${notification.packageName}|${notification.key}|${notification.postTime}")
    NotificationEventStore.enqueue(applicationContext, StoredNotificationEvent(fingerprint, "INTER", parsed.amount, parsed.suggestedKind, parsed.suggestedMethod, parsed.description, isoUtc(notification.postTime), parsed.confidence))
  }

  private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(StandardCharsets.UTF_8)).joinToString("") { "%02x".format(it) }

  private fun isoUtc(epochMillis: Long): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }.format(Date(epochMillis))
}
