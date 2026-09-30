import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderUi } from '../test/render';
import { BackToOrqea, Credits } from './OrqeaLinks';

describe('Credits', () => {
  it('links to Orqea and to the author', () => {
    renderUi(<Credits className="mt-2" />);
    expect(screen.getByRole('link', { name: 'Propulsé par Orqea' })).toHaveAttribute(
      'href',
      'http://localhost:3001',
    );
    const author = screen.getByRole('link', { name: /Développé par Erwann Laplante/ });
    expect(author).toHaveAttribute('target', '_blank');
    expect(author).toHaveAttribute('href', 'https://github.com/ErwannL');
    expect(author).toHaveAttribute('rel', 'noreferrer noopener');
    // Jamais de mention « nouvel onglet » : ni dans le nom accessible ni dans le titre.
    expect(author).not.toHaveAccessibleName(/onglet|new tab/i);
    expect(author).not.toHaveAttribute('title');
    expect(screen.getByRole('link', { name: 'Propulsé par Orqea' })).toHaveAttribute(
      'target',
      '_top',
    );
  });
  it('works without a class name, in English', () => {
    renderUi(<Credits />, 'en');
    expect(screen.getByRole('link', { name: 'Boosted by Orqea' })).toBeInTheDocument();
  });
});

describe('BackToOrqea', () => {
  it('is a plain link, not a sign-out', () => {
    renderUi(<BackToOrqea />);
    const link = screen.getByRole('link', { name: 'Revenir sur Orqea' });
    expect(link).toHaveAttribute('href', 'http://localhost:3001');
    expect(link).toHaveAttribute('target', '_top');
  });
  it('accepts a custom class', () => {
    renderUi(<BackToOrqea className="x" />);
    expect(screen.getByRole('link')).toHaveClass('x');
  });
});
