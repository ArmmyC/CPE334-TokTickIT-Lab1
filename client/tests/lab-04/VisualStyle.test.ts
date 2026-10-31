import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(path.resolve(process.cwd(), 'src/main.css'), 'utf8');

function declarationsFor(selector: string): string {
  const matches = Array.from(stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g))
    .filter(([, ruleSelector]) => (
      ruleSelector.trim() === selector
      || ruleSelector.split(',').some((part) => part.trim() === selector)
    ))
    .map(([, , declarations]) => declarations);
  if (matches.length === 0) throw new Error(`Expected a visual style rule for ${selector}.`);
  return matches.join('\n');
}

function tokenValue(name: string): string {
  const match = stylesheet.match(new RegExp(`${name}:\\s*(#[\\da-f]{6})`, 'i'));
  if (!match) throw new Error(`Expected the ${name} color token.`);
  return match[1].toLowerCase();
}

function relativeLuminance(hex: string): number {
  const channels = hex.match(/[\da-f]{2}/gi)?.map((channel) => parseInt(channel, 16) / 255);
  if (!channels || channels.length !== 3) throw new Error(`Expected an RGB hex color, received ${hex}.`);
  const linear = channels.map((channel) => (
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * linear[0]) + (0.7152 * linear[1]) + (0.0722 * linear[2]);
}

function contrastRatio(foreground: string, background: string): number {
  const luminances = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);
  return (luminances[0] + 0.05) / (luminances[1] + 0.05);
}

describe('Lab 4 visual style', () => {
  it('uses the approved Zen Green tokens and readable foreground/background pairs', () => {
    expect(tokenValue('--zen-primary')).toBe('#006b3c');
    expect(tokenValue('--zen-secondary')).toBe('#0b7a46');
    expect(tokenValue('--zen-text')).toBe('#17352a');
    expect(tokenValue('--zen-warning')).toBe('#8a5a00');
    expect(tokenValue('--zen-error')).toBe('#9a2f2f');

    const readablePairs = [
      ['#17352a', '#fbfefc'],
      ['#006b3c', '#ffffff'],
      ['#0b7a46', '#ffffff'],
      ['#496658', '#ffffff'],
      ['#315447', '#edf2f0'],
      ['#006b3c', '#eaf6ef'],
      ['#8a5a00', '#fff3d7'],
      ['#9a2f2f', '#fff6f6'],
    ];

    for (const [foreground, background] of readablePairs) {
      expect(contrastRatio(foreground, background), `${foreground} on ${background}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('keeps the approved keyboard focus outline on links and form controls', () => {
    const focusRules = Array.from(stylesheet.matchAll(/([^{}]+)\{([^{}]*)\}/g));
    const focusRulesThatHideOutlines = focusRules
      .filter(([, selector, declarations]) => selector.includes(':focus') && /outline\s*:\s*(?:0|none)/i.test(declarations))
      .map(([, selector]) => selector.trim());

    expect(focusRulesThatHideOutlines).toEqual([]);

    const sharedFocusRule = declarationsFor(
      'a:focus-visible, button:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible',
    );
    expect(sharedFocusRule).toMatch(/outline:\s*3px solid #f0b429/i);
    expect(sharedFocusRule).toMatch(/outline-offset:\s*2px/i);
  });

  it('visually distinguishes editable and read-only Ticket fields and styles labels and errors', () => {
    expect(declarationsFor('.staff-editable-field')).toContain('background: #f7fbf8');
    expect(declarationsFor('.ticket-field-readonly input')).toContain('background: #eef5f0');
    expect(declarationsFor('.ticket-field label')).toContain('font-weight: 700');
    expect(declarationsFor('.field-error')).toContain('color: var(--zen-error)');
    expect(declarationsFor('.ticket-status-badge')).toContain('background: var(--zen-pale)');
    expect(declarationsFor('.dashboard-follow-up-required')).toContain('color: var(--zen-warning)');
  });
});
