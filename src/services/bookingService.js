import mongoose from 'mongoose';
import Booking from '../models/Booking.js';
import Appointment from '../models/Appointment.js';
import Schedule from '../models/Schedule.js';
import sanitizeHtml from 'sanitize-html';
import { 
  generateTimeSlots, 
  checkSlotAvailability, 
  validateBookingTime 
} from '../utils/slotGenerator.js';
import { format, addDays, isBefore, isAfter, startOfDay, endOfDay } from 'date-fns';

/**
 * Production-Ready Booking Service
 * Following the complete end-to-end customer booking flow specification
 * 
 * Key Features:
 * - Atomic operations with MongoDB transactions
 * - Concurrency-safe slot booking
 * - Comprehensive validation
 * - Performance optimization
 * - Detailed error handling
 */

// ==================== STAGE 1: APPOINTMENT DISCOVERY ====================

/**
 * Get lightweight list of published appointments
 * Optimized for fast initial load
 */
export const getPublishedAppointments = async (filters = {}) => {
  const query = {
    isPublished: true,
    isActive: true,
  };

  // Optional filters
  if (filters.requiresPayment !== undefined) {
    query.requiresPayment = filters.requiresPayment;
  }

  if (filters.locationType) {
    query.locationType = filters.locationType;
  }

  // Return only essential metadata
  const appointments = await Appointment.find(query)
    .select('title description duration location locationType requiresPayment price paymentMode slug organizer assignmentType assignedStaff assignedResources image introductionMessage isPublished isActive')
    .populate({
      path: 'organizer',
      select: 'name organizerProfile',
      options: { strictPopulate: false } // Don't fail if organizer deleted
    })
    .populate({
      path: 'assignedStaff',
      select: 'name email',
      options: { strictPopulate: false } // Don't fail if staff deleted
    })
    .populate({
      path: 'assignedResources',
      select: 'name description',
      options: { strictPopulate: false } // Don't fail if resource deleted
    })
    .sort({ createdAt: -1 })
    .lean(); // Use lean for better performance

  // Filter out null values from populated arrays (happens when referenced docs are deleted)
  appointments.forEach(appointment => {
    if (appointment.assignedStaff) {
      appointment.assignedStaff = appointment.assignedStaff.filter(staff => staff !== null);
    }
    if (appointment.assignedResources) {
      appointment.assignedResources = appointment.assignedResources.filter(resource => resource !== null);
    }
  });

  return appointments;
};

// ==================== STAGE 2: APPOINTMENT DETAILS ====================

/**
 * Get full appointment configuration for booking
 * Includes all rules, questions, and settings
 */
