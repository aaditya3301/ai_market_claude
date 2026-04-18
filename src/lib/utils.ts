import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getBrandId(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('brand_id') || process.env.NEXT_PUBLIC_DEFAULT_BRAND_ID || 'brand_001';
  }
  return process.env.NEXT_PUBLIC_DEFAULT_BRAND_ID || 'brand_001';
}

/**
 * Strict brand resolution for automation and server-driven orchestrations.
 * This intentionally disallows implicit defaults.
 */
export function getAutomationBrandId(inputBrandId?: string | null): string {
  const brandId = (inputBrandId || '').trim();
  if (!brandId) {
    throw new Error('AUTOMATION_BRAND_REQUIRED: brandId must be provided for automation runs.');
  }
  return brandId;
}

export function assertNoImplicitAutomationBrand(brandId: string) {
  if ((brandId || '').trim() === 'brand_001') {
    throw new Error('AUTOMATION_BRAND_INVALID: implicit fallback brand is not allowed for automation runs.');
  }
}
