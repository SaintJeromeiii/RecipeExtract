import { useEffect, useState } from "react";
import { Alert } from "react-native";
import { findTimers, formatCountdown } from "../../shared/timers";
import type { TimerMatch } from "./types";

export type ActiveTimer = {
  id: string;
  label: string;
  endsAt: number;
};

export function useCookTimers() {
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timers.length) return;
    const tick = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(tick);
  }, [timers.length]);

  useEffect(() => {
    const done = timers.filter((timer) => timer.endsAt <= now);
    if (!done.length) return;
    Alert.alert("Timer", `${done[0].label} is done.`);
    setTimers((current) => current.filter((timer) => timer.endsAt > now));
  }, [now, timers]);

  function startTimer(match: TimerMatch) {
    setTimers((current) => [
      ...current,
      {
        id: `${match.label}-${Date.now()}`,
        label: match.label,
        endsAt: Date.now() + match.seconds * 1000,
      },
    ]);
  }

  function cancelTimer(id: string) {
    setTimers((current) => current.filter((timer) => timer.id !== id));
  }

  return {
    timers: timers.map((timer) => ({
      ...timer,
      display: formatCountdown(Math.max(0, (timer.endsAt - now) / 1000)),
    })),
    startTimer,
    cancelTimer,
    findTimers,
  };
}
