import { useEffect, useState, type ReactNode } from "react";
import { findTimers, formatCountdown } from "../shared/timers";
import type { TimerMatch } from "./types";

export type ActiveTimer = {
  id: string;
  label: string;
  endsAt: number;
};

export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    async function request() {
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        // Some browsers only allow this after a gesture.
      }
    }
    void request();
    function onVisible() {
      if (document.visibilityState === "visible") void request();
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      void lock?.release();
    };
  }, [active]);
}

export function useCookTimers() {
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!timers.length) return;
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [timers.length]);

  useEffect(() => {
    const done = timers.filter((timer) => timer.endsAt <= now);
    if (!done.length) return;
    beep();
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
      remaining: Math.max(0, Math.round((timer.endsAt - now) / 1000)),
      display: formatCountdown(Math.max(0, (timer.endsAt - now) / 1000)),
    })),
    startTimer,
    cancelTimer,
  };
}

function beep() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    oscillator.connect(gain);
    gain.connect(context.destination);
    gain.gain.setValueAtTime(0.08, context.currentTime);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
  } catch {
    // Ignore audio failures.
  }
}

export function StepWithTimers({
  text,
  onStart,
  className,
}: {
  text: string;
  onStart: (match: TimerMatch) => void;
  className?: string;
}) {
  const matches = findTimers(text);
  if (!matches.length) {
    return <p className={className}>{text}</p>;
  }
  const nodes: ReactNode[] = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.start > cursor) {
      nodes.push(text.slice(cursor, match.start));
    }
    nodes.push(
      <button
        key={`${match.start}-${index}`}
        type="button"
        className="timer-chip"
        onClick={() => onStart(match)}
      >
        {match.label}
      </button>,
    );
    cursor = match.end;
  });
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return <p className={className}>{nodes}</p>;
}
