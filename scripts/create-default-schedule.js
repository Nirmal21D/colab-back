/**
 * Create default working hours for appointment
 * Monday-Friday, 9 AM - 5 PM
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Schedule from '../src/models/Schedule.js';
import Appointment from '../src/models/Appointment.js';

dotenv.config();

const createDefaultSchedule = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const appointmentId = '6946f105d1c9772fd4d4a212';
    
    // Check appointment exists
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      console.log('❌ Appointment not found!');
      process.exit(1);
    }

    console.log(`📋 Setting up schedule for: "${appointment.title}"\n`);

    // Find existing schedule
    const schedule = await Schedule.findOne({ appointment: appointmentId });
    
    if (!schedule) {
      console.log('❌ Schedule document not found!');
      process.exit(1);
    }

    // Default working hours: Monday-Friday, 9 AM - 5 PM
    const defaultWorkingHours = [
      { dayOfWeek: 0, isAvailable: false, slots: [] }, // Sunday - closed
      { dayOfWeek: 1, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Monday
      { dayOfWeek: 2, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Tuesday
      { dayOfWeek: 3, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Wednesday
      { dayOfWeek: 4, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Thursday
      { dayOfWeek: 5, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Friday
      { dayOfWeek: 6, isAvailable: false, slots: [] }, // Saturday - closed
    ];

    // Update schedule
    schedule.workingHours = defaultWorkingHours;
    await schedule.save();

    console.log('✅ Working hours configured!\n');
    console.log('📅 Schedule:');
    console.log('   Monday-Friday: 9:00 AM - 5:00 PM');
    console.log('   Saturday-Sunday: Closed');
    console.log('');
    console.log('🎉 Your appointment now has available time slots!');
    console.log('');
    console.log('🧪 Test it:');
    console.log(`   1. Frontend: Visit http://localhost:3000/customer/browse`);
    console.log(`   2. Click "Book Now" on "${appointment.title}"`);
    console.log(`   3. Select a date (Monday-Friday)`);
    console.log(`   4. You should see time slots from 9 AM to 5 PM`);
    console.log('');
    console.log('🔧 To customize:');
    console.log('   1. Login to organizer dashboard');
    console.log('   2. Go to Appointments → Your appointment');
    console.log('   3. Click "Schedule" tab');
    console.log('   4. Modify working hours as needed');
    console.log('');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
};

createDefaultSchedule();
