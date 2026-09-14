export { trades } from './trades';
export type PostKind = 'looking' | 'available';
export interface Profile {
  id: string;
  email: string;
  name: string;
  phone: string;
  trade: string;
  location: string;
  companyName?: string;
}
export interface Post {
  id: string;
  ownerId: string;
  kind: PostKind;
  trade: string;
  location: string;
  companyName?: string;
  rate: number;
  from: string;
  to: string;
  description: string;
  createdAt: string;
  interested: string[];
  revision?: number;
}
export interface Database {
  profiles: Profile[];
  posts: Post[];
}
