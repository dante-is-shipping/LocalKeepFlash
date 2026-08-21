import type { DirectoryPort } from './directory-port';

async function resolveParent(
  root: FileSystemDirectoryHandle,
  path: string,
  create: boolean,
): Promise<{ directory: FileSystemDirectoryHandle; name: string }> {
  const parts = path.split('/').filter(Boolean);
  const name = parts.pop();
  if (!name) throw new Error('A file path is required.');

  let directory = root;
  for (const part of parts) {
    directory = await directory.getDirectoryHandle(part, { create });
  }

  return { directory, name };
}

export class BrowserDirectory implements DirectoryPort {
  constructor(private readonly root: FileSystemDirectoryHandle) {}

  async writeText(path: string, content: string): Promise<void> {
    await this.write(path, content);
  }

  async writeBinary(path: string, content: Uint8Array): Promise<void> {
    await this.write(path, content);
  }

  async readText(path: string): Promise<string | null> {
    try {
      const { directory, name } = await resolveParent(this.root, path, false);
      const handle = await directory.getFileHandle(name);
      return await (await handle.getFile()).text();
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return null;
      throw error;
    }
  }

  async remove(path: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      const { directory, name } = await resolveParent(this.root, path, false);
      await directory.removeEntry(name, { recursive: options?.recursive ?? false });
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return;
      throw error;
    }
  }

  async list(path: string): Promise<string[]> {
    try {
      let directory = this.root;
      for (const part of path.split('/').filter(Boolean)) {
        directory = await directory.getDirectoryHandle(part);
      }
      const names: string[] = [];
      for await (const name of directory.keys()) names.push(name);
      return names;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotFoundError') return [];
      throw error;
    }
  }

  private async write(path: string, content: string | Uint8Array): Promise<void> {
    const { directory, name } = await resolveParent(this.root, path, true);
    const file = await directory.getFileHandle(name, { create: true });
    const writable = await file.createWritable();
    try {
      const payload = typeof content === 'string'
        ? content
        : new Uint8Array(content).buffer;
      await writable.write(payload);
      await writable.close();
    } catch (error) {
      await writable.abort(error);
      throw error;
    }
  }
}
