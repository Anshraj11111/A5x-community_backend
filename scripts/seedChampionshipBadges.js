import mongoose from 'mongoose';
import { Badge } from '../src/models/Badge.js';
import { env } from '../src/config/env.js';

const badges = [
  {
    slug: 'season-champion',
    name: 'Season Champion',
    tier: 'gold',
    color: '#FFD700',
    description: 'Awarded to every member of the #1 club at season end',
    icon: '🏆',
    criteria: 'Club finishes rank 1 in a Championship Season',
    isAutomatic: true,
  },
  {
    slug: 'season-runner-up',
    name: 'Season Runner-Up',
    tier: 'silver',
    color: '#C0C0C0',
    description: 'Awarded to every member of the #2 club at season end',
    icon: '🥈',
    criteria: 'Club finishes rank 2 in a Championship Season',
    isAutomatic: true,
  },
  {
    slug: 'season-third-place',
    name: 'Season Third Place',
    tier: 'bronze',
    color: '#CD7F32',
    description: 'Awarded to every member of the #3 club at season end',
    icon: '🥉',
    criteria: 'Club finishes rank 3 in a Championship Season',
    isAutomatic: true,
  },
];

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const badge of badges) {
    const result = await Badge.updateOne(
      { slug: badge.slug },
      { $set: badge },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      console.log(`✅ Created badge: ${badge.name}`);
    } else if (result.modifiedCount > 0) {
      console.log(`🔄 Updated badge: ${badge.name}`);
    } else {
      console.log(`⏭️  Skipped (no changes): ${badge.name}`);
    }
  }

  await mongoose.disconnect();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
