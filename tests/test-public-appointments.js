/**
 * Test script to call the public appointments API directly
 */

import fetch from 'node-fetch';

const API_URL = process.env.API_URL || 'http://localhost:5000';

async function testPublicAppointments() {
  try {
    console.log('🧪 Testing GET /api/appointments/public\n');
    console.log(`📡 URL: ${API_URL}/api/appointments/public\n`);

    const response = await fetch(`${API_URL}/api/appointments/public`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('Status:', response.status, response.statusText);
    console.log('');

    const data = await response.json();
    
    if (response.ok) {
      console.log('✅ SUCCESS\n');
      console.log('Response:', JSON.stringify(data, null, 2));
      console.log('');
      console.log(`📋 Total appointments: ${data.data?.appointments?.length || 0}`);
      
      if (data.data?.appointments?.length > 0) {
        console.log('\n📝 First appointment:');
        const first = data.data.appointments[0];
        console.log('   ID:', first._id);
        console.log('   Title:', first.title);
        console.log('   Slug:', first.slug);
        console.log('   Assignment Type:', first.assignmentType);
        console.log('   Assigned Staff:', first.assignedStaff?.length || 0, 'staff members');
        console.log('   Is Published:', first.isPublished);
        console.log('   Is Active:', first.isActive);
      }
    } else {
      console.log('❌ ERROR\n');
      console.log('Response:', JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Request failed:', error.message);
    console.error(error);
  }
}

testPublicAppointments();
