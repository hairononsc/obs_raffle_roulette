import type { RandomSource } from '../../application/ports/random-source.js';

export const mathRandomSource: RandomSource = {
  next: () => Math.random(),
};
