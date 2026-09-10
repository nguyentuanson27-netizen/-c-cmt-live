import { describe, expect, it } from 'vitest';
import { normalizeComment } from '../src/core/filter';

describe('comment filter and normalization', () => {
  it('trims and collapses excessive whitespace', () => {
    const result = normalizeComment('  Nguyễn   Văn  A   ', '  áo   này   còn không    shop?   ');
    expect(result).toEqual({
      username: 'Nguyễn Văn A',
      text: 'áo này còn không shop?',
    });
  });

  it('rejects empty or whitespace-only username', () => {
    expect(normalizeComment('   ', 'áo đẹp')).toBeNull();
    expect(normalizeComment('', 'áo đẹp')).toBeNull();
  });

  it('rejects empty or whitespace-only comment text', () => {
    expect(normalizeComment('Nguyễn A', '   ')).toBeNull();
    expect(normalizeComment('Nguyễn A', '')).toBeNull();
  });

  it('caps comment text at 250 characters for TTS safety', () => {
    const longText = 'a'.repeat(300);
    const result = normalizeComment('Khách 1', longText);
    expect(result).not.toBeNull();
    expect(result.text.length).toBe(250);
    expect(result.text).toBe('a'.repeat(250));
  });

  it('skips comments containing URLs when skipUrls is true', () => {
    const result = normalizeComment('Spammer', 'Xem tại https://spam.com/deal nhé', { skipUrls: true });
    expect(result).toBeNull();

    const result2 = normalizeComment('Spammer', 'Vào www.link.vn mua hàng', { skipUrls: true });
    expect(result2).toBeNull();

    const resultAllowed = normalizeComment('Khách', 'Có bán giày không', { skipUrls: true });
    expect(resultAllowed).not.toBeNull();
  });

  it('skips comments containing blocked keywords', () => {
    const options = { blockedKeywords: ['lừa đảo', 'fake'] };
    expect(normalizeComment('Khách', 'Shop này lừa đảo quá', options)).toBeNull();
    expect(normalizeComment('Khách', 'Hàng FAKE hay auth?', options)).toBeNull();
    expect(normalizeComment('Khách', 'Hàng đẹp lắm', options)).not.toBeNull();
  });
});
