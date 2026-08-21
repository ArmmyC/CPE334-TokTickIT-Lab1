import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('TokTickIT health and category UI', () => {
  const categories = [
    { id: 1, name: 'Account and Access' },
    { id: 2, name: 'Hardware' },
    { id: 3, name: 'Software' },
    { id: 4, name: 'Network' },
  ];

  const stubSuccessfulApi = () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        Promise.resolve({
          ok: true,
          json: async () =>
            url.endsWith('/categories')
              ? categories
              : { status: 'ok', service: 'TokTickIT API' },
        }),
      ),
    );
  };

  it('renders the application name and API categories', async () => {
    stubSuccessfulApi();

    render(<BrowserRouter><App /></BrowserRouter>);

    expect(screen.getByRole('heading', { name: 'TokTickIT IT Service Desk' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Check System' }));
    expect(await screen.findByText('System Status: Online')).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Request categories' })).toBeInTheDocument();
    expect(screen.getByText('Account and Access')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check System' })).toBeInTheDocument();
  });

  it('shows a loading state while categories are being requested', async () => {
    let resolveCategories!: (value: unknown) => void;
    const categoriesResponse = new Promise((resolve) => {
      resolveCategories = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/categories')
          ? categoriesResponse
          : Promise.resolve({
              ok: true,
              json: async () => ({ status: 'ok', service: 'TokTickIT API' }),
            }),
      ),
    );

    render(<BrowserRouter><App /></BrowserRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Check System' }));
    expect(screen.getByText(/Loading request categories/)).toBeInTheDocument();
    resolveCategories({ ok: true, json: async () => categories });
    expect(await screen.findByText('Categories loaded from the API.')).toBeInTheDocument();
  });

  it('shows a category error when the category API is unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.endsWith('/categories')
          ? Promise.reject(new Error('connection refused'))
          : Promise.resolve({
              ok: true,
              json: async () => ({ status: 'ok', service: 'TokTickIT API' }),
            }),
      ),
    );

    render(<BrowserRouter><App /></BrowserRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Check System' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Unable to load request categories/);
  });

  it('shows a useful message when the backend is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));

    render(<BrowserRouter><App /></BrowserRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Check System' }));
    expect(await screen.findByText('System Status: Offline')).toBeInTheDocument();
    expect(screen.getByText(/Unable to reach the TokTickIT API/)).toBeInTheDocument();
  });
});
