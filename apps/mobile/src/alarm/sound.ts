import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { Vibration } from "react-native";
import { ALARM_VIBRATION } from "@anv/core/domain/timerAlarm";

/**
 * The foreground alarm: the synthesized tone (assets/sounds/timer_alarm.wav, same beeps as the
 * web) looped, plus the vibration pattern repeated, until `stopRinging()`. It plays in iOS silent
 * mode too — a kitchen timer that stays quiet because the switch is on is a burnt dinner.
 */
let player: AudioPlayer | null = null;

export function startRinging(sound: boolean): void {
  Vibration.vibrate(ALARM_VIBRATION, true);
  if (!sound) return;
  try {
    void setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "duckOthers", shouldPlayInBackground: false }).catch(() => {});
    player ??= createAudioPlayer(require("../../assets/sounds/timer_alarm.wav"));
    player.loop = true;
    void player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // no audio here: the banner and the vibration still tell the cook
  }
}

export function stopRinging(): void {
  Vibration.cancel();
  try {
    player?.pause();
  } catch {
    // already gone
  }
}
