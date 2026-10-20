package expo.modules.financialadvisor

import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import expo.modules.kotlin.Promise

class FinancialAdvisorSpeechCapture(private val context: Context) {
  private var recognizer: SpeechRecognizer? = null
  private var pending: Promise? = null
  private val handler = Handler(Looper.getMainLooper())
  private var transcript = ""
  private var timeout: Runnable? = null
  fun start(language: String, promise: Promise) {
    if (pending != null) { promise.reject("SPEECH_BUSY", "Speech capture is already running.", null); return }
    if (!SpeechRecognizer.isRecognitionAvailable(context)) { promise.reject("SPEECH_UNAVAILABLE", "No speech recognition service is installed. Text entry remains available.", null); return }
    pending = promise; transcript = ""
    try {
      recognizer = if (Build.VERSION.SDK_INT >= 31 && SpeechRecognizer.isOnDeviceRecognitionAvailable(context)) SpeechRecognizer.createOnDeviceSpeechRecognizer(context) else SpeechRecognizer.createSpeechRecognizer(context)
      recognizer?.setRecognitionListener(object : RecognitionListener {
        override fun onReadyForSpeech(params: Bundle?) {}
        override fun onBeginningOfSpeech() {}
        override fun onRmsChanged(rmsdB: Float) {}
        override fun onBufferReceived(buffer: ByteArray?) {}
        override fun onEndOfSpeech() {}
        override fun onEvent(eventType: Int, params: Bundle?) {}
        override fun onPartialResults(partialResults: Bundle?) { if (pending !== promise) return; transcript = partialResults?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: transcript }
        override fun onResults(results: Bundle?) { if (pending !== promise) return; transcript = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION)?.firstOrNull() ?: transcript; finish() }
        override fun onError(error: Int) { if (pending !== promise) return; finish(if (transcript.isEmpty()) "Speech capture failed ($error). Check microphone permission or use text entry." else null) }
      })
      val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM).putExtra(RecognizerIntent.EXTRA_LANGUAGE, language).putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true).putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
      timeout = Runnable { finish(if (transcript.isEmpty()) "No speech was recognized." else null) }.also { handler.postDelayed(it, 30000) }
      recognizer?.startListening(intent)
    } catch (error: Exception) { finish("Unable to start speech capture. Text entry remains available.") }
  }
  fun stop() { recognizer?.stopListening(); val request = pending; handler.postDelayed({ if (pending === request) finish() }, 1000) }
  fun cancel() { finish("Speech capture cancelled.") }
  private fun finish(error: String? = null) {
    val promise = pending; pending = null
    timeout?.let { handler.removeCallbacks(it) }; timeout = null
    val old = recognizer; recognizer = null; old?.destroy()
    if (error == null) promise?.resolve(transcript) else promise?.reject("SPEECH_CAPTURE", error, null)
  }
}
