import type { Detector, DetectorEvent } from '@connectivity-js/core';

export const createMockDetector = () => {
  let listener: ((event: DetectorEvent) => void) | null = null;
  const detector: Detector = {
    start: (l: (event: DetectorEvent) => void) => {
      listener = l;
      return () => {
        listener = null;
      };
    },
  };
  const emit = (event: DetectorEvent) => {
    listener?.(event);
  };
  return { detector, emit };
};
