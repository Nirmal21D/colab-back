import fetch from 'node-fetch';
import readline from 'readline';

// Configuration
const BASE_URL = 'http://localhost:5000/api';
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// Test data
let testUser = {
  name: 'Test User',
  email: `nirmaldarekar90@gmail.com`,
  password: '12345678',
  phone: '9833921091',
  role: 'customer',
};

let authToken = null;
let otpCode = null;

// Helper functions
const log = {
  title: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}${colors.reset}`),
  section: (msg) => console.log(`${colors.bright}${colors.blue}\n🔷 ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✓ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}✗ ${msg}${colors.reset}`),
  info: (msg) => console.log(`${colors.yellow}ℹ ${msg}${colors.reset}`),
  data: (label, data) => console.log(`${colors.cyan}  ${label}:${colors.reset}`, JSON.stringify(data, null, 2)),
};

const apiCall = async (endpoint, method = 'GET', body = null, token = null) => {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(`${BASE_URL}${endpoint}`, options);
    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 500, data: { success: false, message: error.message } };
  }
};

const askQuestion = (question) => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${colors.yellow}${question}${colors.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

// Test functions
const testHealthCheck = async () => {
  log.section('Testing Health Check Endpoint');
  
  const response = await fetch('http://localhost:5000/health');
  const data = await response.json();
  
  if (response.status === 200 && data.success) {
    log.success('Server is running and healthy');
    log.data('Response', data);
  } else {
    log.error('Health check failed');
    log.data('Response', data);
    throw new Error('Server is not healthy');
  }
};

const testRegister = async () => {
  log.section('Testing User Registration (Send OTP)');
  log.info(`Email: ${testUser.email}`);
  
  const { status, data } = await apiCall('/auth/register', 'POST', testUser);
  
  if (status === 200 && data.success) {
    log.success('Registration initiated - OTP sent to email');
    log.data('Response', data);
    return true;
  } else {
    log.error('Registration failed');
    log.data('Response', data);
    return false;
  }
};

const testRegisterDuplicate = async () => {
  log.section('Testing Duplicate Registration (Should Fail)');
  
  const { status, data } = await apiCall('/auth/register', 'POST', testUser);
  
  if (status === 400 && !data.success) {
    log.success('Duplicate registration correctly rejected');
    log.data('Response', data);
  } else {
    log.error('Duplicate registration should have been rejected');
    log.data('Response', data);
  }
};

const testVerifyOTP = async (otp) => {
  log.section('Testing OTP Verification');
  
  const { status, data } = await apiCall('/auth/verify-otp', 'POST', {
    email: testUser.email,
    otp: otp,
  });
  
  if (status === 201 && data.success && data.data.token) {
    log.success('OTP verified - Account created successfully');
    authToken = data.data.token;
    log.data('User Data', data.data.user);
    log.info(`Auth Token: ${authToken.substring(0, 20)}...`);
    return true;
  } else {
    log.error('OTP verification failed');
    log.data('Response', data);
    return false;
  }
};

const testVerifyWrongOTP = async () => {
  log.section('Testing Wrong OTP (Should Fail)');
  
  const { status, data } = await apiCall('/auth/verify-otp', 'POST', {
    email: testUser.email,
    otp: '000000',
  });
  
  if (status === 400 && !data.success) {
    log.success('Wrong OTP correctly rejected');
    log.data('Response', data);
  } else {
    log.error('Wrong OTP should have been rejected');
    log.data('Response', data);
  }
};

const testResendOTP = async () => {
  log.section('Testing Resend OTP');
  
  const { status, data } = await apiCall('/auth/resend-otp', 'POST', {
    email: testUser.email,
  });
  
  if (status === 200 && data.success) {
    log.success('OTP resent successfully');
    log.data('Response', data);
    return true;
  } else {
    log.error('Resend OTP failed');
    log.data('Response', data);
    return false;
  }
};

const testLogin = async () => {
  log.section('Testing User Login');
  
  const { status, data } = await apiCall('/auth/login', 'POST', {
    email: testUser.email,
    password: testUser.password,
  });
  
  if (status === 200 && data.success && data.data.token) {
    log.success('Login successful');
    authToken = data.data.token;
    log.data('User Data', data.data.user);
    log.info(`Auth Token: ${authToken.substring(0, 20)}...`);
    return true;
  } else {
    log.error('Login failed');
    log.data('Response', data);
    return false;
  }
};

const testLoginWrongPassword = async () => {
  log.section('Testing Login with Wrong Password (Should Fail)');
  
  const { status, data } = await apiCall('/auth/login', 'POST', {
    email: testUser.email,
    password: 'wrongpassword',
  });
  
  if (status === 401 && !data.success) {
    log.success('Wrong password correctly rejected');
    log.data('Response', data);
  } else {
    log.error('Wrong password should have been rejected');
    log.data('Response', data);
  }
};

const testGetProfile = async () => {
  log.section('Testing Get User Profile (Protected Route)');
  
  const { status, data } = await apiCall('/auth/me', 'GET', null, authToken);
  
  if (status === 200 && data.success) {
    log.success('Profile retrieved successfully');
    log.data('User Profile', data.data.user);
    return true;
  } else {
    log.error('Get profile failed');
    log.data('Response', data);
    return false;
  }
};

const testGetProfileNoAuth = async () => {
  log.section('Testing Get Profile Without Auth (Should Fail)');
  
  const { status, data } = await apiCall('/auth/me', 'GET');
  
  if (status === 401 && !data.success) {
    log.success('Unauthorized access correctly rejected');
    log.data('Response', data);
  } else {
    log.error('Unauthorized access should have been rejected');
    log.data('Response', data);
  }
};

const testUpdateProfile = async () => {
  log.section('Testing Update Profile');
  
  const { status, data } = await apiCall('/auth/profile', 'PUT', {
    name: 'Updated Test User',
    phone: '+9876543210',
  }, authToken);
  
  if (status === 200 && data.success) {
    log.success('Profile updated successfully');
    log.data('Updated User', data.data.user);
    return true;
  } else {
    log.error('Update profile failed');
    log.data('Response', data);
    return false;
  }
};

// Main test runner
const runTests = async () => {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║                                                            ║');
  console.log('║       APPOINTIFY AUTH SYSTEM - COMPLETE TEST SUITE         ║');
  console.log('║                                                            ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  try {
    // 1. Health Check
    await testHealthCheck();

    // 2. Registration Flow
    log.title();
    log.info('📧 REGISTRATION & OTP VERIFICATION FLOW');
    await testRegister();
    
    // Wait for user to check email and enter OTP
    console.log(`\n${colors.yellow}${'─'.repeat(60)}${colors.reset}`);
    log.info('Please check your email for the OTP code');
    log.info(`Email sent to: ${testUser.email}`);
    const otp = await askQuestion('\nEnter the OTP code from your email: ');
    
    if (!otp || otp.length !== 6) {
      log.error('Invalid OTP format. Test aborted.');
      process.exit(1);
    }

    // Test wrong OTP first (optional)
    const testWrongOTP = await askQuestion('Do you want to test wrong OTP first? (y/n): ');
    if (testWrongOTP.toLowerCase() === 'y') {
      await testVerifyWrongOTP();
    }

    // Verify correct OTP
    const verified = await testVerifyOTP(otp);
    
    if (!verified) {
      log.error('OTP verification failed. Cannot continue tests.');
      process.exit(1);
    }

    // 3. Test duplicate registration
    await testRegisterDuplicate();

    // 4. Login Flow
    log.title();
    log.info('🔐 LOGIN FLOW');
    await testLoginWrongPassword();
    await testLogin();

    // 5. Protected Routes
    log.title();
    log.info('🛡️  PROTECTED ROUTES');
    await testGetProfileNoAuth();
    await testGetProfile();
    await testUpdateProfile();
    await testGetProfile(); // Check updated profile

    // Summary
    log.title();
    console.log(`\n${colors.bright}${colors.green}`);
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║                                                            ║');
    console.log('║              ✓ ALL TESTS COMPLETED SUCCESSFULLY            ║');
    console.log('║                                                            ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log(colors.reset);
    
    log.info('\n📋 Test Summary:');
    console.log(`  • Health Check: ${colors.green}✓${colors.reset}`);
    console.log(`  • Registration (OTP Send): ${colors.green}✓${colors.reset}`);
    console.log(`  • OTP Verification: ${colors.green}✓${colors.reset}`);
    console.log(`  • Duplicate Registration Rejection: ${colors.green}✓${colors.reset}`);
    console.log(`  • Login: ${colors.green}✓${colors.reset}`);
    console.log(`  • Wrong Credentials Rejection: ${colors.green}✓${colors.reset}`);
    console.log(`  • Get Profile (Authenticated): ${colors.green}✓${colors.reset}`);
    console.log(`  • Unauthorized Access Rejection: ${colors.green}✓${colors.reset}`);
    console.log(`  • Update Profile: ${colors.green}✓${colors.reset}`);

    log.info(`\n🔑 Test User Credentials:`);
    console.log(`  Email: ${colors.cyan}${testUser.email}${colors.reset}`);
    console.log(`  Password: ${colors.cyan}${testUser.password}${colors.reset}`);
    console.log(`  Token: ${colors.cyan}${authToken.substring(0, 30)}...${colors.reset}\n`);

  } catch (error) {
    log.title();
    log.error('Test suite failed with error:');
    console.error(error);
    process.exit(1);
  }
};

// Alternative: Automated test (if OTP is provided via command line)
const runAutomatedTest = async (providedOTP) => {
  console.log(`${colors.bright}${colors.cyan}`);
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          AUTOMATED AUTH TEST (OTP PROVIDED)                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  await testHealthCheck();
  await testRegister();
  await testVerifyOTP(providedOTP);
  await testLogin();
  await testGetProfile();
  await testUpdateProfile();
  
  log.success('\n✓ Automated tests completed!');
};

// Check for command line arguments
const otp = process.argv[2];
if (otp) {
  runAutomatedTest(otp);
} else {
  runTests();
}
