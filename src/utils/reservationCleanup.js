import Booking from '../models/Booking.js';
import cron from 'node-cron';

/**
 * Automatic cleanup of expired temporary reservations
 * Runs every minute to release expired reservation slots
 * IRCTC-style: Automatically releases slots if payment not completed
 */
export const cleanupExpiredReservations = async () => {
  try {
    const now = new Date();
    
    // Find and expire reservations with expired payment windows
    const result = await Booking.updateMany(
      {
        status: 'pending_payment', // Updated status name
        paymentStatus: 'pending',
        reservationExpiry: { $lt: now },
      },
      {
        $set: {
          status: 'expired', // Updated status name
          cancellationReason: 'Payment timeout - reservation expired automatically',
          cancelledAt: now,
        }
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`[Cleanup] Expired ${result.modifiedCount} reservations at ${now.toISOString()}`);
    }
  } catch (error) {
    console.error('[Cleanup] Error cleaning up expired reservations:', error);
  }
};

/**
 * Schedule automatic cleanup job
 * Runs every minute to ensure timely slot release
 */
export const startReservationCleanupJob = () => {
  // Run every minute
  cron.schedule('* * * * *', () => {
    cleanupExpiredReservations();
  });

  console.log('[Cleanup] Reservation cleanup job started (runs every minute)');
  console.log('[Cleanup] Automatically expires reservations after payment timeout');
};

/**
 * Manual cleanup function for immediate execution
 */
export const cleanupReservationsNow = async () => {
  console.log('Running manual reservation cleanup...');
  await cleanupExpiredReservations();
  console.log('Manual cleanup completed');
};
