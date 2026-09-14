import type { PostDraft, ProfileDraft } from '../../domain/commands';
const text = (data: FormData, key: string) => String(data.get(key) ?? '').trim();
export function readPostForm(data: FormData): PostDraft {
  return {
    kind: data.get('kind') === 'available' ? 'available' : 'looking',
    companyName: text(data, 'companyName'),
    trade: text(data, 'trade'),
    location: text(data, 'location'),
    rate: Number(data.get('rate')),
    from: text(data, 'from'),
    to: text(data, 'to'),
    description: text(data, 'description'),
  };
}
export function readProfileForm(data: FormData): ProfileDraft {
  return {
    name: text(data, 'name'),
    companyName: text(data, 'companyName'),
    phone: text(data, 'phone'),
    trade: text(data, 'trade'),
    location: text(data, 'location'),
  };
}
