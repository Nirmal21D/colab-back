import User from '../models/User.js';
import Appointment from '../models/Appointment.js';
import Booking from '../models/Booking.js';
import { asyncHandler, sendSuccess, sendError, getPagination } from '../utils/helpers.js';

/**
 * @desc    Get all users
 * @route   GET /api/admin/users
 * @access  Private (Admin)
 */
export const getAllUsers = asyncHandler(async (req, res) => {
  const { page, limit, role, search } = req.query;
  const { skip, limit: limitNum } = getPagination(page, limit);

  let query = {};

  if (role) {
    query.role = role;
  }

  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const users = await User.find(query)
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await User.countDocuments(query);

  sendSuccess(res, {
    users,
    pagination: {
      total,
      page: parseInt(page) || 1,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * @desc    Get user by ID
 * @route   GET /api/admin/users/:id
 * @access  Private (Admin)
 */
export const getUserById = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  sendSuccess(res, { user });
});

/**
 * @desc    Update user
 * @route   PUT /api/admin/users/:id
 * @access  Private (Admin)
 */
export const updateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  sendSuccess(res, { user }, 'User updated successfully');
});

/**
 * @desc    Delete user
 * @route   DELETE /api/admin/users/:id
 * @access  Private (Admin)
 */
export const deleteUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  await user.deleteOne();

  sendSuccess(res, {}, 'User deleted successfully');
});

/**
 * @desc    Toggle user active status
 * @route   PATCH /api/admin/users/:id/toggle-active
 * @access  Private (Admin)
 */
export const toggleUserStatus = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);

  if (!user) {
    return sendError(res, 'User not found', 404);
  }

  user.isActive = !user.isActive;
  await user.save();

  sendSuccess(res, { user }, `User ${user.isActive ? 'activated' : 'deactivated'}`);
});

/**
 * @desc    Get system statistics
 * @route   GET /api/admin/stats
 * @access  Private (Admin)
 */
export const getSystemStats = asyncHandler(async (req, res) => {
  const totalUsers = await User.countDocuments();
  const totalCustomers = await User.countDocuments({ role: 'customer' });
  const totalOrganizers = await User.countDocuments({ role: 'organizer' });
  const totalAppointments = await Appointment.countDocuments();
  const publishedAppointments = await Appointment.countDocuments({ isPublished: true });
  const totalBookings = await Booking.countDocuments();
  const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
  const completedBookings = await Booking.countDocuments({ status: 'completed' });
  const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });

  // Recent bookings (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentBookings = await Booking.countDocuments({
    createdAt: { $gte: thirtyDaysAgo },
  });

  sendSuccess(res, {
    users: {
      total: totalUsers,
      customers: totalCustomers,
      organizers: totalOrganizers,
    },
    appointments: {
      total: totalAppointments,
      published: publishedAppointments,
    },
    bookings: {
      total: totalBookings,
      confirmed: confirmedBookings,
      completed: completedBookings,
      cancelled: cancelledBookings,
      recent: recentBookings,
    },
  });
});

/**
 * @desc    Get all bookings (admin view)
 * @route   GET /api/admin/bookings
 * @access  Private (Admin)
 */
