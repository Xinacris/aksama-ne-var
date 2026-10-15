import ExpoModulesCore
import ActivityKit
import AlarmKit
import SwiftUI

// Cooking timers as iOS system alarms (AlarmKit, iOS 26+): they ring in silent mode and on the
// lock screen even when the app was killed. The app decides everything (when, which timers);
// this module only schedules, lists and cancels. Linked only when EXPO_PUBLIC_ENABLE_ALARMKIT=1
// (see plugins/withAlarmKit.js). The class itself has no availability restriction so the
// generated modules provider compiles on every iOS the app supports; each call checks iOS 26.

@available(iOS 26.0, *)
struct AnvTimerMetadata: AlarmMetadata {}

public class AnvAlarmKitModule: Module {
  public func definition() -> ModuleDefinition {
    Name("AnvAlarmKit")

    Function("isSupported") { () -> Bool in
      if #available(iOS 26.0, *) {
        return true
      }
      return false
    }

    Function("authorizationState") { () -> String in
      if #available(iOS 26.0, *) {
        return AnvAlarmKitModule.describe(AlarmManager.shared.authorizationState)
      }
      return "unsupported"
    }

    AsyncFunction("requestAuthorization") { () async -> String in
      if #available(iOS 26.0, *) {
        do {
          let state = try await AlarmManager.shared.requestAuthorization()
          return AnvAlarmKitModule.describe(state)
        } catch {
          return "denied"
        }
      }
      return "unsupported"
    }

    // A countdown that ends with the system alarm alert. `id` is a UUID string chosen by the app.
    AsyncFunction("scheduleTimer") { (id: String, seconds: Double, title: String, stopLabel: String, soundName: String) async -> Bool in
      if #available(iOS 26.0, *) {
        guard let uuid = UUID(uuidString: id), seconds >= 1 else { return false }
        let alert = AnvAlarmKitModule.alert(title: title, stopLabel: stopLabel)
        let attributes = AlarmAttributes<AnvTimerMetadata>(
          presentation: AlarmPresentation(alert: alert),
          metadata: AnvTimerMetadata(),
          tintColor: Color(red: 0.70, green: 0.23, blue: 0.15)
        )
        let sound = soundName.isEmpty ? AlertConfiguration.AlertSound.default : AlertConfiguration.AlertSound.named(soundName)
        let configuration = AlarmManager.AlarmConfiguration<AnvTimerMetadata>.timer(duration: seconds, attributes: attributes, sound: sound)
        do {
          _ = try await AlarmManager.shared.schedule(id: uuid, configuration: configuration)
          return true
        } catch {
          return false
        }
      }
      return false
    }

    Function("cancel") { (id: String) in
      if #available(iOS 26.0, *) {
        guard let uuid = UUID(uuidString: id) else { return }
        try? AlarmManager.shared.cancel(id: uuid)
      }
    }

    // Ids of the alarms this app has scheduled that haven't been stopped yet (lower-case UUIDs).
    Function("scheduledIds") { () -> [String] in
      if #available(iOS 26.0, *) {
        let alarms = (try? AlarmManager.shared.alarms) ?? []
        return alarms.map { $0.id.uuidString.lowercased() }
      }
      return []
    }
  }

  // iOS 26.1 dropped the custom stop button (the system draws it); 26.0 still requires one.
  @available(iOS 26.0, *)
  static func alert(title: String, stopLabel: String) -> AlarmPresentation.Alert {
    let text = LocalizedStringResource(stringLiteral: title)
    if #available(iOS 26.1, *) {
      return AlarmPresentation.Alert(title: text)
    }
    let stop = AlarmButton(text: LocalizedStringResource(stringLiteral: stopLabel), textColor: .white, systemImageName: "stop.circle")
    return AlarmPresentation.Alert(title: text, stopButton: stop)
  }

  @available(iOS 26.0, *)
  static func describe(_ state: AlarmManager.AuthorizationState) -> String {
    switch state {
    case .authorized: return "authorized"
    case .denied: return "denied"
    case .notDetermined: return "notDetermined"
    @unknown default: return "notDetermined"
    }
  }
}
