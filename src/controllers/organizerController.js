import Appointment from '../models/Appointment.js';
import Booking from '../models/Booking.js';
import User from '../models/User.js';
import { asyncHandler, sendSuccess } from '../utils/helpers.js';

/**
 * @desc    Get organizer dashboard stats
 * @route   GET /api/organizer/stats
 * @access  Private (Organizer)
 */
export const getOrganizerStats = asyncHandler(async (req, res) => {
  const organizerId = req.user._id;

  // Get all appointments for this organizer
  const appointments = await Appointment.find({ organizer: organizerId });
  const appointmentIds = appointments.map(apt => apt._id);

  // Get all bookings for these appointments
  const allBookings = await Booking.find({ appointment: { $in: appointmentIds } });

  // Get today's date range
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Today's bookings
  const todayBookings = allBookings.filter(booking => {
    const bookingDate = new Date(booking.startTime);
    return bookingDate >= today && bookingDate < tomorrow;
  });

  // Upcoming bookings (future)
  const now = new Date();
  const upcomingBookings = allBookings.filter(booking => {
    return new Date(booking.startTime) > now && booking.status !== 'cancelled';
  });

  // Get unique customers count
  const uniqueCustomers = new Set(allBookings.map(booking => booking.customer.toString()));

  // Calculate revenue (only from confirmed/completed bookings)
  const revenue = allBookings
    .filter(booking => ['confirmed', 'completed'].includes(booking.status))
    .reduce((total, booking) => total + (booking.totalAmount || 0), 0);

  const stats = {
    totalAppointments: appointments.length,
    publishedAppointments: appointments.filter(apt => apt.isPublished).length,
    todayBookings: todayBookings.length,
    upcomingBookings: upcomingBookings.length,
    totalCustomers: uniqueCustomers.size,
    totalBookings: allBookings.length,
    revenue: revenue,
  };

  sendSuccess(res, { stats });
});
