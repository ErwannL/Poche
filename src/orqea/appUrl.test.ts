import { describe, expect, it } from 'vitest';
import { CREDITS, orqeaAppUrl } from './appUrl';

describe('orqeaAppUrl', () => {
  it('prefers the configured URL', () => {
    expect(orqeaAppUrl('https://orqea.dev', 'localhost')).toBe('https://orqea.dev');
  });
  it('points to the dev server on local hosts', () => {
    expect(orqeaAppUrl(undefined, '127.0.0.1')).toBe('http://localhost:3001');
    expect(orqeaAppUrl('', 'localhost')).toBe('http://localhost:3001');
  });
  it('falls back to the same origin elsewhere', () => {
    expect(orqeaAppUrl(undefined, 'poche.example.com')).toBe('/');
  });
  it('uses the test environment defaults', () => {
    expect(orqeaAppUrl()).toBe('http://localhost:3001');
  });
  it('names the author', () => {
    expect(CREDITS.author.name).toBe('Erwann Laplante');
  });
});