export const getAppointmentDetails = async (slugOrId) => {
  // Try to find by slug first, then by ID
  let appointment;
  
  if (mongoose.Types.ObjectId.isValid(slugOrId)) {
    appointment = await Appointment.findOne({
      _id: slugOrId,
      isPublished: true,
      isActive: true,
    })
    .populate({
      path: 'organizer',
      select: 'name email organizerProfile',
      options: { strictPopulate: false }
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
  } else {
    appointment = await Appointment.findOne({
      slug: slugOrId,
      isPublished: true,
      isActive: true,
    })
    .populate({
      path: 'organizer',
      select: 'name email organizerProfile',
      options: { strictPopulate: false }
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
  }

  if (!appointment) {
    throw new Error('Appointment not found or not available');
  }

  // Filter out null values from populated arrays
  if (appointment.assignedStaff) {
    appointment.assignedStaff = appointment.assignedStaff.filter(staff => staff !== null);
  }
  if (appointment.assignedResources) {
    appointment.assignedResources = appointment.assignedResources.filter(resource => resource !== null);
  }

  return appointment;
};

// ==================== STAGE 3: AVAILABILITY DATES ====================

/**
 * Get available dates within a date range
 * Returns only dates that have available slots
 * Optimized for caching
 */
export const getAvailableDates = async (appointmentId, startDate, endDate) => {
  const appointment = await Appointment.findById(appointmentId).select('duration capacity minNoticeHours advanceBookingDays').lean();
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  const schedule = await Schedule.findOne({ appointment: appointmentId }).lean();
  
  if (!schedule) {
    return [];
  }

  const availableDates = [];
  let currentDate = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  // Apply booking constraints
  const minBookingTime = new Date(now.getTime() + appointment.minNoticeHours * 60 * 60 * 1000);
  const maxBookingTime = addDays(now, appointment.advanceBookingDays);

  while (isBefore(currentDate, end) || currentDate.getTime() === end.getTime()) {
    // Skip if outside booking window
    if (isBefore(currentDate, startOfDay(minBookingTime)) || isAfter(currentDate, endOfDay(maxBookingTime))) {
      currentDate = addDays(currentDate, 1);
      continue;
    }

    const hasSlots = await hasAvailableSlots(appointmentId, currentDate, appointment.duration, appointment.capacity, schedule);
    
    if (hasSlots) {
      availableDates.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        dayOfWeek: currentDate.getDay(),
      });
    }

    currentDate = addDays(currentDate, 1);
  }

  return availableDates;
};

/**
 * Check if a specific date has any available slots
 * Helper function for date availability
 */
const hasAvailableSlots = async (appointmentId, date, duration, capacity, schedule) => {
  const dayOfWeek = date.getDay();
  
  // Check date overrides first
  const dateOverride = schedule.dateOverrides.find(override => {
    const overrideDate = new Date(override.date);
    return format(overrideDate, 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd');
  });

  if (dateOverride) {
    return dateOverride.isAvailable && dateOverride.slots && dateOverride.slots.length > 0;
  }

  // Check regular working hours
  const daySchedule = schedule.workingHours.find(wh => wh.dayOfWeek === dayOfWeek);
  
  if (!daySchedule || !daySchedule.isAvailable || !daySchedule.slots || daySchedule.slots.length === 0) {
    return false;
  }

  // Quick check: if there are working hours, assume availability
  // Actual slot checking happens in the next stage
  return true;
};

// ==================== STAGE 4: TIME SLOT FETCH ====================

/**
 * Get available time slots for a specific date
 * Returns only slots with remaining capacity
 * Optimized payload size
 */
export const getAvailableTimeSlots = async (appointmentId, date, providerId = null) => {
  const appointment = await Appointment.findById(appointmentId)
    .select('duration slotInterval capacity minNoticeHours assignmentType customerCanChoose')
    .lean();
  
  if (!appointment) {
    throw new Error('Appointment not found');
  }

  // Generate all possible slots for the date
  const allSlots = await generateTimeSlots(
    appointmentId, 
    date, 
    appointment.duration,
    appointment.slotInterval // Pass slot interval if configured
  );
  
  // Filter out slots that are in the past or within minimum notice period
  const now = new Date();
  const minBookingTime = new Date(now.getTime() + appointment.minNoticeHours * 60 * 60 * 1000);

  const availableSlots = [];

  for (const slot of allSlots) {
    // Skip past slots
    if (isBefore(slot.startTime, minBookingTime)) {
      continue;
    }

    // Check capacity - now returns remaining capacity count
    const remainingCapacity = await checkSlotAvailability(
      appointmentId,
      slot.startTime,
      slot.endTime,
      appointment.capacity,
      providerId
    );

    if (remainingCapacity > 0) {
      availableSlots.push({
        startTime: slot.startTime.toISOString(),
        endTime: slot.endTime.toISOString(),
        formatted: slot.formatted,
        available: true,
        remainingCapacity,  // Include remaining capacity for capacity selection
      });
    }
  }

  return availableSlots;
};

// ==================== STAGE 5: SLOT SELECTION & VALIDATION ====================

/**
 * Validate slot selection before booking
 * Pre-confirmation validation
 */
export const validateSlotSelection = async (appointmentId, startTime, endTime, providerId = null) => {
  const appointment = await Appointment.findById(appointmentId)
    .select('isPublished isActive capacity minNoticeHours advanceBookingDays assignmentType')
    .lean();

  if (!appointment) {
    return { valid: false, error: 'Appointment not found' };
  }

  if (!appointment.isPublished || !appointment.isActive) {
    return { valid: false, error: 'Appointment is not available for booking' };
  }

  // Validate booking time constraints
  const timeValidation = validateBookingTime(appointment, startTime);
  if (!timeValidation.valid) {
    return { valid: false, error: timeValidation.message };
  }

  // Check if slot still has capacity
  const remainingCapacity = await checkSlotAvailability(
    appointmentId,
    new Date(startTime),
    new Date(endTime),
    appointment.capacity,
    providerId
  );

  if (remainingCapacity <= 0) {
    return { valid: false, error: 'Selected time slot is no longer available' };
  }

  return { valid: true };
};

// ==================== STAGE 6: CUSTOMER INPUT VALIDATION ====================

/**
 * Sanitize user input to prevent XSS attacks
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  return sanitizeHtml(input, {
    allowedTags: [],  // Strip all HTML tags
    allowedAttributes: {},  // Strip all attributes
  }).trim();
};

/**
 * Validate customer inputs and question answers
 * Sanitize all inputs before booking
 */
export const validateBookingInputs = (appointment, questionAnswers, customerInfo) => {
  const errors = [];

  // Sanitize all inputs first
  if (questionAnswers && questionAnswers.length > 0) {
    questionAnswers.forEach(qa => {
      if (qa.question) qa.question = sanitizeInput(qa.question);
      if (qa.answer) qa.answer = sanitizeInput(qa.answer);
    });
  }

  if (customerInfo) {
    if (customerInfo.name) customerInfo.name = sanitizeInput(customerInfo.name);
    if (customerInfo.notes) customerInfo.notes = sanitizeInput(customerInfo.notes);
  }

  // Validate required questions
  if (appointment.questions && appointment.questions.length > 0) {
    const requiredQuestions = appointment.questions.filter(q => q.required);
    
    for (const required of requiredQuestions) {
      const answered = (questionAnswers || []).find(a => a.question === required.question);
      
      if (!answered || !answered.answer || answered.answer.trim() === '') {
        errors.push(`Question "${required.question}" is required`);
      } else {
        // Validate answer format based on question type
        const validation = validateAnswerFormat(required, answered.answer);
        if (!validation.valid) {
          errors.push(validation.error);
        }
      }
    }
  }

  // Validate customer info if provided
  if (customerInfo) {
    if (customerInfo.email && !isValidEmail(customerInfo.email)) {
      errors.push('Invalid email format');
    }
    if (customerInfo.phone && !isValidPhone(customerInfo.phone)) {
      errors.push('Invalid phone format');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Validate answer format based on question type
 */
const validateAnswerFormat = (question, answer) => {
  switch (question.type) {
    case 'email':
      if (!isValidEmail(answer)) {
        return { valid: false, error: `"${question.question}" must be a valid email` };
      }
      break;
    case 'phone':
      if (!isValidPhone(answer)) {
        return { valid: false, error: `"${question.question}" must be a valid phone number` };
      }
      break;
    case 'number':
      if (isNaN(answer)) {
        return { valid: false, error: `"${question.question}" must be a number` };
      }
      break;
    case 'select':
      if (question.options && !question.options.includes(answer)) {
        return { valid: false, error: `"${answer}" is not a valid option for "${question.question}"` };
      }
      break;
  }

  return { valid: true };
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidPhone = (phone) => {
  const phoneRegex = /^[\d\s\-\+\(\)]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

// ==================== STAGE 7: BOOKING CONFIRMATION (ATOMIC) ====================

/**
 * Create booking with atomic transaction
 * HIGH CONCURRENCY SAFE - IRCTC-style implementation
 * 
 * CRITICAL RULES:
 * 1. Server is single source of truth
 * 2. Slot selection is NOT booking
 * 3. Booking must be ATOMIC
 * 4. Prevent double booking under parallel requests
 * 5. Use temporary reservation for payment flows
 * 6. Handle retry and duplicate requests safely (idempotent)
 * 7. Minimize lock scope
 * 8. Optimize for performance
 * 9. Clean failure handling with rollback
 * 10. Clear success/failure outcomes
 */
export const createBookingAtomic = async (customerId, bookingData) => {
  const session = await mongoose.startSession();
  session.startTransaction({
    readConcern: { level: 'snapshot' },
    writeConcern: { w: 'majority' },
    maxCommitTimeMS: 5000, // 5 second timeout for commit
  });

  try {
    const {
      appointmentId,
      startTime,
      endTime,
      providerId,
      questionAnswers,
      customerInfo,
      capacity = 1,
      idempotencyKey, // For handling retries
    } = bookingData;

    // IDEMPOTENCY CHECK: Prevent duplicate bookings from retries
    if (idempotencyKey) {
      const existingBooking = await Booking.findOne({
        customer: customerId,
        appointment: appointmentId,
        'metadata.idempotencyKey': idempotencyKey,
      }).session(session);

      if (existingBooking) {
        await session.commitTransaction();
        return {
          success: true,
          booking: existingBooking,
          confirmationCode: existingBooking.confirmationCode,
          message: 'Booking already exists (idempotent)',
          isDuplicate: true,
        };
      }
    }

    // PHASE 1: LOCK AND FETCH APPOINTMENT
    // Use findOneAndUpdate for pessimistic locking
    const appointment = await Appointment.findOneAndUpdate(
      { 
        _id: appointmentId,
        isPublished: true,
        isActive: true,
      },
      { $inc: { lockVersion: 1 } }, // Optimistic lock version
      { 
        session,
        new: false, // Return original document
      }
    );
    
    if (!appointment) {
      throw new Error('Appointment not found or not available for booking');
    }

    // PHASE 2: VALIDATE BOOKING TIME
    const startTimeDate = new Date(startTime);
    const endTimeDate = new Date(endTime);
    const now = new Date();

    // Check minimum notice hours
    const minNoticeMs = (appointment.minNoticeHours || 0) * 60 * 60 * 1000;
    if (startTimeDate.getTime() - now.getTime() < minNoticeMs) {
      throw new Error(`Booking requires at least ${appointment.minNoticeHours} hours advance notice`);
    }

    // Check maximum advance booking days
    const maxAdvanceMs = (appointment.advanceBookingDays || 30) * 24 * 60 * 60 * 1000;
    if (startTimeDate.getTime() - now.getTime() > maxAdvanceMs) {
      throw new Error(`Booking cannot be made more than ${appointment.advanceBookingDays} days in advance`);
    }

    // PHASE 3: CRITICAL - CHECK SLOT AVAILABILITY WITH LOCK
    // This is the MOST IMPORTANT part for concurrency safety
    const requestedCapacity = parseInt(capacity) || 1;
    
    // Count existing bookings for this exact time slot
    const existingBookingsCount = await Booking.aggregate([
      {
        $match: {
          appointment: new mongoose.Types.ObjectId(appointmentId),
          startTime: startTimeDate,
          status: { $in: ['pending', 'confirmed'] },
          ...(providerId && { 'assignedTo.userId': new mongoose.Types.ObjectId(providerId) }),
        }
      },
      {
        $group: {
          _id: null,
          totalCapacity: { $sum: '$capacity' }
        }
      }
    ]).session(session);

    const currentlyBooked = existingBookingsCount[0]?.totalCapacity || 0;
    const availableCapacity = (appointment.capacity || 1) - currentlyBooked;

    // FAIL FAST: If no capacity available
    if (availableCapacity < requestedCapacity) {
      throw new Error(`Slot no longer available. Only ${availableCapacity} spots remaining, but ${requestedCapacity} requested`);
    }

    // PHASE 4: VALIDATE PROVIDER/RESOURCE ASSIGNMENT
    if (appointment.assignmentType === 'staff' && providerId) {
      const isValidProvider = appointment.assignedStaff?.some(
        staff => staff.toString() === providerId.toString()
      );
      if (!isValidProvider) {
        throw new Error('Invalid provider selected');
      }
    } else if (appointment.assignmentType === 'resource' && providerId) {
      const isValidResource = appointment.assignedResources?.some(
        resource => resource.toString() === providerId.toString()
      );
      if (!isValidResource) {
        throw new Error('Invalid resource selected');
      }
    }

    // PHASE 5: VALIDATE QUESTION ANSWERS
    const inputValidation = validateBookingInputs(appointment, questionAnswers, customerInfo);
    if (!inputValidation.valid) {
      throw new Error(`Validation errors: ${inputValidation.errors.join(', ')}`);
    }

    // PHASE 6: DETERMINE BOOKING STATUS AND GENERATE CODE
    const initialStatus = appointment.requiresManualConfirmation ? 'pending' : 'confirmed';
    const confirmationCode = generateConfirmationCode();

    // PHASE 7: CREATE BOOKING ATOMICALLY
    const bookingDoc = {
      appointment: appointmentId,
      customer: customerId,
      organizer: appointment.organizer,
      startTime: startTimeDate,
      endTime: endTimeDate,
      date: startTimeDate,
      capacity: requestedCapacity,
      assignedTo: providerId ? { 
        userId: providerId,
        type: appointment.assignmentType === 'staff' ? 'staff' : 'resource'
      } : null,
      customerInfo,
      questionAnswers: questionAnswers || [],
      confirmationCode,
      status: initialStatus,
      paymentStatus: appointment.requiresPayment ? 'pending' : 'paid',
      paymentAmount: appointment.price || 0,
      metadata: {
        ...(idempotencyKey && { idempotencyKey }),
        bookedAt: new Date(),
        ipAddress: bookingData.ipAddress,
        userAgent: bookingData.userAgent,
      },
      // TEMPORARY RESERVATION for payment flows
      ...(appointment.requiresPayment && {
        reservationExpiry: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
      }),
    };

    const booking = await Booking.create([bookingDoc], { session });

    // PHASE 8: UPDATE APPOINTMENT STATISTICS
    await Appointment.updateOne(
      { _id: appointmentId },
      { $inc: { totalBookings: 1 } },
      { session }
    );

    // COMMIT TRANSACTION - All or nothing
    await session.commitTransaction();

    // Populate booking details for response
    const populatedBooking = await Booking.findById(booking[0]._id)
      .populate('appointment', 'title duration location locationType')
      .populate('organizer', 'name email organizerProfile')
      .lean();

    return {
      success: true,
      booking: populatedBooking,
      confirmationCode,
      message: 'Booking confirmed successfully',
      paymentRequired: appointment.requiresPayment,
      reservationExpiry: bookingDoc.reservationExpiry,
    };

  } catch (error) {
    // ROLLBACK on any error
    await session.abortTransaction();
    
    // Parse error for user-friendly messages
    let userMessage = error.message;
    
    if (error.message.includes('no longer available')) {
      userMessage = 'This time slot was just booked by another user. Please select a different time.';
    } else if (error.message.includes('Validation errors')) {
      userMessage = error.message;
    } else if (error.message.includes('advance notice')) {
      userMessage = error.message;
    } else if (error.message.includes('not available for booking')) {
      userMessage = 'This appointment is no longer available. Please try a different service.';
    }
    
    throw new Error(userMessage);
  } finally {
    session.endSession();
  }
};

/**
 * Generate unique confirmation code
 */
const generateConfirmationCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// ==================== STAGE 8: POST-BOOKING OPERATIONS ====================

/**
 * Get customer bookings categorized by status
 */
export const getCustomerBookings = async (customerId, filters = {}) => {
  const query = { customer: customerId };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.upcoming) {
    query.startTime = { $gte: new Date() };
    query.status = { $in: ['pending', 'confirmed'] };
  }

  const bookings = await Booking.find(query)
    .populate('appointment', 'title duration location locationType')
    .populate('organizer', 'name organizerProfile')
    .sort({ startTime: filters.upcoming ? 1 : -1 })
    .lean();

  return {
    bookings,
    count: bookings.length,
  };
};

/**
 * Get organizer bookings with filters
 */
export const getOrganizerBookings = async (organizerId, filters = {}) => {
  const query = { organizer: organizerId };

  if (filters.status) {
    query.status = filters.status;
  }

  if (filters.appointmentId) {
    query.appointment = filters.appointmentId;
  }

  if (filters.startDate && filters.endDate) {
    query.date = {
      $gte: new Date(filters.startDate),
      $lte: new Date(filters.endDate),
    };
  }

  const bookings = await Booking.find(query)
    .populate('appointment', 'title duration')
    .populate('customer', 'name email phone')
    .sort({ date: -1 })
    .lean();

  return {
    bookings,
    count: bookings.length,
  };
};

/**
 * Cancel booking with policy validation
 */
export const cancelBookingService = async (bookingId, userId, cancellationReason) => {
  const booking = await Booking.findById(bookingId).populate('appointment');

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Check authorization
  if (
    booking.customer.toString() !== userId.toString() &&
    booking.organizer.toString() !== userId.toString()
  ) {
    throw new Error('Not authorized to cancel this booking');
  }

  // Check if already cancelled
  if (booking.status === 'cancelled') {
    throw new Error('Booking is already cancelled');
  }

  // Check cancellation policy
  if (booking.appointment.allowCancellation) {
    const now = new Date();
    const bookingTime = new Date(booking.startTime);
    const hoursDiff = (bookingTime - now) / (1000 * 60 * 60);

    if (hoursDiff < booking.appointment.cancellationHours) {
      throw new Error(
        `Cancellation must be made at least ${booking.appointment.cancellationHours} hours in advance`
      );
    }
  } else {
    throw new Error('Cancellation is not allowed for this appointment');
  }

  // Update booking status
  booking.status = 'cancelled';
  booking.cancellationReason = cancellationReason;
  booking.cancelledAt = new Date();
  booking.cancelledBy = userId;

  await booking.save();

  return booking;
};

/**
 * Update booking status (organizer only)
 */
export const updateBookingStatusService = async (bookingId, organizerId, newStatus) => {
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    throw new Error('Booking not found');
  }

  if (booking.organizer.toString() !== organizerId.toString()) {
    throw new Error('Not authorized');
  }

  booking.status = newStatus;
  await booking.save();

  return booking;
};

// ==================== HELPER FUNCTIONS ====================

/**
 * Get booking by confirmation code
 */
export const getBookingByConfirmationCode = async (confirmationCode) => {
  const booking = await Booking.findOne({ confirmationCode })
    .populate('appointment', 'title duration location locationType')
    .populate('organizer', 'name organizerProfile')
    .populate('customer', 'name email phone')
    .lean();

  if (!booking) {
    throw new Error('Booking not found');
  }

  return booking;
};

/**
 * Get single booking with access control
 */
export const getBookingById = async (bookingId, userId, userRole) => {
  const booking = await Booking.findById(bookingId)
    .populate('appointment')
    .populate('customer', 'name email phone')
    .populate('organizer', 'name organizerProfile')
    .lean();

  if (!booking) {
    throw new Error('Booking not found');
  }

  // Check access
  if (
    booking.customer._id.toString() !== userId.toString() &&
    booking.organizer._id.toString() !== userId.toString() &&
    userRole !== 'admin'
  ) {
    throw new Error('Not authorized to view this booking');
  }

  return booking;
};
