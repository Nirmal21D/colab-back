/**
 * Fix script to clean up appointment with invalid references
 * This will remove any staff/resource IDs that don't exist
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Appointment from '../src/models/Appointment.js';
import Staff from '../src/models/Staff.js';
import Resource from '../src/models/Resource.js';
import Schedule from '../src/models/Schedule.js';

dotenv.config();

const fixAppointment = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    const appointmentId = '6946ef016c9d53ca194e5645';
    console.log(`🔧 Fixing appointment: ${appointmentId}\n`);

    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      console.log('❌ Appointment not found!');
      process.exit(1);
    }

    console.log('📋 Original appointment:');
    console.log('   Assigned Staff:', appointment.assignedStaff);
    console.log('   Assigned Resources:', appointment.assignedResources);
    console.log('');

    let modified = false;

    // Clean up assigned staff
    if (appointment.assignedStaff && appointment.assignedStaff.length > 0) {
      console.log('🧹 Cleaning assigned staff...');
      const validStaff = [];
      
      for (const staffId of appointment.assignedStaff) {
        const staff = await Staff.findById(staffId);
        if (staff) {
          console.log(`   ✅ Keeping valid staff: ${staff.name}`);
          validStaff.push(staffId);
        } else {
          console.log(`   ❌ Removing invalid staff ID: ${staffId}`);
          modified = true;
        }
      }
      
      appointment.assignedStaff = validStaff;
      console.log('');
    }

    // Clean up assigned resources
    if (appointment.assignedResources && appointment.assignedResources.length > 0) {
      console.log('🧹 Cleaning assigned resources...');
      const validResources = [];
      
      for (const resourceId of appointment.assignedResources) {
        const resource = await Resource.findById(resourceId);
        if (resource) {
          console.log(`   ✅ Keeping valid resource: ${resource.name}`);
          validResources.push(resourceId);
        } else {
          console.log(`   ❌ Removing invalid resource ID: ${resourceId}`);
          modified = true;
        }
      }
      
      appointment.assignedResources = validResources;
      console.log('');
    }

    // If no staff/resources left, switch to auto assignment
    if (appointment.assignmentType === 'staff' && 
        (!appointment.assignedStaff || appointment.assignedStaff.length === 0)) {
      console.log('⚠️  No staff remaining, switching to auto assignment');
      appointment.assignmentType = 'auto';
      modified = true;
    }

    if (appointment.assignmentType === 'resource' && 
        (!appointment.assignedResources || appointment.assignedResources.length === 0)) {
      console.log('⚠️  No resources remaining, switching to auto assignment');
      appointment.assignmentType = 'auto';
      modified = true;
    }

    // Check schedule exists
    const schedule = await Schedule.findOne({ appointment: appointmentId });
    if (!schedule) {
      console.log('📅 Creating default schedule...');
      await Schedule.create({
        appointment: appointmentId,
        workingHours: [
          { dayOfWeek: 1, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 2, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 3, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 4, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
          { dayOfWeek: 5, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        ],
      });
      console.log('   ✅ Schedule created\n');
    }

    if (modified) {
      await appointment.save();
      console.log('✅ Appointment updated successfully!\n');
      
      console.log('📋 Updated appointment:');
      console.log('   Assignment Type:', appointment.assignmentType);
      console.log('   Assigned Staff:', appointment.assignedStaff);
      console.log('   Assigned Resources:', appointment.assignedResources);
    } else {
      console.log('✅ No changes needed - appointment is already clean!\n');
    }

    // Verify by testing API query
    console.log('🧪 Testing API query simulation...\n');
    
    const testResult = await Appointment.findOne({
      _id: appointmentId,
      isPublished: true,
      isActive: true
    })
    .populate({
      path: 'assignedStaff',
      select: 'name email',
      options: { strictPopulate: false }
    })
    .populate({
      path: 'assignedResources',
      select: 'name description',
      options: { strictPopulate: false }
    })
    .lean();

    if (testResult) {
      // Filter nulls
      if (testResult.assignedStaff) {
        testResult.assignedStaff = testResult.assignedStaff.filter(s => s !== null);
      }
      if (testResult.assignedResources) {
        testResult.assignedResources = testResult.assignedResources.filter(r => r !== null);
      }

      console.log('✅ API query successful!');
      console.log('   Title:', testResult.title);
      console.log('   Slug:', testResult.slug);
      console.log('   Staff count:', testResult.assignedStaff?.length || 0);
      console.log('   Resource count:', testResult.assignedResources?.length || 0);
      console.log('');
      console.log('🎉 Appointment should now work correctly in your application!');
    } else {
      console.log('⚠️  Warning: Appointment query returned null');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

fixAppointment();
