/**
 * Script to create an admin user
 * Run: node scripts/create-admin.js
 */

const mongoose = require('mongoose');
const User = require('../src/models/User');
const config = require('../src/config/env');

const createAdmin = async () => {
  try {
    // Connect to database
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connected to MongoDB');

    // Check if admin already exists
    const existingAdmin = await User.findOne({ email: 'admin@collabry.com' });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists');
      console.log('Email:', existingAdmin.email);
      console.log('Role:', existingAdmin.role);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@collabry.com',
      password: 'admin123',
      role: 'admin',
      isActive: true,
    });

    console.log('✅ Admin user created successfully!');
    console.log('');
    console.log('Login credentials:');
    console.log('Email: admin@collabry.com');
    console.log('Password: admin123');
    console.log('');
    console.log('⚠️  Please change the password after first login!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin:', error.message);
    process.exit(1);
  }
};

createAdmin();
