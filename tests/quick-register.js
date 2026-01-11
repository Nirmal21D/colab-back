#!/usr/bin/env node

/**
 * Quick Test Script for Auth Endpoints
 * For quick manual testing without interactive prompts
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL = `quicktest${Date.now()}@example.com`;
const TEST_PASSWORD = 'Test@12345';

console.log('🚀 Quick Auth Test');
console.log('==================\n');

// 1. Register
console.log('1️⃣  Registering user...');
const registerResponse = await fetch(`${BASE_URL}/auth/register`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'Quick Test User',
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
    phone: '+1234567890',
    role: 'customer',
  }),
});

const registerData = await registerResponse.json();
console.log('Response:', registerData);

if (registerData.success) {
  console.log('\n✅ Registration successful!');
  console.log(`📧 OTP sent to: ${TEST_EMAIL}`);
  console.log('\n📝 Next steps:');
  console.log(`1. Check email for OTP`);
  console.log(`2. Run: node tests/verify-otp.js ${TEST_EMAIL} YOUR_OTP_CODE`);
} else {
  console.log('\n❌ Registration failed:', registerData.message);
}

console.log(`\n🔐 Test Credentials:`);
console.log(`   Email: ${TEST_EMAIL}`);
console.log(`   Password: ${TEST_PASSWORD}\n`);
