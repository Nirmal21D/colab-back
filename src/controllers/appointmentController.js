import Appointment from '../models/Appointment.js';
import Schedule from '../models/Schedule.js';
import Staff from '../models/Staff.js';
import Resource from '../models/Resource.js';
import { asyncHandler, sendSuccess, sendError, generateSlug } from '../utils/helpers.js';
import { getAvailableSlots } from '../utils/slotGenerator.js';
import * as bookingService from '../services/bookingService.js';
import crypto from 'crypto';

/**
 * @desc    Create new appointment
 * @route   POST /api/appointments
 * @access  Private (Organizer)
 */
export const createAppointment = asyncHandler(async (req, res) => {
  
  console.log('Received appointment data:', JSON.stringify(req.body, null, 2));
  
  const {
    title,
    description,
    duration,
    capacity,
    assignmentType,
    assignedStaff,
    assignedResources,
    customerCanChoose,
    simultaneousBookings,
    simultaneousCount,
    location,
    locationType,
    requiresPayment,
    price,
    requiresManualConfirmation,
    manualConfirmationCapacity,
    bookingFees,
    createSlotTime,
    cancellationHours,
    introductionMessage,
    confirmationMessage,
    questions,
  } = req.body;

  // Generate unique slug
  const slug = generateSlug(title);

  try {
    // Validate assigned staff exist (if assignmentType is 'staff')
    if (assignmentType === 'staff' && assignedStaff && assignedStaff.length > 0) {
      const staffCount = await Staff.countDocuments({
        _id: { $in: assignedStaff },
        organizer: req.user._id,
        isActive: true
      });
      
      if (staffCount !== assignedStaff.length) {
        return sendError(res, 'One or more assigned staff members not found or inactive', 400);
      }
    }

    // Validate assigned resources exist (if assignmentType is 'resource')
    if (assignmentType === 'resource' && assignedResources && assignedResources.length > 0) {
      const resourceCount = await Resource.countDocuments({
        _id: { $in: assignedResources },
        organizer: req.user._id,
        isActive: true
      });
      
      if (resourceCount !== assignedResources.length) {
        return sendError(res, 'One or more assigned resources not found or inactive', 400);
      }
    }

    const appointment = await Appointment.create({
      organizer: req.user._id,
      title,
      description,
      duration,
      capacity,
      assignmentType,
      assignedStaff,
      assignedResources,
      customerCanChoose,
      simultaneousBookings,
      simultaneousCount,
      slug,
      location,
      locationType,
      requiresPayment,
      price,
      requiresManualConfirmation,
      manualConfirmationCapacity,
      bookingFees,
      createSlotTime,
      cancellationHours,
      introductionMessage,
      confirmationMessage,
      questions,
      isPublished: true,
      isActive: true,
    });

    // Create default schedule
    await Schedule.create({
      appointment: appointment._id,
      workingHours: [
        // Default Monday-Friday 9AM-5PM
        { dayOfWeek: 1, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        { dayOfWeek: 2, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        { dayOfWeek: 3, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        { dayOfWeek: 4, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
        { dayOfWeek: 5, isAvailable: true, slots: [{ startTime: '09:00', endTime: '17:00' }] },
      ],
    });

    sendSuccess(res, { appointment }, 'Appointment created successfully', 201);
  } catch (error) {
    console.error('Appointment creation error:', error);
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(e => e.message);
      return sendError(res, `Validation failed: ${errors.join(', ')}`, 400);
    }
    if (error.code === 11000) {
      // Duplicate key error
      return sendError(res, 'An appointment with this slug already exists', 400);
    }
    return sendError(res, error.message || 'Error creating appointment', 500);
  }
});

/**
 * @desc    Get all published appointments (public)
 * @route   GET /api/appointments/public
 * @access  Public
 */
export const getPublicAppointments = asyncHandler(async (req, res) => {
  const { requiresPayment, locationType } = req.query;

  const filters = {};
  if (requiresPayment !== undefined) {
    filters.requiresPayment = requiresPayment === 'true';
  }
  if (locationType) {
    filters.locationType = locationType;
  }

  try {
    const appointments = await bookingService.getPublishedAppointments(filters);

    sendSuccess(res, { appointments, count: appointments.length });
  } catch (error) {
    console.error('Error fetching public appointments:', error);
    return sendError(res, 'Error fetching appointments', 500);
  }
});

/**
 * @desc    Get all appointments for organizer
 * @route   GET /api/appointments
 * @access  Private (Organizer)
 */
export const getOrganizerAppointments = asyncHandler(async (req, res) => {
  const appointments = await Appointment.find({ organizer: req.user._id })
    .sort({ createdAt: -1 });

  sendSuccess(res, { appointments, count: appointments.length });
});

/**
 * @desc    Get single appointment
 * @route   GET /api/appointments/:id
 * @access  Private
 */
export const getAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('organizer', 'name email organizerProfile');

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  sendSuccess(res, { appointment });
});

/**
 * @desc    Get appointment by slug (public)
 * @route   GET /api/appointments/slug/:slug
 * @access  Public
 */
export const getAppointmentBySlug = asyncHandler(async (req, res) => {
  try {
    const appointment = await bookingService.getAppointmentDetails(req.params.slug);
    sendSuccess(res, { appointment });
  } catch (error) {
    return sendError(res, error.message, 404);
  }
});

/**
 * @desc    Update appointment
 * @route   PUT /api/appointments/:id
 * @access  Private (Organizer)
 */
export const updateAppointment = asyncHandler(async (req, res) => {
  let appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  // Check ownership
  if (appointment.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized to update this appointment', 403);
  }

  appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  sendSuccess(res, { appointment }, 'Appointment updated successfully');
});

/**
 * @desc    Delete appointment
 * @route   DELETE /api/appointments/:id
 * @access  Private (Organizer)
 */
export const deleteAppointment = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  // Check ownership
  if (appointment.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized to delete this appointment', 403);
  }

  await appointment.deleteOne();

  sendSuccess(res, {}, 'Appointment deleted successfully');
});

