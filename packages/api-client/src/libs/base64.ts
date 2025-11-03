/* UTF-8 safe Base64 helpers for browser and Node environments */
export function base64EncodeUtf8(input: string): string {
  // Prefer Node Buffer when available
  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(input, 'utf8').toString('base64')
    }
  } catch (_) {
    // fallback to browser approach
  }

  // Browser: encode to bytes then to base64
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
  // Convert bytes to binary string in chunks to avoid call stack limits
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
  } catch (_) {
    // fallback
  }

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
