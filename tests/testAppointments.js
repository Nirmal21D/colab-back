import fetch from 'node-fetch';

const API_BASE_URL = 'http://localhost:5000/api';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

let authToken = '';
let testAppointmentId = '';
let testSlug = '';

// Helper function to make API requests
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();
    return { status: response.status, data };
  } catch (error) {
    return { status: 0, error: error.message };
  }
}

// Test helper
function logTest(testName, passed, message = '') {
  const icon = passed ? '✓' : '✗';
  const color = passed ? colors.green : colors.red;
  console.log(`${color}${icon} ${testName}${colors.reset}${message ? ': ' + message : ''}`);
}

function logSection(title) {
  console.log(`\n${colors.cyan}${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log(`${'='.repeat(60)}${colors.reset}\n`);
}

// Test 1: Login with existing organizer account
async function testAuthSetup() {
  logSection('AUTHENTICATION SETUP');

  // ===== CONFIGURE YOUR CREDENTIALS HERE =====
  const ORGANIZER_EMAIL = 'harshitagawas@gmail.com';
  const ORGANIZER_PASSWORD = 'Harry@123';
  // ===========================================

  console.log(`${colors.yellow}Logging in with organizer account...${colors.reset}`);
  console.log(`${colors.yellow}Email: ${ORGANIZER_EMAIL}${colors.reset}`);

  const loginRes = await apiRequest('/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: ORGANIZER_EMAIL,
      password: ORGANIZER_PASSWORD,
    }),
  });

  if (loginRes.data.success) {
    authToken = loginRes.data.data.token;
    const user = loginRes.data.data.user;
    
    // Verify it's an organizer account
    if (user.role !== 'organizer') {
      logTest('Login', false, `Account is not an organizer (role: ${user.role})`);
      console.log(`${colors.red}Please use an organizer account for testing${colors.reset}`);
      process.exit(1);
    }
    
    logTest('Login successful', true, `Welcome, ${user.name}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Role: ${user.role}`);
  } else {
    logTest('Login', false, loginRes.data.message);
    console.log(`${colors.red}Authentication failed!${colors.reset}`);
    console.log(`${colors.yellow}Please update credentials at the top of testAuthSetup() function${colors.reset}`);
    console.log(`${colors.yellow}File: tests/testAppointments.js (lines 70-72)${colors.reset}`);
    process.exit(1);
  }

  return authToken;
}

// Test 2: Create appointment
async function testCreateAppointment() {
  logSection('TEST 1: CREATE APPOINTMENT');

  const appointmentData = {
    title: 'Test Dental Consultation',
    description: 'General dental checkup and consultation',
    duration: 30,
    capacity: 2,
    assignmentType: 'auto',
    location: '123 Main Street, City',
    locationType: 'in-person',
    requiresPayment: true,
    price: 50,
    advanceBookingDays: 30,
    minNoticeHours: 24,
  };

  const res = await apiRequest('/appointments', {
    method: 'POST',
    body: JSON.stringify(appointmentData),
  });

  if (res.data.success) {
    testAppointmentId = res.data.data.appointment._id;
    testSlug = res.data.data.appointment.slug;
    logTest('Create appointment', true, `ID: ${testAppointmentId}`);
    console.log(`   Slug: ${testSlug}`);
    console.log(`   Title: ${res.data.data.appointment.title}`);
    return res.data.data.appointment;
  } else {
    logTest('Create appointment', false, res.data.message);
    return null;
  }
}

// Test 3: Get all organizer appointments
async function testGetOrganizerAppointments() {
  logSection('TEST 2: GET ORGANIZER APPOINTMENTS');

  const res = await apiRequest('/appointments', {
    method: 'GET',
  });

  if (res.data.success) {
    logTest('Get organizer appointments', true, `Found ${res.data.data.count} appointments`);
    res.data.data.appointments.forEach((apt, index) => {
      console.log(`   ${index + 1}. ${apt.title} (${apt.isPublished ? 'Published' : 'Draft'})`);
    });
    return res.data.data.appointments;
  } else {
    logTest('Get organizer appointments', false, res.data.message);
    return [];
  }
}

// Test 4: Get single appointment by ID
async function testGetAppointmentById() {
  logSection('TEST 3: GET APPOINTMENT BY ID');

  if (!testAppointmentId) {
    logTest('Get appointment by ID', false, 'No test appointment ID available');
    return;
  }

  const res = await apiRequest(`/appointments/${testAppointmentId}`, {
    method: 'GET',
  });

  if (res.data.success) {
    logTest('Get appointment by ID', true);
    console.log(`   Title: ${res.data.data.appointment.title}`);
    console.log(`   Duration: ${res.data.data.appointment.duration} min`);
    console.log(`   Capacity: ${res.data.data.appointment.capacity}`);
    console.log(`   Published: ${res.data.data.appointment.isPublished}`);
    return res.data.data.appointment;
  } else {
    logTest('Get appointment by ID', false, res.data.message);
    return null;
  }
}

// Test 5: Update appointment
async function testUpdateAppointment() {
  logSection('TEST 4: UPDATE APPOINTMENT');

  if (!testAppointmentId) {
    logTest('Update appointment', false, 'No test appointment ID available');
    return;
  }

  const updateData = {
    title: 'Updated Dental Consultation',
    description: 'Updated description for dental checkup',
    duration: 45,
    price: 75,
  };

  const res = await apiRequest(`/appointments/${testAppointmentId}`, {
    method: 'PUT',
    body: JSON.stringify(updateData),
  });

  if (res.data.success) {
    logTest('Update appointment', true);
    console.log(`   New title: ${res.data.data.appointment.title}`);
    console.log(`   New duration: ${res.data.data.appointment.duration} min`);
    console.log(`   New price: $${res.data.data.appointment.price}`);
    return res.data.data.appointment;
  } else {
    logTest('Update appointment', false, res.data.message);
    return null;
  }
}

// Test 6: Toggle publish status
async function testTogglePublish() {
  logSection('TEST 5: TOGGLE PUBLISH STATUS');

  if (!testAppointmentId) {
    logTest('Toggle publish', false, 'No test appointment ID available');
    return;
  }

  // First toggle
  const res1 = await apiRequest(`/appointments/${testAppointmentId}/publish`, {
    method: 'PATCH',
  });

  if (res1.data.success) {
    const published1 = res1.data.data.appointment.isPublished;
    logTest('Toggle publish (first)', true, `Status: ${published1 ? 'Published' : 'Unpublished'}`);
    
    // Ensure it's published for subsequent tests
    if (!published1) {
      console.log(`   ${colors.yellow}Toggling again to ensure published status...${colors.reset}`);
      const res2 = await apiRequest(`/appointments/${testAppointmentId}/publish`, {
        method: 'PATCH',
      });
      
      if (res2.data.success && res2.data.data.appointment.isPublished) {
        logTest('Toggle publish (second)', true, 'Status: Published');
        return res2.data.data.appointment;
      }
    }
    
    return res1.data.data.appointment;
  } else {
    logTest('Toggle publish', false, res1.data.message);
    return null;
  }
}

// Test 7: Get appointment by slug (public)
async function testGetAppointmentBySlug() {
  logSection('TEST 6: GET APPOINTMENT BY SLUG (Public)');

  if (!testSlug) {
    logTest('Get appointment by slug', false, 'No test slug available');
    return;
  }

  // Verify current status
  console.log(`   ${colors.yellow}Verifying appointment is published...${colors.reset}`);
  const checkRes = await apiRequest(`/appointments/${testAppointmentId}`, {
    method: 'GET',
  });

  if (checkRes.data.success) {
    const isPublished = checkRes.data.data.appointment.isPublished;
    console.log(`   Current status: ${isPublished ? 'Published' : 'Not Published'}`);
    
    if (!isPublished) {
      console.log(`   ${colors.yellow}Publishing appointment...${colors.reset}`);
      const publishRes = await apiRequest(`/appointments/${testAppointmentId}/publish`, {
        method: 'PATCH',
      });
      if (!publishRes.data.success) {
        logTest('Publish appointment', false, publishRes.data.message);
        return null;
      }
    }
  }

  console.log(`   ${colors.yellow}Fetching by slug: ${testSlug}${colors.reset}`);
  const res = await apiRequest(`/appointments/slug/${testSlug}`, {
    method: 'GET',
  });

  if (res.data.success) {
    logTest('Get appointment by slug', true, `Slug: ${testSlug}`);
    console.log(`   Title: ${res.data.data.appointment.title}`);
    console.log(`   Organizer: ${res.data.data.appointment.organizer.name}`);
    return res.data.data.appointment;
  } else {
    logTest('Get appointment by slug', false, res.data.message);
    console.log(`   ${colors.red}Debug: Status ${res.status}, Response:`, JSON.stringify(res.data, null, 2));
    return null;
  }
}

// Test 8: Get available slots
async function testGetAvailableSlots() {
  logSection('TEST 7: GET AVAILABLE SLOTS');

  if (!testAppointmentId) {
    logTest('Get available slots', false, 'No test appointment ID available');
    return;
  }

  // Verify appointment is published
  console.log(`   ${colors.yellow}Verifying appointment is published...${colors.reset}`);
  const checkRes = await apiRequest(`/appointments/${testAppointmentId}`, {
    method: 'GET',
  });

  if (checkRes.data.success) {
    const isPublished = checkRes.data.data.appointment.isPublished;
    const isActive = checkRes.data.data.appointment.isActive;
    console.log(`   Published: ${isPublished}, Active: ${isActive}`);
    
    if (!isPublished) {
      logTest('Get available slots', false, 'Appointment is not published');
      console.log(`   ${colors.yellow}Skipping slot test - appointment must be published${colors.reset}`);
      return [];
    }
  }

  const today = new Date();
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const startDate = today.toISOString().split('T')[0];
  const endDate = nextWeek.toISOString().split('T')[0];

  console.log(`   ${colors.yellow}Querying slots from ${startDate} to ${endDate}${colors.reset}`);
  const res = await apiRequest(
    `/appointments/${testAppointmentId}/slots?startDate=${startDate}&endDate=${endDate}`,
    {
      method: 'GET',
    }
  );

  if (res.data.success) {
    logTest('Get available slots', true, `Found ${res.data.data.count} slots`);
    if (res.data.data.slots.length > 0) {
      console.log(`   Showing first 5 slots:`);
      res.data.data.slots.slice(0, 5).forEach((slot, index) => {
        console.log(`   ${index + 1}. ${slot.date} at ${slot.time}`);
      });
    } else {
      console.log(`   ${colors.yellow}No slots available in the queried date range${colors.reset}`);
    }
    return res.data.data.slots;
  } else {
    logTest('Get available slots', false, res.data.message);
    return [];
  }
}

// Test 9: Delete appointment
async function testDeleteAppointment() {
  logSection('TEST 8: DELETE APPOINTMENT');

  if (!testAppointmentId) {
    logTest('Delete appointment', false, 'No test appointment ID available');
    return;
  }

  const res = await apiRequest(`/appointments/${testAppointmentId}`, {
    method: 'DELETE',
  });

  if (res.data.success) {
    logTest('Delete appointment', true);
    return true;
  } else {
    logTest('Delete appointment', false, res.data.message);
    return false;
  }
}

// Test 10: Verify deletion
async function testVerifyDeletion() {
  logSection('TEST 9: VERIFY DELETION');

  if (!testAppointmentId) {
    logTest('Verify deletion', false, 'No test appointment ID available');
    return;
  }

  const res = await apiRequest(`/appointments/${testAppointmentId}`, {
    method: 'GET',
  });

  if (res.status === 404 || !res.data.success) {
    logTest('Verify deletion', true, 'Appointment successfully deleted');
    return true;
  } else {
    logTest('Verify deletion', false, 'Appointment still exists');
    return false;
  }
}

// Main test runner
async function runAllTests() {
  console.log(`\n${colors.blue}╔${'═'.repeat(58)}╗`);
  console.log(`║${' '.repeat(10)}APPOINTIFY - APPOINTMENT API TESTS${' '.repeat(13)}║`);
  console.log(`╚${'═'.repeat(58)}╝${colors.reset}\n`);

  try {
    // Setup
    await testAuthSetup();

    // Run tests
    await testCreateAppointment();
    await testGetOrganizerAppointments();
    await testGetAppointmentById();
    await testUpdateAppointment();
    await testTogglePublish();
    await testGetAppointmentBySlug();
    await testGetAvailableSlots();
    await testDeleteAppointment();
    await testVerifyDeletion();

    // Summary
    logSection('TEST SUMMARY');
    console.log(`${colors.green}All appointment endpoint tests completed!${colors.reset}\n`);
  } catch (error) {
    console.error(`\n${colors.red}Test execution failed:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Run tests
runAllTests();
