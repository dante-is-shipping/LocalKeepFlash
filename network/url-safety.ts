const LOCAL_HOST_SUFFIXES = ['.localhost', '.local', '.internal', '.lan', '.home'];

function isNonPublicIpv4(hostname: string): boolean {
  const octets = hostname.split('.').map(Number);
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [a = 0, b = 0] = octets;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  );
}

function isNonPublicIpv6(hostname: string): boolean {
  const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (!normalized.includes(':')) return false;

  const [head = '', tail = ''] = normalized.split('::');
  if (normalized.split('::').length > 2) return true;
  const parseWords = (part: string): number[] | null => {
    if (!part) return [];
    const words = part.split(':').map((word) => Number.parseInt(word, 16));
    return words.some((word) => !Number.isInteger(word) || word < 0 || word > 0xffff)
      ? null
      : words;
  };
  const headWords = parseWords(head);
  const tailWords = parseWords(tail);
  if (!headWords || !tailWords) return true;
  const missing = 8 - headWords.length - tailWords.length;
  if ((normalized.includes('::') && missing < 1) || (!normalized.includes('::') && missing !== 0)) {
    return true;
  }
  const words = normalized.includes('::')
    ? [...headWords, ...Array<number>(missing).fill(0), ...tailWords]
    : headWords;
  if (words.length !== 8) return true;

  const [first = 0, second = 0] = words;
  if (
    (first & 0xfe00) === 0xfc00 || // unique-local fc00::/7
    (first & 0xffc0) === 0xfe80 || // link-local fe80::/10
    (first & 0xffc0) === 0xfec0 || // deprecated site-local fec0::/10
    (first & 0xff00) === 0xff00 || // multicast ff00::/8
    (first === 0x2001 && second === 0x0db8) // documentation 2001:db8::/32
  ) {
    return true;
  }

  const mappedIpv4 = words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff;
  if (mappedIpv4) {
    const ipv4 = `${words[6]! >> 8}.${words[6]! & 0xff}.${words[7]! >> 8}.${words[7]! & 0xff}`;
    return isNonPublicIpv4(ipv4);
  }

  // IPv4-compatible, unspecified, loopback, and other reserved ::/96 addresses.
  return words.slice(0, 6).every((word) => word === 0);
}

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return (
    normalized === 'localhost' ||
    LOCAL_HOST_SUFFIXES.some((suffix) => normalized.endsWith(suffix)) ||
    isNonPublicIpv4(normalized) ||
    isNonPublicIpv6(normalized)
  );
}

function isYoutubeCaptionHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '');
  return normalized === 'youtube.com' || normalized.endsWith('.youtube.com');
}

export function safeRemoteUrl(
  value: string,
  options: { youtubeCaption?: boolean } = {},
): URL | null {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password || isLocalHostname(url.hostname)) return null;
    if (options.youtubeCaption && (url.protocol !== 'https:' || !isYoutubeCaptionHost(url.hostname))) {
      return null;
    }
    return url;
  } catch {
    return null;
  }
}

export function safeFinalResponseUrl(
  response: Response,
  options: { youtubeCaption?: boolean } = {},
): boolean {
  return !response.url || safeRemoteUrl(response.url, options) !== null;
}
