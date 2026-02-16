/**
 * Animation hooks for spectator game experience.
 * Consumed by WheelArena sub-components (Poker, SoS, RPS).
 */

import { useState, useEffect, useRef, useMemo } from 'react';

// ============================================
// useMoveQueue — stagger batch-polled moves
// ============================================

export function useMoveQueue<T>(rawMoves: T[], staggerMs = 400) {
  const [visibleCount, setVisibleCount] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevLenRef = useRef(0);

  useEffect(() => {
    const newLen = rawMoves.length;
    if (newLen <= prevLenRef.current) {
      // Reset happened (new game)
      if (newLen < prevLenRef.current) {
        setVisibleCount(0);
        prevLenRef.current = 0;
      }
      return;
    }

    // New moves arrived — drip-feed them
    const startFrom = prevLenRef.current;
    prevLenRef.current = newLen;

    let idx = startFrom;
    const drip = () => {
      idx++;
      setVisibleCount(idx);
      if (idx < newLen) {
        timerRef.current = setTimeout(drip, staggerMs);
      }
    };
    // Immediately show first new move, stagger rest
    drip();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [rawMoves.length, staggerMs]);

  const visibleMoves = useMemo(
    () => rawMoves.slice(0, visibleCount),
    [rawMoves, visibleCount],
  );
  const latestMove = visibleMoves.length > 0 ? visibleMoves[visibleMoves.length - 1] : null;
  const isAnimating = visibleCount < rawMoves.length;

  return { visibleMoves, latestMove, isAnimating };
}

// ============================================
// useAnimatedNumber — smooth tween for displays
// ============================================

export function useAnimatedNumber(target: number, duration = 600): number {
  const [display, setDisplay] = useState(target);
  const rafRef = useRef<number>(0);
  const startRef = useRef({ value: target, time: 0 });

  useEffect(() => {
    const from = display;
    if (from === target) return;

    const startTime = performance.now();
    startRef.current = { value: from, time: startTime };

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const t = Math.min(elapsed / duration, 1);
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - t, 3);
      const current = Math.round(from + (target - from) * eased);
      setDisplay(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);

  return display;
}

// ============================================
// useTypewriter — character-by-character reveal
// ============================================

export function useTypewriter(text: string | undefined | null, speed = 30) {
  const [displayText, setDisplayText] = useState('');
  const [isDone, setIsDone] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevTextRef = useRef('');

  useEffect(() => {
    const safeText = text || '';
    if (safeText === prevTextRef.current) return;
    prevTextRef.current = safeText;

    if (!safeText) {
      setDisplayText('');
      setIsDone(true);
      return;
    }

    setDisplayText('');
    setIsDone(false);
    let i = 0;

    const type = () => {
      i++;
      setDisplayText(safeText.slice(0, i));
      if (i < safeText.length) {
        timerRef.current = setTimeout(type, speed);
      } else {
        setIsDone(true);
      }
    };

    timerRef.current = setTimeout(type, speed);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [text, speed]);

  return { displayText, isDone };
}

// ============================================
// useDelayedReveal — delay before showing element
// ============================================

export function useDelayedReveal(trigger: boolean, delayMs: number): boolean {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) {
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(t);
  }, [trigger, delayMs]);

  return visible;
}
