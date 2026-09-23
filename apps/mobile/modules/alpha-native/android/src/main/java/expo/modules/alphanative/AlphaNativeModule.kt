package expo.modules.alphanative

import android.content.ComponentName
import android.content.Intent
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.service.notification.NotificationListenerService
import android.util.Base64
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject
import java.nio.charset.StandardCharsets
import java.security.SecureRandom
import java.util.concurrent.atomic.AtomicBoolean
import javax.crypto.Cipher
import javax.crypto.SecretKeyFactory
import javax.crypto.spec.GCMParameterSpec
import javax.crypto.spec.PBEKeySpec
import javax.crypto.spec.SecretKeySpec

class AlphaNativeModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("AlphaNative")

    AsyncFunction("isNotificationAccessEnabled") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
    }

    AsyncFunction("scanActiveNotifications") { promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      val enabled = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
      if (!enabled) {
        promise.resolve(false)
        return@AsyncFunction
      }

      val settled = AtomicBoolean(false)
      val callback: (Boolean) -> Unit = { succeeded ->
        if (settled.compareAndSet(false, true)) promise.resolve(succeeded)
      }
      val alreadyConnected = AlphaNotificationListenerService.requestScan(callback)
      if (!alreadyConnected && Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
        try {
          NotificationListenerService.requestRebind(ComponentName(context, AlphaNotificationListenerService::class.java))
          Handler(Looper.getMainLooper()).postDelayed({
            if (AlphaNotificationListenerService.cancelPendingScan(callback)) callback(false)
          }, SCAN_TIMEOUT_MILLIS)
        } catch (_: Exception) {
          AlphaNotificationListenerService.cancelPendingScan(callback)
          callback(false)
        }
      }
    }

    AsyncFunction("openNotificationAccessSettings") {
      val context = appContext.currentActivity ?: appContext.reactContext
        ?: throw IllegalStateException("Android context is unavailable")
      context.startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      })
    }

    AsyncFunction("getPendingNotificationEvents") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
      NotificationEventStore.peek(context).map { it.toMap() }
    }

    AsyncFunction("getNotificationListenerStatus") {
      val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
      NotificationEventStore.status(context) + ("listenerConnected" to AlphaNotificationListenerService.isConnected())
    }

    AsyncFunction("acknowledgeNotificationEvents") { sourceEventIds: List<String> ->
      val context = appContext.reactContext ?: throw IllegalStateException("Android context is unavailable")
      NotificationEventStore.acknowledge(context, sourceEventIds.toSet())
    }

    AsyncFunction("encryptBackup") { plaintext: String, passphrase: String ->
      require(passphrase.length >= 10) { "A senha do backup deve ter pelo menos 10 caracteres." }
      val salt = ByteArray(SALT_BYTES).also { SecureRandom().nextBytes(it) }
      val iv = ByteArray(IV_BYTES).also { SecureRandom().nextBytes(it) }
      val key = deriveKey(passphrase, salt, KDF_ITERATIONS)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.ENCRYPT_MODE, key, GCMParameterSpec(128, iv))
      cipher.updateAAD(AAD.toByteArray(StandardCharsets.UTF_8))
      val ciphertext = cipher.doFinal(plaintext.toByteArray(StandardCharsets.UTF_8))
      JSONObject()
        .put("format", "alphafinance.backup")
        .put("version", 1)
        .put("kdf", JSONObject().put("name", "PBKDF2-HMAC-SHA256").put("iterations", KDF_ITERATIONS).put("salt", encode(salt)))
        .put("cipher", JSONObject().put("name", "AES-256-GCM").put("iv", encode(iv)))
        .put("payload", encode(ciphertext))
        .toString()
    }

    AsyncFunction("decryptBackup") { envelopeText: String, passphrase: String ->
      require(envelopeText.length <= MAX_BACKUP_CHARS) { "Backup excede o tamanho permitido." }
      val envelope = JSONObject(envelopeText)
      require(envelope.getString("format") == "alphafinance.backup" && envelope.getInt("version") == 1) { "Formato de backup incompatível." }
      val kdf = envelope.getJSONObject("kdf")
      val cipherMetadata = envelope.getJSONObject("cipher")
      require(kdf.getString("name") == "PBKDF2-HMAC-SHA256") { "Derivação de chave incompatível." }
      require(cipherMetadata.getString("name") == "AES-256-GCM") { "Cifra incompatível." }
      val iterations = kdf.getInt("iterations")
      require(iterations in 300_000..2_000_000) { "Parâmetros criptográficos inválidos." }
      val salt = decode(kdf.getString("salt"))
      val iv = decode(cipherMetadata.getString("iv"))
      require(salt.size == SALT_BYTES && iv.size == IV_BYTES) { "Metadados criptográficos inválidos." }
      val ciphertext = decode(envelope.getString("payload"))
      val key = deriveKey(passphrase, salt, iterations)
      val cipher = Cipher.getInstance("AES/GCM/NoPadding")
      cipher.init(Cipher.DECRYPT_MODE, key, GCMParameterSpec(128, iv))
      cipher.updateAAD(AAD.toByteArray(StandardCharsets.UTF_8))
      String(cipher.doFinal(ciphertext), StandardCharsets.UTF_8)
    }
  }

  private fun deriveKey(passphrase: String, salt: ByteArray, iterations: Int): SecretKeySpec {
    val chars = passphrase.toCharArray()
    return try {
      val spec = PBEKeySpec(chars, salt, iterations, 256)
      val bytes = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).encoded
      spec.clearPassword()
      SecretKeySpec(bytes, "AES")
    } finally {
      chars.fill('\u0000')
    }
  }

  private fun encode(value: ByteArray) = Base64.encodeToString(value, Base64.NO_WRAP)
  private fun decode(value: String) = Base64.decode(value, Base64.NO_WRAP)

  companion object {
    private const val SCAN_TIMEOUT_MILLIS = 2_000L
    private const val KDF_ITERATIONS = 600_000
    private const val SALT_BYTES = 16
    private const val IV_BYTES = 12
    private const val AAD = "AlphaFinanceBackup|1"
    private const val MAX_BACKUP_CHARS = 100_000_000
  }
}
