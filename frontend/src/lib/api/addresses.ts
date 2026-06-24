import { apiFetch } from '@/lib/api/client';
import type { components } from '@/lib/api/schema';

export type Address = components['schemas']['AddressResponseDto'];
export type CreateAddressInput = components['schemas']['CreateAddressDto'];

// GET /addresses — current user's address book (auth required).
export function getAddresses(): Promise<Address[]> {
  return apiFetch<Address[]>('/addresses');
}

// POST /addresses — create an address (auth required).
export function createAddress(input: CreateAddressInput): Promise<Address> {
  return apiFetch<Address>('/addresses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