export const getAllBookings = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const { skip, limit: limitNum } = getPagination(page, limit);

  let query = {};
  if (status) {
    query.status = status;
  }

  const bookings = await Booking.find(query)
    .populate('appointment', 'title')
    .populate('customer', 'name email')
    .populate('organizer', 'name email')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Booking.countDocuments(query);

  sendSuccess(res, {
    bookings,
    pagination: {
      total,
      page: parseInt(page) || 1,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * @desc    Get all appointments (admin view)
 * @route   GET /api/admin/appointments
 * @access  Private (Admin)
 */
export const getAllAppointments = asyncHandler(async (req, res) => {
  const { page, limit, search, isPublished, isActive, organizerId } = req.query;
  const { skip, limit: limitNum } = getPagination(page, limit);

  let query = {};

  if (search) {
    query.$or = [
      { title: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  if (isPublished !== undefined) {
    query.isPublished = isPublished === 'true';
  }

  if (isActive !== undefined) {
    query.isActive = isActive === 'true';
  }

  if (organizerId) {
    query.organizer = organizerId;
  }

  const appointments = await Appointment.find(query)
    .populate('organizer', 'name email organizerProfile')
    .skip(skip)
    .limit(limitNum)
    .sort({ createdAt: -1 });

  const total = await Appointment.countDocuments(query);

  // Get booking counts for each appointment
  const appointmentsWithStats = await Promise.all(
    appointments.map(async (appointment) => {
      const bookingCount = await Booking.countDocuments({ 
        appointment: appointment._id 
      });
      const confirmedCount = await Booking.countDocuments({ 
        appointment: appointment._id, 
        status: 'confirmed' 
      });
      return {
        ...appointment.toObject(),
        bookingCount,
        confirmedCount,
      };
    })
  );

  sendSuccess(res, {
    appointments: appointmentsWithStats,
    pagination: {
      total,
      page: parseInt(page) || 1,
      pages: Math.ceil(total / limitNum),
    },
  });
});

/**
 * @desc    Get appointment details (admin view)
 * @route   GET /api/admin/appointments/:id
 * @access  Private (Admin)
 */
export const getAppointmentById = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id)
    .populate('organizer', 'name email phone organizerProfile');

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  // Get bookings for this appointment
  const bookings = await Booking.find({ appointment: appointment._id })
    .populate('customer', 'name email phone')
    .sort({ startTime: -1 })
    .limit(10);

  const bookingStats = {
    total: await Booking.countDocuments({ appointment: appointment._id }),
    confirmed: await Booking.countDocuments({ appointment: appointment._id, status: 'confirmed' }),
    pending: await Booking.countDocuments({ appointment: appointment._id, status: 'pending' }),
    cancelled: await Booking.countDocuments({ appointment: appointment._id, status: 'cancelled' }),
    completed: await Booking.countDocuments({ appointment: appointment._id, status: 'completed' }),
  };

  sendSuccess(res, {
    appointment,
    bookings,
    bookingStats,
  });
});

/**
 * @desc    Toggle appointment active status (admin)
 * @route   PATCH /api/admin/appointments/:id/toggle-active
 * @access  Private (Admin)
 */
export const toggleAppointmentStatus = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  appointment.isActive = !appointment.isActive;
  await appointment.save();

  sendSuccess(res, { appointment }, `Appointment ${appointment.isActive ? 'activated' : 'deactivated'}`);
});

/**
 * @desc    Delete appointment (admin)
 * @route   DELETE /api/admin/appointments/:id
 * @access  Private (Admin)
 */
export const deleteAppointmentAsAdmin = asyncHandler(async (req, res) => {
  const appointment = await Appointment.findById(req.params.id);

  if (!appointment) {
    return sendError(res, 'Appointment not found', 404);
  }

  // Check if there are any bookings
  const bookingCount = await Booking.countDocuments({ 
    appointment: appointment._id,
    status: { $in: ['confirmed', 'pending'] }
  });

  if (bookingCount > 0) {
    return sendError(res, `Cannot delete appointment with ${bookingCount} active bookings`, 400);
  }

  await appointment.deleteOne();

  sendSuccess(res, {}, 'Appointment deleted successfully');
});

/**
 * @desc    Get analytics and reports data
 * @route   GET /api/admin/analytics
 * @access  Private (Admin)
 */
export const getAnalyticsData = asyncHandler(async (req, res) => {
  const { period = '30' } = req.query; // days: 7, 30, 90, 365, or 'all'
  
  const daysAgo = period === 'all' ? null : parseInt(period);
  const dateFilter = daysAgo ? { 
    createdAt: { $gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) } 
  } : {};

  // Revenue Analytics
  const revenueData = await Booking.aggregate([
    { 
      $match: { 
        status: 'confirmed',
        ...(daysAgo && { createdAt: { $gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) } })
      } 
    },
    {
      $lookup: {
        from: 'appointments',
        localField: 'appointment',
        foreignField: '_id',
        as: 'appointmentData'
      }
    },
    { $unwind: '$appointmentData' },
    {
      $group: {
        _id: null,
        totalRevenue: { 
          $sum: { 
            $cond: [
              '$appointmentData.requiresPayment',
              { $ifNull: ['$appointmentData.price', 0] },
              0
            ]
          }
        },
        paidBookings: {
          $sum: { $cond: ['$appointmentData.requiresPayment', 1, 0] }
        }
      }
    }
  ]);

  // Booking Trends (last 30 days, grouped by day)
  const bookingTrends = await Booking.aggregate([
    {
      $match: {
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { '_id.date': 1 } }
  ]);

  // Appointment Performance
  const appointmentStats = await Appointment.aggregate([
    { $match: dateFilter },
    {
      $lookup: {
        from: 'bookings',
        localField: '_id',
        foreignField: 'appointment',
        as: 'bookings'
      }
    },
    {
      $addFields: {
        totalBookings: { $size: '$bookings' },
        confirmedBookings: {
          $size: {
            $filter: {
              input: '$bookings',
              as: 'booking',
              cond: { $eq: ['$$booking.status', 'confirmed'] }
            }
          }
        },
        revenue: {
          $cond: [
            '$requiresPayment',
            { 
              $multiply: [
                { $ifNull: ['$price', 0] },
                {
                  $size: {
                    $filter: {
                      input: '$bookings',
                      as: 'booking',
                      cond: { $eq: ['$$booking.status', 'confirmed'] }
                    }
                  }
                }
              ]
            },
            0
          ]
        }
      }
    },
    {
      $project: {
        title: 1,
        totalBookings: 1,
        confirmedBookings: 1,
        revenue: 1,
        isActive: 1,
        isPublished: 1
      }
    },
    { $sort: { totalBookings: -1 } },
    { $limit: 10 }
  ]);

  // Organizer Performance
  const organizerStats = await User.aggregate([
    { $match: { role: 'organizer' } },
    {
      $lookup: {
        from: 'appointments',
        localField: '_id',
        foreignField: 'organizer',
        as: 'appointments'
      }
    },
    {
      $lookup: {
        from: 'bookings',
        let: { appointmentIds: '$appointments._id' },
        pipeline: [
          {
            $match: {
              $expr: { $in: ['$appointment', '$$appointmentIds'] },
              status: 'confirmed',
              ...(daysAgo && { createdAt: { $gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) } })
            }
          }
        ],
        as: 'bookings'
      }
    },
    {
      $addFields: {
        totalAppointments: { $size: '$appointments' },
        activeAppointments: {
          $size: {
            $filter: {
              input: '$appointments',
              as: 'apt',
              cond: { $eq: ['$$apt.isActive', true] }
            }
          }
        },
        totalBookings: { $size: '$bookings' },
        revenue: {
          $reduce: {
            input: '$bookings',
            initialValue: 0,
            in: {
              $add: [
                '$$value',
                {
                  $let: {
                    vars: {
                      apt: {
                        $arrayElemAt: [
                          {
                            $filter: {
                              input: '$appointments',
                              as: 'a',
                              cond: { $eq: ['$$a._id', '$$this.appointment'] }
                            }
                          },
                          0
                        ]
                      }
                    },
                    in: {
                      $cond: [
                        '$$apt.requiresPayment',
                        { $ifNull: ['$$apt.price', 0] },
                        0
                      ]
                    }
                  }
                }
              ]
            }
          }
        }
      }
    },
    {
      $project: {
        name: 1,
        email: 1,
        'organizerProfile.businessName': 1,
        totalAppointments: 1,
        activeAppointments: 1,
        totalBookings: 1,
        revenue: 1
      }
    },
    { $sort: { totalBookings: -1 } },
    { $limit: 10 }
  ]);

  // Overall Statistics
  const totalUsers = await User.countDocuments();
  const totalOrganizers = await User.countDocuments({ role: 'organizer' });
  const totalCustomers = await User.countDocuments({ role: 'customer' });
  const totalAppointments = await Appointment.countDocuments(dateFilter);
  const activeAppointments = await Appointment.countDocuments({ ...dateFilter, isActive: true });
  const publishedAppointments = await Appointment.countDocuments({ ...dateFilter, isPublished: true });
  
  const totalBookings = await Booking.countDocuments(dateFilter);
  const confirmedBookings = await Booking.countDocuments({ ...dateFilter, status: 'confirmed' });
  const pendingBookings = await Booking.countDocuments({ ...dateFilter, status: 'pending' });
  const canceledBookings = await Booking.countDocuments({ ...dateFilter, status: 'canceled' });

  // Booking Status Distribution
  const bookingStatusDistribution = await Booking.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 }
      }
    }
  ]);

  // Popular Time Slots
  const popularTimeSlots = await Booking.aggregate([
    {
      $match: {
        status: 'confirmed',
        ...(daysAgo && { createdAt: { $gte: new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000) } })
      }
    },
    {
      $group: {
        _id: { $hour: '$startTime' },
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } },
    { $limit: 10 }
  ]);

  // Location Type Distribution
  const locationTypeDistribution = await Appointment.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: '$locationType',
        count: { $sum: 1 }
      }
    }
  ]);

  // Growth Metrics (compare with previous period)
  let growthMetrics = null;
  if (daysAgo) {
    const previousPeriodStart = new Date(Date.now() - 2 * daysAgo * 24 * 60 * 60 * 1000);
    const previousPeriodEnd = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
    
    const previousBookings = await Booking.countDocuments({
      createdAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd }
    });
    
    const previousAppointments = await Appointment.countDocuments({
      createdAt: { $gte: previousPeriodStart, $lt: previousPeriodEnd }
    });
    
    const bookingGrowth = previousBookings > 0 
      ? ((totalBookings - previousBookings) / previousBookings * 100).toFixed(1)
      : 100;
    
    const appointmentGrowth = previousAppointments > 0
      ? ((totalAppointments - previousAppointments) / previousAppointments * 100).toFixed(1)
      : 100;
    
    growthMetrics = {
      bookingGrowth: parseFloat(bookingGrowth),
      appointmentGrowth: parseFloat(appointmentGrowth),
      previousPeriodBookings: previousBookings,
      previousPeriodAppointments: previousAppointments
    };
  }

  sendSuccess(res, {
    period: period === 'all' ? 'all time' : `${period} days`,
    overview: {
      totalUsers,
      totalOrganizers,
      totalCustomers,
      totalAppointments,
      activeAppointments,
      publishedAppointments,
      totalBookings,
      confirmedBookings,
      pendingBookings,
      canceledBookings,
      totalRevenue: revenueData[0]?.totalRevenue || 0,
      paidBookings: revenueData[0]?.paidBookings || 0
    },
    bookingTrends,
    appointmentPerformance: appointmentStats,
    organizerPerformance: organizerStats,
    bookingStatusDistribution,
    popularTimeSlots: popularTimeSlots.map(slot => ({
      hour: slot._id,
      count: slot.count,
      timeRange: `${slot._id}:00 - ${slot._id + 1}:00`
    })),
    locationTypeDistribution,
    growthMetrics
  });
});
