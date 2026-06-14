/**
 * Founder Seed Script
 * Creates founder@gmail.com with password 11111111 and role 'founder'.
 * Safe to re-run — skips creation if user already exists, just ensures role is correct.
 *
 * Usage:
 *   node scripts/createFounder.js
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const FOUNDER = {
  username:    'founder',
  displayName: 'Founder',
  email:       'founder@gmail.com',
  password:    '11111111',
  role:        'founder',
};

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not found in .env');
  process.exit(1);
}

// Inline schema so we don't need the compiled model
const UserSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, lowercase: true, trim: true },
  displayName: { type: String, required: true, trim: true },
  email:       { type: String, required: true, unique: true, lowercase: true, trim: true },
  password:    { type: String, required: true },
  role:        { type: String, enum: ['user', 'moderator', 'admin', 'founder', 'co_founder'], default: 'user' },
  reputation:  { type: Number, default: 0 },
  isVerified:  { type: Boolean, default: false },
  isBanned:    { type: Boolean, default: false },
  badges:      [{ type: mongoose.Schema.Types.Mixed }],
  preferences: {
    emailNotifications: { type: Boolean, default: true },
    pushNotifications:  { type: Boolean, default: true },
  },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model('User', UserSchema);

async function run() {
  console.log('🔌  Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅  Connected\n');

  const existing = await User.findOne({
    $or: [{ email: FOUNDER.email }, { username: FOUNDER.username }],
  });

  if (existing) {
    // Update role to founder if not already
    if (existing.role !== 'founder') {
      existing.role = 'founder';
      await existing.save();
      console.log(`🔄  Existing user "${existing.email}" updated → role: founder`);
    } else {
      console.log(`ℹ️   Founder account already exists: ${existing.email}`);
    }
    console.log('\n   📧  Email   :', FOUNDER.email);
    console.log('   🔑  Password:', FOUNDER.password);
    console.log('   🎭  Role    : founder');
    console.log('\n   ➜  Login at http://localhost:5173/founder\n');
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(FOUNDER.password, 12);

  await User.create({
    username:    FOUNDER.username,
    displayName: FOUNDER.displayName,
    email:       FOUNDER.email,
    password:    hashedPassword,
    role:        FOUNDER.role,
    isVerified:  true,
  });

  console.log('🎉  Founder account created!\n');
  console.log('   📧  Email   :', FOUNDER.email);
  console.log('   🔑  Password:', FOUNDER.password);
  console.log('   🎭  Role    : founder');
  console.log('\n   ➜  Login at http://localhost:5173/founder\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