/**
 * @desc    Toggle appointment publication status
 * @route   PATCH /api/appointments/:id/publish
 * @access  Private (Organizer)
 */
export const togglePublish = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  // Check ownership
  if (appointment.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized', 403);
  }

  appointment.isPublished = !appointment.isPublished;
  await appointment.save();

  sendSuccess(res, { appointment }, `Appointment ${appointment.isPublished ? 'published' : 'unpublished'}`);
});

/**
 * @desc    Get available slots for appointment
 * @route   GET /api/appointments/:id/slots
 * @access  Public
 */
export const getAppointmentSlots = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  if (!appointment.isPublished) {
    return sendError(res, 'Appointment is not available for booking', 403);
  }

  const slots = await getAvailableSlots(appointment, startDate, endDate);

  sendSuccess(res, { slots, count: slots.length });
});

/**
 * @desc    Generate share token for unpublished appointment
 * @route   POST /api/appointments/:id/share-token
 * @access  Private (Organizer)
 */
export const generateShareToken = asyncHandler(async (req, res) => {
  const { expiryDays = 7 } = req.body;

  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  // Check ownership
  if (appointment.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized', 403);
  }

  // Generate token
  const token = crypto.randomBytes(32).toString('hex');
  
  // Set expiry
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + expiryDays);

  appointment.shareToken = token;
  appointment.shareTokenExpiry = expiry;
  appointment.shareTokenEnabled = true;

  await appointment.save();

  sendSuccess(res, { 
    token,
    expiry,
    shareUrl: `${process.env.FRONTEND_URL}/appointment/share/${token}`
  }, 'Share token generated successfully');
});

/**
 * @desc    Get appointment by share token
 * @route   GET /api/appointments/share/:token
 * @access  Public
 */
export const getAppointmentByShareToken = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findOne({
    shareToken: req.params.token,
    shareTokenEnabled: true,
    shareTokenExpiry: { $gt: new Date() },
  }).populate('organizer', 'name email organizerProfile');

  if (!appointment) {
    return sendError(res, 'Invalid or expired share link', 404);
  }

  sendSuccess(res, { appointment });
});

/**
 * @desc    Revoke share token
 * @route   DELETE /api/appointments/:id/share-token
 * @access  Private (Organizer)
 */
export const revokeShareToken = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  // Check ownership
  if (appointment.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized', 403);
  }

  appointment.shareToken = null;
  appointment.shareTokenExpiry = null;
  appointment.shareTokenEnabled = false;

  await appointment.save();

  sendSuccess(res, {}, 'Share token revoked successfully');
});
