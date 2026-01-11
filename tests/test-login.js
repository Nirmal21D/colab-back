#!/usr/bin/env node

/**
 * Test Login
 * Usage: node tests/test-login.js <email> <password>
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';
const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.log('❌ Usage: node tests/test-login.js <email> <password>');
  console.log('   Example: node tests/test-login.js test@example.com MyPassword123');
  process.exit(1);
}

console.log('🔐 Testing Login...');
console.log(`📧 Email: ${email}\n`);

const response = await fetch(`${BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password }),
});

const data = await response.json();

if (data.success) {
  console.log('✅ Login Successful!');
  console.log('\n👤 User Details:');
  console.log(JSON.stringify(data.data.user, null, 2));
  console.log('\n🔑 Auth Token:');
  console.log(data.data.token);
  console.log('\n💡 Use this token for authenticated requests:');
  console.log(`   Authorization: Bearer ${data.data.token}`);
} else {
  console.log('❌ Login Failed:', data.message);
}
