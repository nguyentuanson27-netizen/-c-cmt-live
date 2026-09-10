import { describe, expect, it } from 'vitest';
import { formatCommentForTTS } from '../src/tts/tts-service';
import type { Comment } from '../src/core/comment';

describe('TTS text formatting', () => {
  it('formats comment exactly as "Tên khách: comment" without platform/source prefix', () => {
    const comment: Comment = {
      id: 'c1',
      platform: 'facebook',
      sourceId: 'src_fb_1',
      sourceLabel: 'Page Bán Quần Áo',
      username: 'Nguyễn Văn Nam',
      text: 'shop ơi còn áo phông màu trắng không?',
      receivedAt: Date.now(),
    };

    const formatted = formatCommentForTTS(comment);
    expect(formatted).toBe('Nguyễn Văn Nam: shop ơi còn áo phông màu trắng không?');
    expect(formatted).not.toContain('facebook');
    expect(formatted).not.toContain('Page Bán Quần Áo');
  });

  it('handles TikTok comment without platform prefix', () => {
    const comment: Comment = {
      id: 'c2',
      platform: 'tiktok',
      sourceId: 'src_tt_1',
      username: 'Thu Thảo',
      text: 'cho em xem đầm hoa nhí',
      receivedAt: Date.now(),
    };

    expect(formatCommentForTTS(comment)).toBe('Thu Thảo: cho em xem đầm hoa nhí');
  });
});
