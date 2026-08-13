import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TokTickIT health UI', () => {
  it('renders the application name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', service: 'TokTickIT API' }),
      }),
    );

    render(<App />);

    expect(screen.getByRole('heading', { name: 'TokTickIT' })).toBeInTheDocument();
    expect(await screen.findByText('System Status: Online')).toBeInTheDocument();
  });

  it('shows an online status from a successful health response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'ok', service: 'TokTickIT API' }),
      }),
    );

    render(<App />);

    expect(await screen.findByText('System Status: Online')).toBeInTheDocument();
    expect(screen.getByText('The backend is responding normally.')).toBeInTheDocument();
  });

  it('shows a useful message when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    render(<App />);

    expect(await screen.findByText('System Status: Offline')).toBeInTheDocument();
    expect(screen.getByText(/Unable to reach the TokTickIT API/)).toBeInTheDocument();
  });
});
