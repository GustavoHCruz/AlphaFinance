package expo.modules.alphanative

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

data class StoredNotificationEvent(val sourceEventId: String, val institution: String, val amount: Long, val suggestedKind: String, val suggestedMethod: String, val description: String, val occurredAt: String, val confidence: Double) {
  fun toJson() = JSONObject().put("sourceEventId", sourceEventId).put("institution", institution).put("amount", amount).put("suggestedKind", suggestedKind).put("suggestedMethod", suggestedMethod).put("description", description).put("occurredAt", occurredAt).put("confidence", confidence)
  fun toMap(): Map<String, Any> = mapOf("sourceEventId" to sourceEventId, "institution" to institution, "amount" to amount, "suggestedKind" to suggestedKind, "suggestedMethod" to suggestedMethod, "description" to description, "occurredAt" to occurredAt, "confidence" to confidence)
}

object NotificationEventStore {
  private const val PREFS = "alphafinance_notification_inbox"
  private const val QUEUE = "structured_events"
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
}
