import { describe, expect, it } from 'vitest';
import { safeRemoteUrl } from './url-safety';

describe('safeRemoteUrl', () => {
  it('rejects local network targets and accepts public web assets', () => {
    expect(safeRemoteUrl('http://127.0.0.1/private.png')).toBeNull();
    expect(safeRemoteUrl('http://192.168.1.2/private.png')).toBeNull();
    expect(safeRemoteUrl('https://[::ffff:7f00:1]/private.png')).toBeNull();
    expect(safeRemoteUrl('https://[::ffff:a9fe:a9fe]/metadata')).toBeNull();
    expect(safeRemoteUrl('https://[::ffff:6440:1]/private.png')).toBeNull();
    expect(safeRemoteUrl('https://[::1]/private.png')).toBeNull();
    expect(safeRemoteUrl('https://device.local/private.png')).toBeNull();
    expect(safeRemoteUrl('https://cdn.example.com/image.png')?.hostname).toBe('cdn.example.com');
  });

  it('allows caption requests only on HTTPS YouTube hosts', () => {
    expect(
      safeRemoteUrl('https://www.youtube.com/api/timedtext?v=abc', { youtubeCaption: true }),
    ).not.toBeNull();
    expect(
      safeRemoteUrl('https://captions.example.com/api/timedtext?v=abc', { youtubeCaption: true }),
    ).toBeNull();
    expect(
      safeRemoteUrl('http://www.youtube.com/api/timedtext?v=abc', { youtubeCaption: true }),
    ).toBeNull();
  });
});
