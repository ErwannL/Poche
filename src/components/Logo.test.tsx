import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Logo } from './Logo';

describe('Logo', () => {
  it('is decorative without a title', () => {
    const { container } = render(<Logo />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('aria-hidden', 'true');
    expect(svg).toHaveAttribute('width', '32');
    expect(svg).toHaveClass('poche-logo');
  });
  it('is an image with a title', () => {
    const { getByRole } = render(<Logo size={48} title="Poche" />);
    expect(getByRole('img', { name: 'Poche' })).toHaveAttribute('width', '48');
  });
});
