import { useEffect, useRef, useState } from 'react';
import { motion, useSpring, useTransform } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  colorize?: boolean; // green for positive, red for negative
}

export function AnimatedCounter({ value, prefix = '', suffix = '', className = '', colorize = false }: AnimatedCounterProps) {
  const spring = useSpring(0, { stiffness: 200, damping: 25 });
  const display = useTransform(spring, (v) => {
    const rounded = Math.round(v);
    return `${prefix}${rounded.toLocaleString()}${suffix}`;
  });
  const prevRef = useRef(value);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    if (value !== prevRef.current) {
      setFlash(value > prevRef.current ? 'up' : 'down');
      setTimeout(() => setFlash(null), 600);
    }
    prevRef.current = value;
    spring.set(value);
  }, [value, spring]);

  const colorClass = colorize
    ? value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-slate-300'
    : '';

  const flashClass = flash === 'up' ? 'animate-pulse text-emerald-300' : flash === 'down' ? 'animate-pulse text-red-300' : '';

  return (
    <motion.span className={`font-mono tabular-nums ${colorClass} ${flashClass} ${className}`}>
      {display}
    </motion.span>
  );
}
