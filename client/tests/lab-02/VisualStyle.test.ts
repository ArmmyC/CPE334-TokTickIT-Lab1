import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(path.resolve(process.cwd(), 'src/main.css'), 'utf8');

describe('Lab 2 Zen Green visual tokens', () => {
  it('keeps disabled primary controls in the approved green hierarchy', () => {
    expect(stylesheet).toContain('--bs-btn-disabled-bg: var(--zen-primary)');
    expect(stylesheet).toContain('--bs-btn-disabled-border-color: var(--zen-primary)');
    expect(stylesheet).toContain('--bs-btn-disabled-color: #fff');
  });
});
