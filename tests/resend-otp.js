#!/usr/bin/env node

/**
 * Resend OTP
 * Usage: node tests/resend-otp.js <email>
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';
const email = process.argv[2];

if (!email) {
  console.log('❌ Usage: node tests/resend-otp.js <email>');
  console.log('   Example: node tests/resend-otp.js test@example.com');
  process.exit(1);
}

console.log('📧 Resending OTP...');
console.log(`Email: ${email}\n`);

const response = await fetch(`${BASE_URL}/auth/resend-otp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email }),
});

const data = await response.json();

if (data.success) {
  console.log('✅ OTP Resent Successfully!');
  console.log(JSON.stringify(data, null, 2));
  console.log('\n📬 Check your email for the new OTP code');
} else {
  console.log('❌ Resend Failed:', data.message);
}
