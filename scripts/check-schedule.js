/**
 * Check if Schedule exists for appointment
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Schedule from '../src/models/Schedule.js';
import Appointment from '../src/models/Appointment.js';

dotenv.config();

const checkSchedule = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // CHANGE THIS to your appointment ID
    const appointmentId = '6946f105d1c9772fd4d4a212';
    
    console.log(`🔍 Checking schedule for appointment: ${appointmentId}\n`);

    // Check if appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      console.log('❌ Appointment not found!');
      process.exit(1);
    }

    console.log('📋 Appointment Details:');
    console.log('   Title:', appointment.title);
    console.log('   Duration:', appointment.duration, 'hour(s)');
    console.log('   Assignment Type:', appointment.assignmentType);
    console.log('   Published:', appointment.isPublished);
    console.log('');

    // Check if schedule exists
    const schedule = await Schedule.findOne({ appointment: appointmentId });
    
    if (!schedule) {
      console.log('❌ NO SCHEDULE FOUND!');
      console.log('');
      console.log('⚠️  This is why no slots are available for booking.');
      console.log('');
      console.log('🔧 FIX: Create a schedule for this appointment');
      console.log('');
      console.log('Option 1: Use the frontend UI');
      console.log('   1. Login as organizer');
      console.log('   2. Go to Appointments → Select your appointment');
      console.log('   3. Go to "Schedule" tab');
      console.log('   4. Set working hours (e.g., Mon-Fri 9am-5pm)');
      console.log('   5. Save');
      console.log('');
      console.log('Option 2: Run the create-schedule.js script (I can create it)');
      console.log('');
    } else {
      console.log('✅ SCHEDULE FOUND!');
      console.log('');
      console.log('📅 Working Hours:');
      
      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      
      schedule.workingHours.forEach(wh => {
        if (wh.isAvailable) {
          console.log(`   ${dayNames[wh.dayOfWeek]}:`, 
            wh.slots.map(s => `${s.startTime}-${s.endTime}`).join(', '));
        } else {
          console.log(`   ${dayNames[wh.dayOfWeek]}: Unavailable`);
        }
      });

      if (schedule.dateOverrides && schedule.dateOverrides.length > 0) {
        console.log('');
        console.log('📆 Date Overrides:', schedule.dateOverrides.length);
        schedule.dateOverrides.forEach(override => {
          console.log(`   ${override.date.toISOString().split('T')[0]}:`, 
            override.isAvailable ? 'Custom hours' : 'CLOSED');
        });
      }

      console.log('');
      console.log('✅ Schedule is properly configured!');
      console.log('');
      console.log('🧪 Test slot generation:');
      console.log(`   curl "http://localhost:5000/api/appointments/${appointmentId}/slots?startDate=2025-12-22&endDate=2025-12-28"`);
    }

    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
};

checkSchedule();
