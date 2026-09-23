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
    synchronized(connectionLock) { connectedInstance = this }
    NotificationEventStore.markConnected(applicationContext)
    completePendingScans(this)
  }

  override fun onListenerDisconnected() {
    super.onListenerDisconnected()
    synchronized(connectionLock) {
      if (connectedInstance === this) connectedInstance = null
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
      runCatching { NotificationListenerService.requestRebind(ComponentName(this, AlphaNotificationListenerService::class.java)) }
    }
  }

  override fun onDestroy() {
    synchronized(connectionLock) {
      if (connectedInstance === this) connectedInstance = null
    }
    super.onDestroy()
  }

  override fun onNotificationPosted(notification: StatusBarNotification) {
    if (!InterNotificationParser.supports(notification.packageName)) return
    NotificationEventStore.markBackgroundNotification(applicationContext)
    capture(notification)
  }

  private fun scanVisibleNotifications(): Int {
    return try {
      val matchCount = activeNotifications?.count { capture(it) } ?: 0
      NotificationEventStore.markScan(applicationContext, matchCount)
      matchCount
    } catch (_: SecurityException) {
      0
    }
  }

  private fun capture(notification: StatusBarNotification): Boolean {
    if (!InterNotificationParser.supports(notification.packageName)) return false
    val extras = notification.notification.extras ?: return false
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
    if (parsed == null) return false
    val fingerprint = sha256("${notification.packageName}|${notification.key}|${notification.postTime}")
    NotificationEventStore.enqueue(applicationContext, StoredNotificationEvent(fingerprint, "INTER", parsed.amount, parsed.suggestedKind, parsed.suggestedMethod, parsed.description, isoUtc(notification.postTime), parsed.confidence))
    return true
  }

  private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256").digest(value.toByteArray(StandardCharsets.UTF_8)).joinToString("") { "%02x".format(it) }

  private fun isoUtc(epochMillis: Long): String = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
    timeZone = TimeZone.getTimeZone("UTC")
  }.format(Date(epochMillis))

  companion object {
    @Volatile private var connectedInstance: AlphaNotificationListenerService? = null
    private val connectionLock = Any()
    private val pendingScans = mutableListOf<(Boolean) -> Unit>()

    fun requestScan(onComplete: (Boolean) -> Unit): Boolean {
      val instance = synchronized(connectionLock) {
        connectedInstance ?: run {
          pendingScans.add(onComplete)
          return false
        }
      }
      val succeeded = runCatching { instance.scanVisibleNotifications() }.isSuccess
      onComplete(succeeded)
      return true
    }

    fun cancelPendingScan(callback: (Boolean) -> Unit): Boolean = synchronized(connectionLock) {
      pendingScans.remove(callback)
    }

    private fun completePendingScans(instance: AlphaNotificationListenerService) {
      val callbacks = synchronized(connectionLock) {
        pendingScans.toList().also { pendingScans.clear() }
      }
      if (callbacks.isEmpty()) return
      val succeeded = runCatching { instance.scanVisibleNotifications() }.isSuccess
      callbacks.forEach { it(succeeded) }
    }

    fun isConnected(): Boolean = synchronized(connectionLock) {
      connectedInstance != null
    }
  }
}
