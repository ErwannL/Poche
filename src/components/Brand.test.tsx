import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderUi } from '../test/render';
import { Brand } from './Brand';

describe('Brand', () => {
  it('shows the name, the byline and both credit links', () => {
    renderUi(<Brand />);
    expect(screen.getByText('Poche')).toBeInTheDocument();
    expect(screen.getByText('par Orqea')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Propulsé par Orqea' })).toHaveAttribute(
      'target',
      '_top',
    );
    expect(screen.getByRole('link', { name: 'Développé par Erwann Laplante' })).toHaveAttribute(
      'href',
      'https://github.com/ErwannL',
    );
  });
  it('supports the dark header variant, in English', () => {
    renderUi(<Brand size={40} onDark />, 'en');
    expect(screen.getByRole('link', { name: 'Boosted by Orqea' }).parentElement).toHaveClass(
      'text-white/90',
    );
    expect(screen.getByTestId('brand')).toHaveClass('poche-brand');
  });
});
