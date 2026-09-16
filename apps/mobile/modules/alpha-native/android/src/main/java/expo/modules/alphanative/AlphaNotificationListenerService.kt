package expo.modules.alphanative

import android.app.Notification
import android.content.ComponentName
import android.os.Build
import android.os.Bundle
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class AlphaNotificationListenerService : NotificationListenerService() {
  override fun onListenerConnected() {
    super.onListenerConnected()
    NotificationEventStore.markConnected(applicationContext)
    try {
      activeNotifications?.forEach(::capture)
    } catch (_: SecurityException) { }
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      NotificationListenerService.requestRebind(ComponentName(this, AlphaNotificationListenerService::class.java))
    }
  }

  override fun onNotificationPosted(notification: StatusBarNotification) {
    capture(notification)
  }

  private fun capture(notification: StatusBarNotification) {
    if (!InterNotificationParser.supports(notification.packageName)) return
    val extras = notification.notification.extras ?: return
    val messageTexts = extras.getParcelableArray(Notification.EXTRA_MESSAGES)
      ?.mapNotNull { (it as? Bundle)?.getCharSequence("text")?.toString() }
      .orEmpty()
    val text = (listOfNotNull(
      notification.notification.tickerText?.toString(),
      extras.getCharSequence(Notification.EXTRA_TITLE)?.toString(),
      extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_SUMMARY_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_INFO_TEXT)?.toString(),
      extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)?.joinToString(" "),
    ) + messageTexts).filter { it.isNotBlank() }.distinct().joinToString(" ").take(2_000)
    val parsed = text.takeIf { it.isNotBlank() }?.let { InterNotificationParser.parse(notification.packageName, it) }
    NotificationEventStore.markSupportedNotification(applicationContext, parsed != null)
    if (parsed == null) return
    val fingerprint = sha256("${notification.packageName}|${notification.key}|${notification.postTime}")
    NotificationEventStore.enqueue(applicationContext, StoredNotificationEvent(fingerprint, "INTER", parsed.amount, parsed.suggestedKind, parsed.suggestedMethod, parsed.description, isoUtc(notification.postTime), parsed.confidence))
  }

  private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(StandardCharsets.UTF_8)).joinToString("") { "%02x".format(it) }

  private fun isoUtc(epochMillis: Long): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }.format(Date(epochMillis))
}
