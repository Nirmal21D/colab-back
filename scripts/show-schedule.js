/**
 * Show raw schedule data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Schedule from '../src/models/Schedule.js';

dotenv.config();

const showSchedule = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    
    const appointmentId = '6946f105d1c9772fd4d4a212';
    const schedule = await Schedule.findOne({ appointment: appointmentId }).lean();
    
    if (!schedule) {
      console.log('❌ No schedule found');
      process.exit(1);
    }

    console.log('📋 RAW SCHEDULE DATA:\n');
    console.log(JSON.stringify(schedule, null, 2));
    console.log('\n');
    
    console.log('📊 ANALYSIS:');
    console.log('Working Hours Array:', schedule.workingHours?.length || 0, 'entries');
    
    if (schedule.workingHours && schedule.workingHours.length > 0) {
      const hasAvailableDays = schedule.workingHours.some(wh => wh.isAvailable);
      console.log('Has Available Days:', hasAvailableDays ? '✅ YES' : '❌ NO');
      
      if (hasAvailableDays) {
        schedule.workingHours.forEach((wh, i) => {
          if (wh.isAvailable) {
            console.log(`  Day ${wh.dayOfWeek}:`, wh.slots?.length || 0, 'time slots');
          }
        });
      }
    } else {
      console.log('❌ PROBLEM: Working hours array is EMPTY');
      console.log('');
      console.log('🔧 FIX NEEDED:');
      console.log('   You need to configure working hours for this appointment.');
      console.log('   Run: node scripts/create-default-schedule.js');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await mongoose.connection.close();
  }
};

showSchedule();
