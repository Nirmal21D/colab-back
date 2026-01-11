import { 
  startOfDay, 
  endOfDay, 
  addMinutes, 
  format, 
  parse,
  isWithinInterval,
  isBefore,
  isAfter,
  addDays,
  addHours,
  getDay
} from 'date-fns';
import mongoose from 'mongoose';
import Schedule from '../models/Schedule.js';
import Booking from '../models/Booking.js';

/**
 * Generate available time slots for a given date
 * @param {string} appointmentId - Appointment ID
 * @param {Date} date - Target date
 * @param {number} durationHours - Duration in HOURS
 * @param {number} slotIntervalHours - Slot interval in HOURS (defaults to duration)
 */
export const generateTimeSlots = async (appointmentId, date, durationHours, slotIntervalHours = null) => {
  try {
    const schedule = await Schedule.findOne({ appointment: appointmentId });
    
    if (!schedule) {
      return [];
    }

    const targetDate = new Date(date);
    const dayOfWeek = getDay(targetDate);

    // Check for date-specific overrides
    const dateOverride = schedule.dateOverrides.find(override => {
      const overrideDate = new Date(override.date);
      return format(overrideDate, 'yyyy-MM-dd') === format(targetDate, 'yyyy-MM-dd');
    });

    let slotsConfig;
    
    if (dateOverride) {
      if (!dateOverride.isAvailable) {
        return [];
      }
      slotsConfig = dateOverride.slots;
    } else {
      const daySchedule = schedule.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);
      
      if (!daySchedule || !daySchedule.isAvailable) {
        return [];
      }
      slotsConfig = daySchedule.slots;
    }

    // Convert hours to minutes
    const durationMinutes = Math.round(durationHours * 60);
    // If no slot interval specified, use duration (e.g., 1hr appointment = 1hr intervals)
    const intervalMinutes = slotIntervalHours 
      ? Math.round(slotIntervalHours * 60) 
      : durationMinutes;

    // Generate time slots
    const slots = [];
    
    for (const slotConfig of slotsConfig) {
      const startTime = parse(slotConfig.startTime, 'HH:mm', targetDate);
      const endTime = parse(slotConfig.endTime, 'HH:mm', targetDate);

      let currentSlot = startTime;
      
      while (isBefore(currentSlot, endTime) || currentSlot.getTime() === endTime.getTime()) {
        const slotEnd = addMinutes(currentSlot, durationMinutes);
        
        // Don't create slot if it would exceed working hours
        if (isAfter(slotEnd, endTime)) {
          break;
        }

        slots.push({
          startTime: currentSlot,
          endTime: slotEnd,
          formatted: format(currentSlot, 'HH:mm'),
        });

        // Move to next slot by interval (not duration)
        currentSlot = addMinutes(currentSlot, intervalMinutes);
      }
    }

    return slots;
  } catch (error) {
    console.error('Error generating time slots:', error);
    throw error;
  }
};

/**
 * Check slot availability and capacity
 * Returns remaining capacity count (0 means fully booked)
 */
export const checkSlotAvailability = async (appointmentId, startTime, endTime, capacity, providerId = null) => {
  try {
    // Use aggregation to sum capacity field (not count documents)
    // This correctly handles group bookings
    const existingBookingsCount = await Booking.aggregate([
      {
        $match: {
          appointment: new mongoose.Types.ObjectId(appointmentId),
          startTime: new Date(startTime),
          status: { $in: ['pending', 'confirmed'] },
          ...(providerId && { 'assignedTo.userId': new mongoose.Types.ObjectId(providerId) })
        }
      },
      {
        $group: {
          _id: null,
          totalCapacity: { $sum: '$capacity' }  // Sum all booked capacities
        }
      }
    ]);

    const bookedCapacity = existingBookingsCount[0]?.totalCapacity || 0;
    const remainingCapacity = capacity - bookedCapacity;
    
    return remainingCapacity; // Return remaining capacity (0 = fully booked)
  } catch (error) {
    console.error('Error checking slot availability:', error);
    throw error;
  }
};

/**
 * Validate booking time constraints
 */
export const validateBookingTime = (appointment, requestedTime) => {
  const now = new Date();
  const bookingTime = new Date(requestedTime);

  // Check minimum notice period
  const minNoticeTime = addHours(now, appointment.minNoticeHours);
  if (isBefore(bookingTime, minNoticeTime)) {
    return {
      valid: false,
      message: `Minimum ${appointment.minNoticeHours} hours notice required`,
    };
  }

  // Check advance booking limit
  const maxAdvanceTime = addDays(now, appointment.advanceBookingDays);
  if (isAfter(bookingTime, maxAdvanceTime)) {
    return {
      valid: false,
      message: `Cannot book more than ${appointment.advanceBookingDays} days in advance`,
    };
  }

  return { valid: true };
};

/**
 * Get available slots for a date range
 */
export const getAvailableSlots = async (appointment, startDate, endDate) => {
  try {
    const availableSlots = [];
    let currentDate = new Date(startDate);
    const end = new Date(endDate);

    while (isBefore(currentDate, end) || currentDate.getTime() === end.getTime()) {
      const slots = await generateTimeSlots(
        appointment._id, 
        currentDate, 
        appointment.duration,
        appointment.slotInterval // Pass slot interval if available
      );
      
      for (const slot of slots) {
        const isAvailable = await checkSlotAvailability(
          appointment._id,
          slot.startTime,
          slot.endTime,
          appointment.capacity
        );

        if (isAvailable) {
          availableSlots.push({
            date: format(currentDate, 'yyyy-MM-dd'),
            time: slot.formatted,
            startTime: slot.startTime,
            endTime: slot.endTime,
          });
        }
      }

      currentDate = addDays(currentDate, 1);
    }

    return availableSlots;
  } catch (error) {
    console.error('Error getting available slots:', error);
    throw error;
  }
};
