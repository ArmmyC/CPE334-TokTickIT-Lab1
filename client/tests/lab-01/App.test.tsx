import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from '../../src/App';

describe('TokTickIT foundation UI', () => {
  it('renders the application name', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'TokTickIT' })).toBeInTheDocument();
  });
});
