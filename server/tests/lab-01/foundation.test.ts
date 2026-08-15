import { describe, expect, it } from 'vitest';
import { app } from '../../src/app.js';

describe('TokTickIT server foundation', () => {
  it('creates an Express application', () => {
    expect(typeof app.listen).toBe('function');
  });
});
