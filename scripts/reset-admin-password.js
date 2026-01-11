/**
 * Script to reset admin password
 * Run: node scripts/reset-admin-password.js
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const config = require('../src/config/env');

const resetAdminPassword = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connected to MongoDB');

    // Find admin user
    const admin = await User.findOne({ email: 'admin@collabry.com' });
    
    if (!admin) {
      console.log('❌ Admin user not found');
      console.log('Run: node scripts/create-admin.js to create one');
      process.exit(1);
    }

    // Update password
    admin.password = 'admin123';
    await admin.save();

    console.log('✅ Admin password reset successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('Email: admin@collabry.com');
    console.log('Password: admin123');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
};

resetAdminPassword();
