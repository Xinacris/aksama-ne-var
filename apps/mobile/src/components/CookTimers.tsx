import { Pressable, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { CookingTimer, Recipe } from "@anv/core/data/models";
import { isPaused, remainingSeconds, timerStepLabel, type TimerSlot } from "@anv/core/domain/cooking";
import { finishKey } from "@anv/core/domain/timerAlarm";
import { formatCountdown, formatTimerLength } from "@anv/core/domain/durations";
import { touchTarget } from "@anv/core/design/tokens";
import { useTheme } from "@/theme";
import { Button, Icon, Text } from "@/ui";

/*
 * Cooking-mode timers laid out so nothing moves while they count: tabular figures in a
 * fixed-width box, one-line labels, buttons in equal columns. The only layout change is
 * when a timer's state changes (start, finish, close), never on a tick.
 */

const TIME_WIDTH = 112;
const STRIP_TIME_WIDTH = 64;

type TimerAction = (timerId: string) => void;

export interface TimerActions {
  start: (slot: TimerSlot) => void;
  togglePause: TimerAction;
  addMinute: TimerAction;
  restart: TimerAction;
  close: TimerAction;
  /** Android: hand the timer to the phone's Clock app (absent where there's none). */
  phoneClock?: TimerAction;
}

function statusWord(t: (k: string) => string, timer: CookingTimer, left: number): string {
  if (isPaused(timer)) return t("cook.paused");
  if (left === 0) return t("cook.timeUpLower");
  return t("cook.leftWord");
}

function spokenTime(t: (k: string, o?: Record<string, unknown>) => string, timer: CookingTimer, left: number): string {
  const time = formatCountdown(left);
  if (isPaused(timer)) return t("cook.pausedLeft", { time });
  if (left === 0) return t("cook.timeUp");
  return t("cook.left", { time });
}

/** The step's timer buttons; a started one becomes its countdown with pause / +1 dk / close, in place. */
export function StepTimers({ slots, label, now, actions, handedOff }: { slots: TimerSlot[]; label: string; now: Date; actions: TimerActions; handedOff: ReadonlySet<string> }) {
  const { t } = useTranslation();
  return (
    <View style={{ gap: 10 }}>
      {slots.map((slot) => {
        if (!slot.timer) {
          return (
            <Button
              key={slot.slot}
              title={t("cook.startTimer", { length: formatTimerLength(slot.duration.seconds) })}
              icon="clock"
              variant="soft"
              onPress={() => actions.start(slot)}
            />
          );
        }
        return <InlineTimer key={slot.slot} timer={slot.timer} label={label} now={now} actions={actions} onPhoneClock={handedOff.has(finishKey(slot.timer))} />;
      })}
    </View>
  );
}

function InlineTimer({ timer, label, now, actions, onPhoneClock }: { timer: CookingTimer; label: string; now: Date; actions: TimerActions; onPhoneClock: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const left = remainingSeconds(timer, now);
  const paused = isPaused(timer);
  const done = left === 0 && !paused;
  return (
    <View
      testID={`timer-${timer.id}`}
      style={{ gap: 8, padding: 12, borderRadius: 18, backgroundColor: done ? colors.tomatoSoft : colors.oliveSoft, borderWidth: done ? 2 : 0, borderColor: colors.tomato }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessible accessibilityLabel={`${label}: ${spokenTime(t, timer, left)}`}>
        <Icon name="clock" size={22} color={done ? colors.tomato : colors.olive} />
        <Text weight="bold" numberOfLines={1} style={{ fontSize: 28, lineHeight: 34, minWidth: TIME_WIDTH, fontVariant: ["tabular-nums"] }}>
          {formatCountdown(left)}
        </Text>
        <Text variant="meta" numberOfLines={1} style={{ flex: 1 }}>
          {statusWord(t, timer, left)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {done ? (
          <Button title={t("cook.restart")} size="sm" variant="secondary" singleLine style={{ flex: 1 }} accessibilityLabel={t("cook.restartTimer", { label })} onPress={() => actions.restart(timer.id)} />
        ) : (
          <Button
            title={paused ? t("cook.resume") : t("cook.pause")}
            size="sm"
            variant="secondary"
            singleLine
            style={{ flex: 1 }}
            accessibilityLabel={t(paused ? "cook.resumeTimer" : "cook.pauseTimer", { label })}
            onPress={() => actions.togglePause(timer.id)}
          />
        )}
        <Button title={t("cook.plusMinute")} size="sm" variant="secondary" singleLine style={{ flex: 1 }} accessibilityLabel={t("cook.addMinute", { label })} onPress={() => actions.addMinute(timer.id)} />
        <Button title={t("common.close")} size="sm" variant="secondary" singleLine style={{ flex: 1 }} accessibilityLabel={t("cook.closeTimer", { label })} onPress={() => actions.close(timer.id)} />
      </View>
      <PhoneClockRow timer={timer} label={label} running={!paused && left > 0} onPhoneClock={onPhoneClock} action={actions.phoneClock} />
    </View>
  );
}

/** Android only: "Telefonun saatinde kur" while it runs; once handed off, a note that changes don't reach it. */
function PhoneClockRow({ timer, label, running, onPhoneClock, action }: { timer: CookingTimer; label: string; running: boolean; onPhoneClock: boolean; action?: TimerAction }) {
  const { t } = useTranslation();
  if (!action) return null;
  if (onPhoneClock) {
    return (
      <Text variant="meta" numberOfLines={2}>
        {t("alarm.phoneClockSet")}
      </Text>
    );
  }
  if (!running) return null;
  return <Button title={t("alarm.phoneClock")} icon="clock" size="sm" variant="ghost" singleLine accessibilityLabel={t("alarm.phoneClockLabel", { label })} onPress={() => action(timer.id)} />;
}

/**
 * Timers of other steps (and other dishes): one compact line each, "Adım 2 · 0:20". Tapping the
 * line goes to that step; × closes it. Not shown at all while only the current step has timers.
 */
export function OtherTimersStrip({
  timers,
  byId,
  withDish,
  now,
  onOpen,
  onClose,
}: {
  timers: CookingTimer[];
  byId: Map<string, Recipe>;
  withDish: boolean;
  now: Date;
  onOpen: (timer: CookingTimer) => void;
  onClose: TimerAction;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (!timers.length) return null;
  return (
    <View style={{ gap: 4 }} accessibilityLabel={t("cook.otherTimers")} testID="other-timers">
      <Text variant="label">{t("cook.otherTimers")}</Text>
      {timers.map((x) => {
        const left = remainingSeconds(x, now);
        const label = timerStepLabel(x, byId.get(x.recipeId), withDish);
        const done = left === 0 && !isPaused(x);
        return (
          <View key={x.id} style={{ flexDirection: "row", alignItems: "center", minHeight: touchTarget, borderTopWidth: 1, borderTopColor: colors.line }}>
            <Pressable
              onPress={() => onOpen(x)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${spokenTime(t, x, left)}`}
              accessibilityHint={t("cook.goToStep")}
              style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8, minHeight: touchTarget }}
            >
              <Text numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>
                {label}
              </Text>
              <Text weight="bold" numberOfLines={1} color={done ? colors.tomato : colors.ink} style={{ minWidth: STRIP_TIME_WIDTH, textAlign: "right", fontVariant: ["tabular-nums"] }}>
                {done ? t("cook.done") : formatCountdown(left)}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => onClose(x.id)}
              accessibilityRole="button"
              accessibilityLabel={t("cook.closeTimer", { label })}
              hitSlop={4}
              style={{ width: touchTarget, height: touchTarget, alignItems: "center", justifyContent: "center" }}
            >
              <Icon name="close" size={18} color={colors.ink2} />
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
