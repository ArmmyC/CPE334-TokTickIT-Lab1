import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/App';

const requesters = [{ id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' }];

const activeDetail = {
  ticket: {
    id: 42,
    ticketNumber: 'TKT-2026-000042',
    ticketDate: '2026-08-21T10:00:00.000Z',
    requester: { id: 1, name: 'Ariya Anderson', email: 'ariya@example.test' },
    category: { id: 2, name: 'Hardware' },
    relatedSystem: { id: 7, name: 'Corporate Laptop' },
    summary: 'Laptop battery drains quickly',
    description: 'The battery drains while the laptop is idle.',
    requestedPriority: 'MEDIUM',
    itPriority: null,
    currentStatus: 'NEW',
    createdAt: '2026-08-21T10:00:00.000Z',
    updatedAt: '2026-08-21T10:00:00.000Z',
  },
  attachments: [
    {
      id: 7,
      originalName: 'evidence.pdf',
      mimeType: 'application/pdf',
      sizeBytes: 12000,
      uploadedAt: '2026-08-21T10:00:00.000Z',
      removedAt: null,
      removalReason: null,
      downloadAvailable: true,
    },
  ],
};

const removedAttachment = {
  id: 7,
  originalName: 'evidence.pdf',
  mimeType: 'application/pdf',
  sizeBytes: 12000,
  uploadedAt: '2026-08-21T10:00:00.000Z',
  removedAt: '2026-08-21T11:00:00.000Z',
  removalReason: 'Uploaded the wrong document',
  downloadAvailable: false,
};

function setPath(path: string) {
  window.history.pushState({}, '', path);
}

function stubAttachmentApi() {
  const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.endsWith('/api/development-requesters')) {
      return Promise.resolve({ ok: true, json: async () => requesters });
    }
    if (url === '/api/tickets/42?requesterId=1') {
      return Promise.resolve({ ok: true, json: async () => activeDetail });
    }
    if (url === '/api/tickets/42/attachments' && init?.method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({ attachment: { ...activeDetail.attachments[0], id: 9, originalName: 'new-proof.pdf' } }),
      });
    }
    if (url === '/api/attachments/7' && init?.method === 'DELETE') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ attachment: removedAttachment }) });
    }
    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

async function renderDetail() {
  sessionStorage.setItem('toktickit.developmentRequesterId', '1');
  setPath('/tickets/42');
  render(<BrowserRouter><App /></BrowserRouter>);
  expect(await screen.findByRole('heading', { name: 'Ticket Detail' })).toBeInTheDocument();
  expect(await screen.findByText('evidence.pdf')).toBeInTheDocument();
}

beforeEach(() => {
  sessionStorage.clear();
  setPath('/select-requester');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  sessionStorage.clear();
  setPath('/');
});

describe('Lab 2 Ticket Detail attachment actions', () => {
  it('offers preview and download only for active image/PDF content', async () => {
    stubAttachmentApi();
    await renderDetail();

    expect(screen.getByRole('link', { name: 'Preview evidence.pdf' })).toHaveAttribute(
      'href',
      '/api/attachments/7/download?requesterId=1&disposition=inline',
    );
    expect(screen.getByRole('link', { name: 'Download evidence.pdf' })).toHaveAttribute(
      'href',
      '/api/attachments/7/download?requesterId=1&disposition=attachment',
    );
    expect(screen.getByRole('button', { name: 'Remove Attachment evidence.pdf' })).toBeInTheDocument();
  });

  it('uploads one selected file to the owned Ticket and reports the new metadata', async () => {
    const fetchMock = stubAttachmentApi();
    await renderDetail();

    const file = new File(['proof'], 'new-proof.pdf', { type: 'application/pdf' });
    fireEvent.change(screen.getByLabelText('Add attachment'), { target: { files: [file] } });
    expect(screen.getByText('new-proof.pdf')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Upload Attachment' }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) =>
        String(url) === '/api/tickets/42/attachments' && init?.method === 'POST')).toBe(true);
    });
    expect(await screen.findByText(/Attachment uploaded/i)).toBeInTheDocument();
    expect(screen.getByText('new-proof.pdf')).toBeInTheDocument();
  });

  it('requires a reason, confirms soft removal, retains metadata, and hides content actions', async () => {
    const fetchMock = stubAttachmentApi();
    await renderDetail();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Attachment evidence.pdf' }));
    expect(screen.getByRole('dialog')).toHaveTextContent(/Remove evidence.pdf/i);
    expect(screen.getByRole('textbox', { name: 'Removal reason' })).toBeRequired();

    fireEvent.click(screen.getByRole('button', { name: /^Remove Attachment$/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/reason must be/i);

    fireEvent.change(screen.getByRole('textbox', { name: 'Removal reason' }), {
      target: { value: 'Uploaded the wrong document' },
    });
    fireEvent.click(screen.getByRole('button', { name: /^Remove Attachment$/ }));
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([url, init]) =>
        String(url) === '/api/attachments/7' && init?.method === 'DELETE')).toBe(true);
    });
    expect(await screen.findByText('Removed', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('Uploaded the wrong document')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Preview evidence.pdf/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Download evidence.pdf/i })).not.toBeInTheDocument();
  });
});
