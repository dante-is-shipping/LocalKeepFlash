export interface DirectoryPort {
  writeText(path: string, content: string): Promise<void>;
  writeBinary(path: string, content: Uint8Array): Promise<void>;
  readText(path: string): Promise<string | null>;
  remove(path: string, options?: { recursive?: boolean }): Promise<void>;
  list(path: string): Promise<string[]>;
}
