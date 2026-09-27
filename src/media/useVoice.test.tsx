import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectVoiceMode, useVoice } from './useVoice';

class FakeRecognition {
  static last: FakeRecognition;
  lang = '';
  continuous = true;
  interimResults = true;
  onresult: ((e: unknown) => void) | null = null;
  onerror: (() => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => this.onend?.());
  constructor() {
    FakeRecognition.last = this;
  }
}

class FakeRecorder {
  static last: FakeRecorder;
  mimeType = '';
  ondataavailable: ((e: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn(() => {
    this.ondataavailable?.({ data: new Blob(['a']) });
    this.onstop?.();
  });
  constructor() {
    FakeRecorder.last = this;
  }
}

const options = () => ({ lang: 'fr-FR', onText: vi.fn(), onAudio: vi.fn() });

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window, 'SpeechRecognition');
  Reflect.deleteProperty(window, 'webkitSpeechRecognition');
  Reflect.deleteProperty(window, 'MediaRecorder');
});

describe('detectVoiceMode', () => {
  it('prefers speech, then recorder, then none', () => {
    expect(detectVoiceMode({ webkitSpeechRecognition: FakeRecognition })).toBe('speech');
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: vi.fn() } });
    expect(detectVoiceMode({ MediaRecorder: FakeRecorder as never })).toBe('recorder');
    vi.stubGlobal('navigator', {});
    expect(detectVoiceMode({ MediaRecorder: FakeRecorder as never })).toBe('none');
    expect(detectVoiceMode({})).toBe('none');
    expect(detectVoiceMode()).toBe('none');
  });
});

describe('useVoice', () => {
  it('dictates final transcripts with the Web Speech API', async () => {
    Object.assign(window, { SpeechRecognition: FakeRecognition });
    const opts = options();
    const { result } = renderHook(() => useVoice(opts));
    expect(result.current.mode).toBe('speech');
    await act(() => result.current.toggle());
    const rec = FakeRecognition.last;
    expect(rec).toMatchObject({ lang: 'fr-FR', continuous: false, interimResults: false });
    expect(result.current.active).toBe(true);
    act(() => {
      rec.onresult?.({
        resultIndex: 0,
        results: {
          length: 3,
          0: { isFinal: true, 0: { transcript: 'acheter ' } },
          1: { isFinal: false, 0: { transcript: 'xx' } },
          2: { isFinal: true, 0: { transcript: 'du pain' } },
        },
      });
      rec.onresult?.({
        resultIndex: 0,
        results: { length: 1, 0: { isFinal: false, 0: { transcript: 'x' } } },
      });
    });
    expect(opts.onText).toHaveBeenCalledTimes(1);
    expect(opts.onText).toHaveBeenCalledWith('acheter du pain');
    await act(() => result.current.toggle());
    expect(rec.stop).toHaveBeenCalled();
    expect(result.current.active).toBe(false);
  });

  it('reports speech errors', async () => {
    Object.assign(window, { SpeechRecognition: FakeRecognition });
    const { result } = renderHook(() => useVoice(options()));
    await act(() => result.current.toggle());
    act(() => {
      FakeRecognition.last.onerror?.();
      FakeRecognition.last.onend?.();
    });
    expect(result.current).toMatchObject({ error: true, active: false });
  });

  it('records an audio memo as fallback and stops tracks', async () => {
    const stopTrack = vi.fn();
    Object.assign(window, { MediaRecorder: FakeRecorder });
    vi.stubGlobal('MediaRecorder', FakeRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(async () => ({ getTracks: () => [{ stop: stopTrack }] })) },
    });
    const opts = options();
    const { result, unmount } = renderHook(() => useVoice(opts));
    expect(result.current.mode).toBe('recorder');
    await act(() => result.current.toggle());
    expect(result.current.active).toBe(true);
    await act(() => result.current.toggle());
    expect(opts.onAudio).toHaveBeenCalledWith(expect.any(Blob));
    expect(opts.onAudio.mock.calls[0]![0].type).toBe('audio/webm');
    expect(stopTrack).toHaveBeenCalled();
    FakeRecorder.prototype.mimeType = 'audio/mp4';
    await act(() => result.current.toggle());
    FakeRecorder.last.mimeType = 'audio/mp4';
    unmount();
    expect(opts.onAudio.mock.calls[1]![0].type).toBe('audio/mp4');
  });

  it('reports microphone denial', async () => {
    Object.assign(window, { MediaRecorder: FakeRecorder });
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn(() => Promise.reject(new Error('denied'))) },
    });
    const { result } = renderHook(() => useVoice(options()));
    await act(() => result.current.toggle());
    expect(result.current).toMatchObject({ error: true, active: false });
  });
});
