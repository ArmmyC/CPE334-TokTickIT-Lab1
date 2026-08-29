import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ATTACHMENT_STORAGE_DIRECTORY = fileURLToPath(
  new URL('../../storage/attachments/', import.meta.url),
);

export type AttachmentStorage = {
  save: (storageKey: string, bytes: Buffer) => Promise<void>;
  remove: (storageKey: string) => Promise<void>;
  read: (storageKey: string) => Promise<Buffer>;
};

function storagePath(storageKey: string): string {
  if (!/^[0-9a-f-]{20,100}$/i.test(storageKey)) {
    throw new Error('Invalid attachment storage key.');
  }

  return path.join(ATTACHMENT_STORAGE_DIRECTORY, storageKey);
}

export const localAttachmentStorage: AttachmentStorage = {
  async save(storageKey, bytes) {
    await fs.mkdir(ATTACHMENT_STORAGE_DIRECTORY, { recursive: true });
    await fs.writeFile(storagePath(storageKey), bytes, { flag: 'wx' });
  },

  async remove(storageKey) {
    try {
      await fs.unlink(storagePath(storageKey));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  },

  async read(storageKey) {
    return fs.readFile(storagePath(storageKey));
  },
};
