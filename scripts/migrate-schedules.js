/**
 * MIGRATION: Fix all schedules with empty working hours
 * This is a one-time migration to fix existing data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Schedule from '../src/models/Schedule.js';
import Appointment from '../src/models/Appointment.js';

dotenv.config();

const DEFAULT_WORKING_HOURS = [
  { dayOfWeek: 0, isAvailable: false, slots: [] }, // Sunday
  { dayOfWeek: 1, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Monday
  { dayOfWeek: 2, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Tuesday
  { dayOfWeek: 3, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Wednesday
  { dayOfWeek: 4, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Thursday
  { dayOfWeek: 5, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] }, // Friday
  { dayOfWeek: 6, isAvailable: false, slots: [] }, // Saturday
];

const migrateSchedules = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    console.log('🔍 Finding schedules with empty working hours...\n');

    // Find all schedules with empty or missing working hours
    const brokenSchedules = await Schedule.find({
      $or: [
        { workingHours: { $exists: false } },
        { workingHours: { $size: 0 } },
        { workingHours: null }
      ]
    }).populate('appointment', 'title');

    if (brokenSchedules.length === 0) {
      console.log('✅ No broken schedules found! All schedules have working hours configured.\n');
      process.exit(0);
    }

    console.log(`📋 Found ${brokenSchedules.length} schedule(s) with empty working hours:\n`);

    brokenSchedules.forEach((schedule, i) => {
      console.log(`   ${i + 1}. Appointment: "${schedule.appointment?.title || 'Unknown'}" (ID: ${schedule.appointment?._id})`);
    });

    console.log('\n🔧 Applying default working hours (Mon-Fri 9am-5pm)...\n');

    let fixed = 0;
    let failed = 0;

    for (const schedule of brokenSchedules) {
      try {
        schedule.workingHours = DEFAULT_WORKING_HOURS;
        await schedule.save();
        console.log(`   ✅ Fixed: ${schedule.appointment?.title || schedule.appointment}`);
        fixed++;
      } catch (error) {
        console.log(`   ❌ Failed: ${schedule.appointment?.title || schedule.appointment} - ${error.message}`);
        failed++;
      }
    }

    console.log('\n📊 MIGRATION SUMMARY:');
    console.log(`   ✅ Fixed: ${fixed}`);
    console.log(`   ❌ Failed: ${failed}`);
    console.log(`   📋 Total: ${brokenSchedules.length}`);
    console.log('');

    if (fixed > 0) {
      console.log('🎉 SUCCESS! All schedules now have default working hours.');
      console.log('');
      console.log('📅 Default Schedule:');
      console.log('   Monday-Friday: 9:00 AM - 5:00 PM');
      console.log('   Saturday-Sunday: Closed');
      console.log('');
      console.log('✏️  Organizers can customize these hours in:');
      console.log('   Dashboard → Appointments → Select Appointment → Schedule Tab');
    }

    console.log('');

  } catch (error) {
    console.error('❌ Migration Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Disconnected from MongoDB');
  }
};

migrateSchedules();
