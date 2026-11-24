import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Starts false on the server and the client so the first paint matches. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let cancel = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (!cancel) setReduce(Boolean(value));
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => setReduce(Boolean(value)));
    return () => {
      cancel = true;
      sub.remove();
    };
  }, []);
  return reduce;
}
