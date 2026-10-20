package expo.modules.financialadvisor

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.Promise
import expo.modules.kotlin.functions.Queues
import android.os.Handler
import android.os.Looper
import expo.modules.kotlin.modules.ModuleDefinition
import android.net.Uri
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.os.Build
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.google.android.gms.tasks.Tasks

class FinancialAdvisorNativeModule : Module() {
  private var speech: FinancialAdvisorSpeechCapture? = null
  override fun definition() = ModuleDefinition {
    Name("FinancialAdvisorNative")
    AsyncFunction("recognize") { uri: String ->
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      val parsed = Uri.parse(uri)
      require(parsed.scheme == "file" || parsed.scheme == "content") { "Choose a local receipt image." }
      val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      try { Tasks.await(recognizer.process(InputImage.fromFilePath(context, parsed))).text }
      finally { recognizer.close() }
    }
    AsyncFunction("recognizeSpeech") { language: String, promise: Promise ->
      val context = appContext.reactContext ?: throw IllegalStateException("App context unavailable")
      if (speech == null) speech = FinancialAdvisorSpeechCapture(context)
      speech?.start(language, promise)
    }.runOnQueue(Queues.MAIN)
    AsyncFunction("stopSpeech") { speech?.stop() }.runOnQueue(Queues.MAIN)
    OnDestroy { Handler(Looper.getMainLooper()).post { speech?.cancel(); speech = null } }
    AsyncFunction("updateWidgets") { json: String ->
      val context = appContext.reactContext ?: return@AsyncFunction
      context.getSharedPreferences("financial-advisor-widget", 0).edit().putString("data", json).commit()
      val manager = AppWidgetManager.getInstance(context)
      val provider = ComponentName(context, FinancialAdvisorWidgetProvider::class.java)
      FinancialAdvisorWidgetProvider.refresh(context, manager, manager.getAppWidgetIds(provider))
    }
    AsyncFunction("requestWidget") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      val manager = AppWidgetManager.getInstance(context)
      if (Build.VERSION.SDK_INT >= 26 && manager.isRequestPinAppWidgetSupported) {
        manager.requestPinAppWidget(ComponentName(context, FinancialAdvisorWidgetProvider::class.java), null, null)
      } else false
    }
  }
}
