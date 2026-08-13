import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

describe('TokTickIT foundation UI', () => {
  it('renders the application name', () => {
    render(<h1>TokTickIT</h1>);

    expect(screen.getByRole('heading', { name: 'TokTickIT' })).toBeInTheDocument();
  });
});
