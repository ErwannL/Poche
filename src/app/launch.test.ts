import { describe, expect, it, vi } from 'vitest';
import { clearLaunch, parseLaunch } from './launch';

describe('launch params', () => {
  it('parses shortcuts and shares', () => {
    expect(parseLaunch('?action=new')).toEqual({ action: 'new', shareId: null });
    expect(parseLaunch('?action=photo&share=abc')).toEqual({ action: 'photo', shareId: 'abc' });
    expect(parseLaunch('?action=hack')).toEqual({ action: null, shareId: null });
    expect(parseLaunch('')).toEqual({ action: null, shareId: null });
  });

  it('clears the query string only when present', () => {
    const history = { state: { a: 1 }, replaceState: vi.fn() } as unknown as History;
    clearLaunch({ search: '', pathname: '/' } as Location, history);
    expect(history.replaceState).not.toHaveBeenCalled();
    clearLaunch({ search: '?action=new', pathname: '/' } as Location, history);
    expect(history.replaceState).toHaveBeenCalledWith({ a: 1 }, '', '/');
  });
});
