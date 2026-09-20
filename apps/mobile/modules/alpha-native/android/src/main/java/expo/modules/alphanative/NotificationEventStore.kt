package expo.modules.alphanative

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

data class StoredNotificationEvent(val sourceEventId: String, val institution: String, val amount: Long, val suggestedKind: String, val suggestedMethod: String, val description: String, val occurredAt: String, val confidence: Double) {
  fun toJson() = JSONObject().put("sourceEventId", sourceEventId).put("institution", institution).put("amount", amount).put("suggestedKind", suggestedKind).put("suggestedMethod", suggestedMethod).put("description", description).put("occurredAt", occurredAt).put("confidence", confidence)
  fun toMap(): Map<String, Any> = mapOf("sourceEventId" to sourceEventId, "institution" to institution, "amount" to amount, "suggestedKind" to suggestedKind, "suggestedMethod" to suggestedMethod, "description" to description, "occurredAt" to occurredAt, "confidence" to confidence)
}

object NotificationEventStore {
  private const val PREFS = "alphafinance_notification_inbox"
  private const val QUEUE = "structured_events"
  private const val LAST_CONNECTED_AT = "last_connected_at"
  private const val LAST_SUPPORTED_NOTIFICATION_AT = "last_supported_notification_at"
  private const val LAST_PARSED_AT = "last_parsed_at"
  private const val LAST_SCAN_AT = "last_scan_at"
  private const val LAST_SCAN_MATCH_COUNT = "last_scan_match_count"
  private const val UNPARSED_SUPPORTED_COUNT = "unparsed_supported_count"
  private const val MAX_EVENTS = 100
  private val lock = Any()

  fun enqueue(context: Context, event: StoredNotificationEvent) = synchronized(lock) {
    val existing = peek(context).filter { it.sourceEventId != event.sourceEventId }.takeLast(MAX_EVENTS - 1)
    val array = JSONArray()
    (existing + event).forEach { array.put(it.toJson()) }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(QUEUE, array.toString()).apply()
  }

  fun peek(context: Context): List<StoredNotificationEvent> = synchronized(lock) {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(QUEUE, "[]") ?: "[]"
    val array = try { JSONArray(raw) } catch (_: Exception) { JSONArray() }
    buildList {
      for (index in 0 until array.length()) try {
        val item = array.getJSONObject(index)
        add(StoredNotificationEvent(item.getString("sourceEventId"), item.getString("institution"), item.getLong("amount"), item.getString("suggestedKind"), item.getString("suggestedMethod"), item.getString("description"), item.getString("occurredAt"), item.getDouble("confidence")))
      } catch (_: Exception) { }
    }
  }

  fun acknowledge(context: Context, sourceEventIds: Set<String>) = synchronized(lock) {
    val array = JSONArray()
    peek(context).filterNot { it.sourceEventId in sourceEventIds }.forEach { array.put(it.toJson()) }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(QUEUE, array.toString()).apply()
  }

  fun markConnected(context: Context) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putLong(LAST_CONNECTED_AT, System.currentTimeMillis()).apply()
  }

  fun markSupportedNotification(context: Context, parsed: Boolean) = synchronized(lock) {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val editor = prefs.edit().putLong(LAST_SUPPORTED_NOTIFICATION_AT, System.currentTimeMillis())
    if (parsed) editor.putLong(LAST_PARSED_AT, System.currentTimeMillis())
    else editor.putInt(UNPARSED_SUPPORTED_COUNT, prefs.getInt(UNPARSED_SUPPORTED_COUNT, 0) + 1)
    editor.apply()
  }

  fun markScan(context: Context, matchCount: Int) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putLong(LAST_SCAN_AT, System.currentTimeMillis())
      .putInt(LAST_SCAN_MATCH_COUNT, matchCount)
      .apply()
  }

  fun status(context: Context): Map<String, Any?> {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return mapOf(
      "lastConnectedAt" to prefs.instant(LAST_CONNECTED_AT),
      "lastSupportedNotificationAt" to prefs.instant(LAST_SUPPORTED_NOTIFICATION_AT),
      "lastParsedAt" to prefs.instant(LAST_PARSED_AT),
      "lastScanAt" to prefs.instant(LAST_SCAN_AT),
      "lastScanMatchCount" to prefs.getInt(LAST_SCAN_MATCH_COUNT, 0),
      "unparsedSupportedCount" to prefs.getInt(UNPARSED_SUPPORTED_COUNT, 0),
      "pendingEventCount" to peek(context).size,
    )
  }

  private fun android.content.SharedPreferences.instant(key: String): String? {
    val value = getLong(key, 0)
    return if (value > 0) SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US).apply {
      timeZone = TimeZone.getTimeZone("UTC")
    }.format(Date(value)) else null
  }
}
