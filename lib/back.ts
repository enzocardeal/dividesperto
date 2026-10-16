function withoutHash(url: string): string {
  const hash = url.indexOf("#");
  return hash === -1 ? url : url.slice(0, hash);
}

export function backDelta(urls: readonly (string | null)[], index: number): number | null {
  const current = urls[index];
  for (let i = index - 1; i >= 0; i--) {
    const url = urls[i];
    if (url === null || current == null || withoutHash(url) !== withoutHash(current)) {
      return i - index;
    }
  }
  return null;
}
