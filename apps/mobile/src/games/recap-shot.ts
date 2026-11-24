/** One capture path for every saved recap. Native uses view-shot. Web uses html-to-image. */

function currentNode(target: unknown): unknown {
  if (target && typeof target === 'object' && 'current' in target) return (target as { current: unknown }).current
  return target
}

function domElement(node: unknown): HTMLElement | null {
  if (typeof HTMLElement === 'undefined' || !node || typeof node !== 'object') return null
  if (node instanceof HTMLElement) return node
  return null
}

function decodeBase64(value: string): Uint8Array | null {
  const payload = value.includes(',') ? value.slice(value.indexOf(',') + 1) : value
  const clean = payload.replace(/\s/g, '')
  if (!clean) return null
  const binary = globalThis.atob(clean)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export async function captureRecap(target: unknown): Promise<Uint8Array | null> {
  if (!target) return null
  const dom = domElement(currentNode(target))
  if (dom) {
    const { toPng } = await import('html-to-image')
    const dataUrl = await toPng(dom, { pixelRatio: 2 })
    return decodeBase64(dataUrl)
  }
  const { captureRef } = await import('react-native-view-shot')
  const base64 = await captureRef(target as never, { format: 'png', result: 'base64', quality: 1 })
  return decodeBase64(base64)
}
