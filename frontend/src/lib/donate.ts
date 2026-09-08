/**
 * RNT Launcher - Donation link helper.
 * Sole source of truth for the BuyMeACoffee URL (canonical: README badge).
 */

export const DONATE_URL = 'https://buymeacoffee.com/zendevve';

export function openDonatePage(): void {
  if (typeof window === 'undefined') {
    return;
  }
  const w: unknown = window;
  if (w && typeof w === 'object' && 'runtime' in w) {
    const runtime: unknown = w.runtime;
    if (runtime && typeof runtime === 'object' && 'BrowserOpenURL' in runtime) {
      const openURL: unknown = runtime.BrowserOpenURL;
      if (typeof openURL === 'function') {
        // Wails runtime is untyped at this boundary; narrowed to function above.
        const openURLFn: (url: string) => void = openURL as (url: string) => void;
        openURLFn(DONATE_URL);
        return;
      }
    }
  }
  window.open(DONATE_URL, '_blank', 'noopener,noreferrer');
}
