export function escapeMarkdownText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/([`*_[\]{}()#+.!|>~-])/g, '\\$1')
    .replace(/\r?\n/g, ' ')
    .trim();
}

export function escapeMarkdownTextBlock(value: string): string {
  return value
    .split(/\r?\n/)
    .map((line) => escapeMarkdownText(line))
    .join('\n')
    .trim();
}
