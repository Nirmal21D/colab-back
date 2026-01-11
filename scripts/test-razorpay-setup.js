/**
 * Test Razorpay Integration Setup
 * Verifies that Razorpay credentials are configured correctly
 */

import dotenv from 'dotenv';
import Razorpay from 'razorpay';

dotenv.config();

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`);
}

async function testRazorpaySetup() {
  console.log('\n' + '='.repeat(50));
  log('🔍 Testing Razorpay Integration Setup', colors.blue + colors.bold);
  console.log('='.repeat(50) + '\n');

  // Check environment variables
  log('1. Checking Environment Variables...', colors.blue);
  
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  if (!keyId || keyId === 'your_razorpay_key_id') {
    log('   ❌ RAZORPAY_KEY_ID not configured', colors.red);
    log('   Please set your Razorpay Key ID in backend/.env\n', colors.yellow);
    process.exit(1);
  } else {
    log(`   ✅ RAZORPAY_KEY_ID found: ${keyId}`, colors.green);
  }

  if (!keySecret || keySecret === 'your_razorpay_key_secret') {
    log('   ❌ RAZORPAY_KEY_SECRET not configured', colors.red);
    log('   Please set your Razorpay Key Secret in backend/.env\n', colors.yellow);
    process.exit(1);
  } else {
    log('   ✅ RAZORPAY_KEY_SECRET found: ' + '*'.repeat(keySecret.length), colors.green);
  }

  if (!webhookSecret || webhookSecret === 'your_razorpay_webhook_secret') {
    log('   ⚠️  RAZORPAY_WEBHOOK_SECRET not configured', colors.yellow);
    log('   Webhooks will not work until this is set\n', colors.yellow);
  } else {
    log('   ✅ RAZORPAY_WEBHOOK_SECRET found', colors.green);
  }

  console.log();

  // Test Razorpay connection
  log('2. Testing Razorpay Connection...', colors.blue);

  try {
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    // Try to create a test order
    const testOrder = await razorpay.orders.create({
      amount: 100, // ₹1 in paise
      currency: 'INR',
      receipt: 'test_receipt_' + Date.now(),
      notes: {
        purpose: 'Integration test',
      },
    });

    log(`   ✅ Successfully connected to Razorpay`, colors.green);
    log(`   ✅ Test order created: ${testOrder.id}`, colors.green);
    log(`   Amount: ₹${testOrder.amount / 100}`, colors.green);
    console.log();

    // Check if it's test or live mode
    if (keyId.startsWith('rzp_test_')) {
      log('   ℹ️  Running in TEST mode', colors.blue);
      log('   Use test cards for payments\n', colors.yellow);
    } else if (keyId.startsWith('rzp_live_')) {
      log('   ⚠️  Running in LIVE mode', colors.yellow);
      log('   Real payments will be processed!\n', colors.red);
    }

  } catch (error) {
    log('   ❌ Failed to connect to Razorpay', colors.red);
    log(`   Error: ${error.message}\n`, colors.red);
    
    if (error.message.includes('authentication')) {
      log('   Possible causes:', colors.yellow);
      log('   - Invalid Key ID or Key Secret', colors.yellow);
      log('   - Credentials from different account', colors.yellow);
      log('   - Test/Live mode mismatch\n', colors.yellow);
    }
    
    process.exit(1);
  }

  // Summary
  console.log('='.repeat(50));
  log('✅ Razorpay Integration Setup Complete!', colors.green + colors.bold);
  console.log('='.repeat(50) + '\n');

  log('Next Steps:', colors.blue);
  log('1. Create a paid appointment with requiresPayment: true', colors.reset);
  log('2. Book the appointment as a customer', colors.reset);
  log('3. Complete payment using test card: 4111 1111 1111 1111', colors.reset);
  log('4. Verify booking status changes to "confirmed"\n', colors.reset);

  log('Test Cards:', colors.blue);
  log('Success: 4111 1111 1111 1111', colors.green);
  log('Failure: 4000 0000 0000 0002', colors.red);
  log('CVV: Any 3 digits, Expiry: Any future date\n', colors.reset);
}

// Run the test
testRazorpaySetup().catch((error) => {
  console.error('Test failed:', error);
  process.exit(1);
});
