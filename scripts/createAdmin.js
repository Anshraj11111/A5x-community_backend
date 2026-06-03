/**
 * Admin Seed Script
 * 
 * Usage:
 *   node scripts/createAdmin.js
 * 
 * Creates an admin user in MongoDB. Run once.
 * Edit the ADMIN object below before running.
 */

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

// ── Edit these before running ──────────────────────────────────────────────────
const ADMIN = {
  username:    'admin',
  displayName: 'Admin',
  email:       'admin@a5x.community',
  password:    'Admin@12345',        // change this to a strong password
  role:        'admin',              // 'admin' or 'moderator'
};
// ───────────────────────────────────────────────────────────────────────────────

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('❌  MONGODB_URI not found in .env');
  process.exit(1);
}

const UserSchema = new mongoose.Schema({
  username:    { type: String, required: true, unique: true, lowercase: true },
  displayName: { type: String, required: true },
  email:       { type: String, required: true, unique: true, lowercase: true },
  password:    { type: String, required: true },
  role:        { type: String, enum: ['user','moderator','admin'], default: 'user' },
  reputation:  { type: Number, default: 0 },
  isBanned:    { type: Boolean, default: false },
  isVerified:  { type: Boolean, default: false },
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
  console.log('✅  Connected');

  // Check if already exists
  const existing = await User.findOne({
    $or: [{ email: ADMIN.email }, { username: ADMIN.username }],
  });

  if (existing) {
    if (existing.role !== 'admin' && existing.role !== 'moderator') {
      // Promote existing user to admin
      existing.role = ADMIN.role;
      await existing.save();
      console.log(`✅  Existing user "${existing.email}" promoted to ${ADMIN.role}`);
    } else {
      console.log(`ℹ️   User "${existing.email}" already exists with role: ${existing.role}`);
      console.log('    Use the same email/password to log into the admin panel.');
    }
    await mongoose.disconnect();
    return;
  }

  const hashedPassword = await bcrypt.hash(ADMIN.password, 12);

  await User.create({
    username:    ADMIN.username,
    displayName: ADMIN.displayName,
    email:       ADMIN.email,
    password:    hashedPassword,
    role:        ADMIN.role,
    isVerified:  true,
  });

  console.log('\n🎉  Admin user created successfully!\n');
  console.log(`   📧  Email   : ${ADMIN.email}`);
  console.log(`   🔑  Password: ${ADMIN.password}`);
  console.log(`   🛡️   Role    : ${ADMIN.role}`);
  console.log('\n   ➜  Go to http://localhost:5173/admin/login to sign in.\n');

  await mongoose.disconnect();
}

run().catch(err => {
  console.error('❌  Error:', err.message);
  process.exit(1);
});
