import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, resolveTheme } from './theme';

describe('theme', () => {
  afterEach(() => {
    document.head.innerHTML = '';
  });

  it('resolves preferences', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
  });

  it('applies and follows the system theme', () => {
    let listener: () => void = () => undefined;
    const media = {
      matches: true,
      addEventListener: vi.fn((_: string, l: () => void) => (listener = l)),
      removeEventListener: vi.fn(),
    };
    vi.spyOn(window, 'matchMedia').mockReturnValue(media as unknown as MediaQueryList);
    document.head.innerHTML = '<meta name="theme-color" content="">';
    const stop = applyTheme('system');
    const root = document.documentElement;
    expect(root.classList.contains('dark')).toBe(true);
    expect(document.querySelector('meta')?.getAttribute('content')).toBe('#0f172a');
    media.matches = false;
    listener();
    expect(root.classList.contains('dark')).toBe(false);
    expect(root.style.colorScheme).toBe('light');
    stop();
    expect(media.removeEventListener).toHaveBeenCalled();
  });

  it('works without a theme-color meta', () => {
    applyTheme('dark')();
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
