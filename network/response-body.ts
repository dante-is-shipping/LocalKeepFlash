export async function readResponseBytes(
  response: Response,
  byteLimit: number,
): Promise<Uint8Array> {
  if (!response.body) throw new Error('Response body is unavailable.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > byteLimit) {
      await reader.cancel('response-size-limit');
      throw new Error('Response exceeded its byte limit.');
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readResponseJson(
  response: Response,
  byteLimit: number,
): Promise<unknown> {
  return JSON.parse(new TextDecoder().decode(await readResponseBytes(response, byteLimit)));
}
