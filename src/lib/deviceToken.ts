/**
 * First-party browser/device token generator.
 * Respects user privacy: does not probe hardware or MAC/IMEI.
 * Stored in browser localStorage for repeat/unique device estimation.
 */

const TOKEN_KEY = 'cloudbase_device_token';

export function getOrCreateDeviceToken(): string {
  if (typeof window === 'undefined') {
    return 'server_render_token';
  }

  try {
    let token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      // Generate a cryptographic random token
      const randomArr = new Uint8Array(16);
      window.crypto.getRandomValues(randomArr);
      const hexStr = Array.from(randomArr)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      token = `cb_dev_${Date.now().toString(36)}_${hexStr}`;
      localStorage.setItem(TOKEN_KEY, token);
    }
    return token;
  } catch {
    // In case localStorage is blocked by user browser settings
    return `cb_fallback_${Date.now()}`;
  }
}
