/**
 * Test slot generation with proper hour intervals
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { generateTimeSlots } from '../src/utils/slotGenerator.js';
import Appointment from '../src/models/Appointment.js';

dotenv.config();

const testSlots = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Find any published appointment
    const appointment = await Appointment.findOne({ 
      isPublished: true,
      isActive: true 
    }).lean();

    if (!appointment) {
      console.log('❌ No published appointments found. Create one first.');
      process.exit(1);
    }

    console.log(`📋 Testing appointment: "${appointment.title}"`);
    console.log(`   Duration: ${appointment.duration} hour(s)`);
    console.log(`   Slot Interval: ${appointment.slotInterval || 'Not set (will use duration)'}`);
    console.log('');

    // Test for tomorrow (Thursday, Dec 25, 2025)
    const testDate = new Date('2025-12-25');
    
    console.log(`🕐 Generating slots for: ${testDate.toDateString()}\n`);

    const slots = await generateTimeSlots(
      appointment._id,
      testDate,
      appointment.duration,
      appointment.slotInterval
    );

    console.log(`✅ Generated ${slots.length} slots:\n`);

    if (slots.length > 0) {
      // Show first 10 slots
      const displaySlots = slots.slice(0, Math.min(10, slots.length));
      displaySlots.forEach((slot, i) => {
        console.log(`   ${i + 1}. ${slot.formatted} (Duration: ${appointment.duration}hr)`);
      });

      if (slots.length > 10) {
        console.log(`   ... and ${slots.length - 10} more`);
      }

      console.log('');
      console.log('📊 Slot Analysis:');
      console.log(`   First slot: ${slots[0].formatted}`);
      console.log(`   Last slot: ${slots[slots.length - 1].formatted}`);
      
      // Calculate interval between first two slots
      if (slots.length > 1) {
        const firstSlotTime = slots[0].startTime;
        const secondSlotTime = slots[1].startTime;
        const intervalMinutes = (secondSlotTime - firstSlotTime) / (1000 * 60);
        const intervalHours = intervalMinutes / 60;
        
        console.log(`   Interval between slots: ${intervalHours} hour(s) / ${intervalMinutes} minutes`);
        
        if (intervalMinutes === 1) {
          console.log('');
          console.log('⚠️  WARNING: Slots are 1 minute apart!');
          console.log('   This will create too many options.');
          console.log('');
          console.log('💡 RECOMMENDATION: Set slotInterval to match duration');
          console.log(`   For ${appointment.duration}hr appointments, use ${appointment.duration}hr intervals`);
        } else if (intervalHours === appointment.duration) {
          console.log('   ✅ Perfect! Slot interval matches duration.');
        }
      }
    } else {
      console.log('❌ No slots generated. Possible reasons:');
      console.log('   - No schedule configured for this day');
      console.log('   - Day is marked as unavailable');
      console.log('   - Date is in the past');
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

testSlots();
