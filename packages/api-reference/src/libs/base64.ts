/* UTF-8 safe Base64 helpers for api-reference/browser usage */
export function base64EncodeUtf8(input: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(input, 'utf8').toString('base64')
    }
  } catch (_) {}
  const encoder = new TextEncoder()
  const bytes = encoder.encode(input)
  return base64FromBytes(bytes)
}

export function base64EncodeBytes(bytes: Uint8Array): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(bytes).toString('base64')
    }
  } catch (_) {}
  return base64FromBytes(bytes)
}

function base64FromBytes(bytes: Uint8Array) {
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

export function base64DecodeUtf8(b64: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(b64, 'base64').toString('utf8')
    }
  } catch (_) {}
  try {
    const bin = atob(b64)
    const bytes = new Uint8Array(Array.from(bin, (c) => c.charCodeAt(0)))
    return new TextDecoder().decode(bytes)
  } catch (_e) {
    try {
      return atob(b64)
    } catch (_e2) {
      return ''
    }
  }
}
