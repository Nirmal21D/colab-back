/**
 * Diagnostic script to check appointment data integrity
 * Run this to verify your appointment and referenced data
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Appointment from '../src/models/Appointment.js';
import Staff from '../src/models/Staff.js';
import Resource from '../src/models/Resource.js';
import Schedule from '../src/models/Schedule.js';

dotenv.config();

const checkAppointmentIntegrity = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get your specific appointment
    const appointmentId = '6946ef016c9d53ca194e5645';
    console.log(`🔍 Checking appointment: ${appointmentId}\n`);

    const appointment = await Appointment.findById(appointmentId);
    
    if (!appointment) {
      console.log('❌ Appointment not found!');
      process.exit(1);
    }

    console.log('✅ Appointment exists');
    console.log('   Title:', appointment.title);
    console.log('   Assignment Type:', appointment.assignmentType);
    console.log('   Is Published:', appointment.isPublished);
    console.log('   Is Active:', appointment.isActive);
    console.log('   Assigned Staff IDs:', appointment.assignedStaff);
    console.log('   Assigned Resources IDs:', appointment.assignedResources);
    console.log('');

    // Check assigned staff
    if (appointment.assignedStaff && appointment.assignedStaff.length > 0) {
      console.log('📋 Checking assigned staff...');
      
      for (const staffId of appointment.assignedStaff) {
        const staff = await Staff.findById(staffId);
        
        if (!staff) {
          console.log(`   ❌ Staff not found: ${staffId}`);
          console.log('   ⚠️  THIS IS THE PROBLEM! Remove this ID or create the staff member.');
        } else {
          console.log(`   ✅ Staff found: ${staff.name} (${staffId})`);
          console.log(`      Email: ${staff.email}`);
          console.log(`      Active: ${staff.isActive}`);
        }
      }
      console.log('');
    }

    // Check assigned resources
    if (appointment.assignedResources && appointment.assignedResources.length > 0) {
      console.log('📋 Checking assigned resources...');
      
      for (const resourceId of appointment.assignedResources) {
        const resource = await Resource.findById(resourceId);
        
        if (!resource) {
          console.log(`   ❌ Resource not found: ${resourceId}`);
          console.log('   ⚠️  THIS IS THE PROBLEM! Remove this ID or create the resource.');
        } else {
          console.log(`   ✅ Resource found: ${resource.name} (${resourceId})`);
          console.log(`      Type: ${resource.type}`);
          console.log(`      Active: ${resource.isActive}`);
        }
      }
      console.log('');
    }

    // Check schedule
    const schedule = await Schedule.findOne({ appointment: appointmentId });
    
    if (!schedule) {
      console.log('❌ No schedule found for this appointment!');
      console.log('   ⚠️  Create a schedule with working hours.\n');
    } else {
      console.log('✅ Schedule exists');
      console.log(`   Working hours configured: ${schedule.workingHours.length} days`);
      console.log('');
    }

    // Test populate
    console.log('🧪 Testing populate (simulating API call)...\n');
    
    const populatedAppointment = await Appointment.findById(appointmentId)
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

    console.log('Populated result:');
    console.log('   Assigned Staff:', populatedAppointment.assignedStaff);
    console.log('   Assigned Resources:', populatedAppointment.assignedResources);
    console.log('');

    // Filter nulls
    const filteredStaff = populatedAppointment.assignedStaff ? 
      populatedAppointment.assignedStaff.filter(s => s !== null) : [];
    const filteredResources = populatedAppointment.assignedResources ?
      populatedAppointment.assignedResources.filter(r => r !== null) : [];

    console.log('After filtering nulls:');
    console.log('   Assigned Staff:', filteredStaff);
    console.log('   Assigned Resources:', filteredResources);
    console.log('');

    // Summary
    console.log('📊 SUMMARY:');
    
    const issues = [];
    
    if (appointment.assignedStaff && appointment.assignedStaff.length > 0) {
      for (const staffId of appointment.assignedStaff) {
        const staff = await Staff.findById(staffId);
        if (!staff) {
          issues.push(`Missing staff: ${staffId}`);
        }
      }
    }
    
    if (appointment.assignedResources && appointment.assignedResources.length > 0) {
      for (const resourceId of appointment.assignedResources) {
        const resource = await Resource.findById(resourceId);
        if (!resource) {
          issues.push(`Missing resource: ${resourceId}`);
        }
      }
    }
    
    if (!schedule) {
      issues.push('Missing schedule');
    }

    if (issues.length === 0) {
      console.log('   ✅ No issues found! Appointment should work correctly.');
    } else {
      console.log('   ⚠️  Issues found:');
      issues.forEach(issue => console.log(`      - ${issue}`));
      console.log('\n   FIX OPTIONS:');
      console.log('   1. Remove invalid staff/resource IDs from appointment');
      console.log('   2. Create the missing staff/resource documents');
      console.log('   3. Change assignmentType to "auto" if not using staff/resources');
    }

    console.log('');
    console.log('✅ Diagnostic complete!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await mongoose.connection.close();
    console.log('\n🔌 Disconnected from MongoDB');
  }
};

checkAppointmentIntegrity();
