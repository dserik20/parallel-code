import { describe, expect, it } from 'vitest';
import { resolveIncomingPanelUserSize } from './persistence';

describe('resolveIncomingPanelUserSize', () => {
  it('prefers panelUserSize when both new and legacy are present', () => {
    const result = resolveIncomingPanelUserSize({ 'tiling:a': 200 }, { 'tiling:a': 999 }, true);
    expect(result).toEqual({ 'tiling:a': 200 });
  });

  it('falls back to legacy panelSizes when new field is missing', () => {
    const result = resolveIncomingPanelUserSize(undefined, { 'sidebar:width': 280 }, true);
    expect(result).toEqual({ 'sidebar:width': 280 });
  });

  it('returns empty when neither source is a string->number record', () => {
    expect(resolveIncomingPanelUserSize(null, null, true)).toEqual({});
    expect(resolveIncomingPanelUserSize('nope', 42, true)).toEqual({});
    expect(resolveIncomingPanelUserSize({ x: 'string' }, null, true)).toEqual({});
  });

  it('wipes task:* entries on first v2 migration but keeps tiling:/sidebar: pins', () => {
    const result = resolveIncomingPanelUserSize(
      {
        'task:abc:ai-terminal': 400,
        'task:abc:shell-section': 300,
        'tiling:uuid-1': 520,
        'sidebar:width': 240,
      },
      undefined,
      undefined, // no migration flag
    );
    expect(result).toEqual({
      'tiling:uuid-1': 520,
      'sidebar:width': 240,
    });
  });

  it('passes task:* entries through once the v2 flag is set', () => {
    const result = resolveIncomingPanelUserSize(
      { 'task:abc:prompt': 120, 'tiling:x': 500 },
      undefined,
      true,
    );
    expect(result).toEqual({ 'task:abc:prompt': 120, 'tiling:x': 500 });
  });

  it('migrates legacy panelSizes values too (drops task:* unless flag is set)', () => {
    const result = resolveIncomingPanelUserSize(
      undefined,
      { 'task:xyz:ai-terminal': 300, 'tiling:p': 480 },
      undefined,
    );
    expect(result).toEqual({ 'tiling:p': 480 });
  });

  it('rejects records containing non-finite numbers (NaN / Infinity)', () => {
    // NaN and Infinity survive JSON.parse through custom reviver or hand edits
    // — tighter validation here prevents them from becoming `flex: 0 0 NaNpx`.
    const result = resolveIncomingPanelUserSize(
      { 'tiling:a': Number.NaN, 'tiling:b': 200 },
      undefined,
      true,
    );
    expect(result).toEqual({});
  });

  it('rejects records containing negative or absurdly large values', () => {
    expect(resolveIncomingPanelUserSize({ 'tiling:a': -5 }, undefined, true)).toEqual({});
    expect(resolveIncomingPanelUserSize({ 'tiling:a': 1_000_000 }, undefined, true)).toEqual({});
  });

  it('keeps reasonable pixel values through the validator', () => {
    const result = resolveIncomingPanelUserSize(
      { 'tiling:a': 0, 'sidebar:width': 240, 'tiling:b': 15_000 },
      undefined,
      true,
    );
    expect(result).toEqual({
      'tiling:a': 0,
      'sidebar:width': 240,
      'tiling:b': 15_000,
    });
  });
});
