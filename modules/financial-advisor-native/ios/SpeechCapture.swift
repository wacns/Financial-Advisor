import Foundation
import Speech
import AVFoundation
import ExpoModulesCore

final class FinancialAdvisorSpeechCapture {
  private var pending: Promise?
  private var sessionID: UUID?
  private var recognizer: SFSpeechRecognizer?
  private var task: SFSpeechRecognitionTask?
  private var request: SFSpeechAudioBufferRecognitionRequest?
  private let engine = AVAudioEngine()
  private var hasTap = false
  private var transcript = ""
  private var timeout: DispatchWorkItem?

  func start(language: String, promise: Promise) {
    guard pending == nil else { promise.reject("SPEECH_BUSY", "Speech capture is already running."); return }
    let identifier = UUID()
    pending = promise; sessionID = identifier; transcript = ""
    SFSpeechRecognizer.requestAuthorization { status in
      DispatchQueue.main.async {
        guard self.sessionID == identifier else { return }
        guard status == .authorized else { self.finish(error: "Speech permission was not granted. Text entry remains available."); return }
        AVAudioSession.sharedInstance().requestRecordPermission { allowed in
          DispatchQueue.main.async {
            guard self.sessionID == identifier else { return }
            guard allowed else { self.finish(error: "Microphone permission was not granted."); return }
            self.begin(language: language)
          }
        }
      }
    }
  }
  private func begin(language: String) {
    let identifier = sessionID
    do {
      recognizer = SFSpeechRecognizer(locale: Locale(identifier: language))
      guard let recognizer, recognizer.isAvailable else { finish(error: "Speech recognition is unavailable for this language."); return }
      let audio = AVAudioSession.sharedInstance()
      try audio.setCategory(.record, mode: .measurement, options: .duckOthers)
      try audio.setActive(true, options: .notifyOthersOnDeactivation)
      let input = engine.inputNode
      let format = input.outputFormat(forBus: 0)
      guard format.sampleRate > 0 && format.channelCount > 0 else { finish(error: "The microphone is unavailable."); return }
      let buffer = SFSpeechAudioBufferRecognitionRequest()
      buffer.shouldReportPartialResults = true
      if recognizer.supportsOnDeviceRecognition { buffer.requiresOnDeviceRecognition = true }
      request = buffer
      input.installTap(onBus: 0, bufferSize: 1024, format: format) { data, _ in buffer.append(data) }
      hasTap = true
      engine.prepare(); try engine.start()
      task = recognizer.recognitionTask(with: buffer) { result, error in
        DispatchQueue.main.async {
          guard self.pending != nil, self.sessionID == identifier else { return }
          if let result { self.transcript = result.bestTranscription.formattedString; if result.isFinal { self.finish(); return } }
          if error != nil { self.finish(error: self.transcript.isEmpty ? "Speech capture failed. Try text entry." : nil) }
        }
      }
      let work = DispatchWorkItem { self.finish(error: self.transcript.isEmpty ? "No speech was recognized." : nil) }
      timeout = work; DispatchQueue.main.asyncAfter(deadline: .now() + 30, execute: work)
    } catch { finish(error: "Unable to start the microphone. Text entry remains available.") }
  }
  func stop() {
    engine.stop(); request?.endAudio()
    let identifier = sessionID
    DispatchQueue.main.asyncAfter(deadline: .now() + 1) { if self.sessionID == identifier { self.finish() } }
  }
  func cancel() { finish(error: "Speech capture cancelled.") }
  private func finish(error: String? = nil) {
    let promise = pending; pending = nil; sessionID = nil
    timeout?.cancel(); timeout = nil
    engine.stop(); if hasTap { engine.inputNode.removeTap(onBus: 0); hasTap = false }
    request?.endAudio(); task?.cancel(); task = nil; request = nil; recognizer = nil
    try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    if let error { promise?.reject("SPEECH_CAPTURE", error) } else { promise?.resolve(transcript) }
  }
}
