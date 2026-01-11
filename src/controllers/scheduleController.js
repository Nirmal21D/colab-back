import Schedule from '../models/Schedule.js';
import Appointment from '../models/Appointment.js';
import { asyncHandler, sendSuccess, sendError } from '../utils/helpers.js';

/**
 * @desc    Get schedule for appointment
 * @route   GET /api/schedules/:appointmentId
 * @access  Private (Organizer)
 */
export const getSchedule = asyncHandler(async (req, res) => {
  const { assignedToModel, assignedToId } = req.query;
  
  const query = { appointment: req.params.appointmentId };
  
  // If requesting a specific user/resource schedule
  if (assignedToModel && assignedToId) {
    query['assignedTo.model'] = assignedToModel;
    query['assignedTo.id'] = assignedToId;
  } else {
    // Default schedule (no assignedTo)
    query.assignedTo = { $exists: false };
  }

  const schedule = await Schedule.findOne(query);

  if (!schedule) {
    return sendError(res, 'Schedule not found', 404);
  }

  sendSuccess(res, { schedule });
});

/**
 * @desc    Update schedule working hours
 * @route   PUT /api/schedules/:appointmentId/working-hours
 * @access  Private (Organizer)
 */
export const updateWorkingHours = asyncHandler(async (req, res) => {
  const { workingHours, assignedTo } = req.body;

  // Verify appointment ownership
  const appointment = await Appointment.findById(req.params.appointmentId);
  
  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  if (appointment.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized', 403);
  }

  const query = { appointment: req.params.appointmentId };
  
  // If assignedTo is provided, find/create schedule for that specific user/resource
  if (assignedTo && assignedTo.model && assignedTo.id) {
    query['assignedTo.model'] = assignedTo.model;
    query['assignedTo.id'] = assignedTo.id;
  } else {
    // Default schedule (no assignedTo)
    query.assignedTo = { $exists: false };
  }

  let schedule = await Schedule.findOne(query);

  if (!schedule) {
    schedule = await Schedule.create({
      appointment: req.params.appointmentId,
      workingHours,
      assignedTo: assignedTo || undefined,
    });
  } else {
    schedule.workingHours = workingHours;
    await schedule.save();
  }

  sendSuccess(res, { schedule }, 'Working hours updated successfully');
});

/**
 * @desc    Add date override
 * @route   POST /api/schedules/:appointmentId/overrides
 * @access  Private (Organizer)
 */
export const addDateOverride = asyncHandler(async (req, res) => {
  const { date, isAvailable, slots, reason } = req.body;

  // Verify appointment ownership
  const appointment = await Appointment.findById(req.params.appointmentId);
  
  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  if (appointment.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized', 403);
  }

  let schedule = await Schedule.findOne({ appointment: req.params.appointmentId });

  if (!schedule) {
    return sendError(res, 'Schedule not found', 404);
  }

  // Check if override already exists for this date
  const existingOverrideIndex = schedule.dateOverrides.findIndex(
    override => override.date.toISOString().split('T')[0] === new Date(date).toISOString().split('T')[0]
  );

  if (existingOverrideIndex > -1) {
    schedule.dateOverrides[existingOverrideIndex] = {
      date,
      isAvailable,
      slots,
      reason,
    };
  } else {
    schedule.dateOverrides.push({
      date,
      isAvailable,
      slots,
      reason,
    });
  }

  await schedule.save();

  sendSuccess(res, { schedule }, 'Date override added successfully');
});

/**
 * @desc    Remove date override
 * @route   DELETE /api/schedules/:appointmentId/overrides/:date
 * @access  Private (Organizer)
 */
export const removeDateOverride = asyncHandler(async (req, res) => {
  // Verify appointment ownership
  const appointment = await Appointment.findById(req.params.appointmentId);
  
  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  if (appointment.organizer.toString() !== req.user._id.toString()) {
    return sendError(res, 'Not authorized', 403);
  }

  const schedule = await Schedule.findOne({ appointment: req.params.appointmentId });

  if (!schedule) {
    return sendError(res, 'Schedule not found', 404);
  }

  schedule.dateOverrides = schedule.dateOverrides.filter(
    override => override.date.toISOString().split('T')[0] !== req.params.date
  );

  await schedule.save();

  sendSuccess(res, { schedule }, 'Date override removed successfully');
});
