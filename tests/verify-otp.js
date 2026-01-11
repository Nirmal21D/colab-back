#!/usr/bin/env node

/**
 * Verify OTP and complete registration
 * Usage: node tests/verify-otp.js <email> <otp>
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';
const email = process.argv[2];
const otp = process.argv[3];

if (!email || !otp) {
  console.log('❌ Usage: node tests/verify-otp.js <email> <otp>');
  console.log('   Example: node tests/verify-otp.js test@example.com 123456');
  process.exit(1);
}

console.log('🔐 Verifying OTP...');
console.log(`📧 Email: ${email}`);
console.log(`🔢 OTP: ${otp}\n`);

const response = await fetch(`${BASE_URL}/auth/verify-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, otp }),
});

const data = await response.json();

if (data.success) {
  console.log('✅ OTP Verified Successfully!');
  console.log('\n👤 User Details:');
  console.log(JSON.stringify(data.data.user, null, 2));
  console.log('\n🔑 Auth Token:');
  console.log(data.data.token);
  console.log('\n✨ Account is now active and ready to use!');
} else {
  console.log('❌ Verification Failed:', data.message);
  if (data.errors) {
    console.log('Errors:', data.errors);
  }
}
