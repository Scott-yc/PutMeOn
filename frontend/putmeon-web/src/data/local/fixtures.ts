import type { Database } from '../../domain/models';
const date = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export function seed(): Database {
  return {
    profiles: [
      {
        id: 'builder',
        email: 'builder@example.com',
        name: 'ABC Carpentry',
        phone: '0412 345 678',
        trade: 'Carpenter',
        location: 'Brisbane South',
      },
      {
        id: 'electrician',
        email: 'electrician@example.com',
        name: 'Jack Brown',
        phone: '0423 456 789',
        trade: 'Electrician',
        location: 'North Brisbane',
      },
    ],
    posts: [
      {
        id: 'framing',
        ownerId: 'builder',
        kind: 'looking',
        trade: 'Carpenter',
        location: 'Brisbane South',
        rate: 55,
        from: date(0),
        to: date(6),
        description: 'Need two carpenters for framing work.\nOwn tools preferred.',
        createdAt: new Date().toISOString(),
        interested: [],
      },
      {
        id: 'electrical',
        ownerId: 'electrician',
        kind: 'available',
        trade: 'Electrician',
        location: 'North Brisbane',
        rate: 60,
        from: date(0),
        to: date(7),
        description: 'Commercial and residential experience.',
        createdAt: new Date().toISOString(),
        interested: [],
      },
    ],
  };
}
