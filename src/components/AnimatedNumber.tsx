import React from 'react';
import { useMotionValue, useSpring } from 'framer-motion';

export function AnimatedNumber({ value }: { value: number }) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { stiffness: 100, damping: 20 });

  React.useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  React.useEffect(() => {
    return springValue.on('change', (latest) => {
      if (ref.current) {
        // Only format strictly to 2 decimal places if it's a float, but we'll always use .toFixed(2) for consistency 
        // across the POS/ERP module where most values are monetary or specific metrics.
        // If needed, we could pass a format function as a prop, but for now we format to string.
        ref.current.textContent = Number(latest).toFixed(2);
      }
    });
  }, [springValue]);

  return <span ref={ref}>{Number(motionValue.get()).toFixed(2)}</span>;
}
