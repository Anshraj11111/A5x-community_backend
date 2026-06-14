/**
 * Creates / promotes all specified founder accounts.
 * Safe to re-run — skips if already exists with correct role.
 *
 * Usage:  node scripts/createFounders.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const FOUNDERS = [
  { email: 'anshrajbaghel30@gmail.com',   username: 'anshrajbaghel',   displayName: 'Ansh Raj Baghel' },
  { email: 'chris.alex.francis25@gmail.com', username: 'chrisalexfrancis', displayName: 'Chris Alex Francis' },
  { email: 'adityamishra9696@gmail.com',   username: 'adityamishra9696', displayName: 'Aditya Mishra' },
  { email: 'payasiamit07@gmail.com',       username: 'payasiamit',       displayName: 'Amit Payasi' },
  { email: 'mishraanupam14805@gmail.com',  username: 'mishraanupam',     displayName: 'Anupam Mishra' },
];

const DEFAULT_PASSWORD = '11111111';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error('❌ MONGODB_URI not set'); process.exit(1); }

const UserSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  role:        { type: String, enum: ['user', 'moderator', 'admin', 'founder', 'co_founder'], default: 'user' },
  reputation:  { type: Number, default: 0 },
  isVerified:  { type: Boolean, default: true },
  isBanned:    { type: Boolean, default: false },
  badges:      [{ type: mongoose.Schema.Types.Mixed }],
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications:  { type: Boolean, default: true },
  },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function run() {
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB\n');

  const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 12);

  for (const f of FOUNDERS) {
    const existing = await User.findOne({ email: f.email.toLowerCase() });

    if (existing) {
      const needsUpdate = existing.role !== 'founder';
      if (needsUpdate) {
        existing.role = 'founder';
        await existing.save();
        console.log(`🔄 Promoted: ${f.email} → founder`);
      } else {
        console.log(`✅ Already founder: ${f.email}`);
      }
    } else {
      // Generate a unique username if collision
      let username = f.username;
      let suffix = 2;
      while (await User.findOne({ username })) {
        username = `${f.username}${suffix++}`;
      }

      await User.create({
        username,
        displayName: f.displayName,
        email:       f.email.toLowerCase(),
        password:    hashedPassword,
        role:        'founder',
        isVerified:  true,
      });
      console.log(`🎉 Created: ${f.email} (@${username})`);
    }
  }

  console.log(`\n🔑 Password for all accounts: ${DEFAULT_PASSWORD}`);
  console.log('🌐 Login at: http://localhost:5173/founder\n');

  await mongoose.disconnect();
}

run().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
