/** Explicitly simulated authentication; never use this as server authentication. */
export const DEMO_CODE = '482913';
export function verifyDemoCode(code: string): boolean {
  return /^\d{6}$/.test(code) && code === DEMO_CODE;
}
