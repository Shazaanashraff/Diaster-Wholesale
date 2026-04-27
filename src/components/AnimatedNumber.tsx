import React from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

export function AnimatedNumber({ value, decimals = 2 }: { value: number; decimals?: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 100, damping: 20 });

  React.useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  React.useEffect(() => {
    return springValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = Number(latest).toFixed(decimals);
      }
    });
  }, [springValue, decimals]);

  return <span ref={ref}>{Number(motionValue.get()).toFixed(decimals)}</span>;
}
