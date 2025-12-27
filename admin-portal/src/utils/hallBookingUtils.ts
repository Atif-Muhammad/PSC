import { differenceInCalendarDays, addDays, format, parse } from "date-fns";
import {
  Hall,
  HallBooking,
  HallBookingForm,
  HallBookingTime,
  PricingType,
  PaymentStatus,
} from "@/types/hall-booking.type";
import { DateStatus } from "@/types/room-booking.type";

// Helper to parse date strings (yyyy-MM-dd or ISO) as a local Date object without UTC shifts for simple dates
export const parseLocalDate = (dateStr: string): Date => {
  if (!dateStr) return new Date();

  // If it's already a full ISO string or contains time info, take just the date part for consistent local parsing
  // or if it's already a Date object (though TS says string), handle it.
  const str = String(dateStr);
  const datePart = str.includes('T') ? str.split('T')[0] : str;

  const parts = datePart.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts.map(Number);
    const date = new Date(y, m - 1, d);
    if (!isNaN(date.getTime())) return date;
  }

  // Fallback for other formats
  const fallback = new Date(dateStr);
  return isNaN(fallback.getTime()) ? new Date() : fallback;
};

export const hallInitialFormState: HallBookingForm = {
  membershipNo: "",
  memberName: "",
  memberId: "",
  category: "Hall",
  hallId: "",
  bookingDate: "",
  eventType: "",
  eventTime: "MORNING",
  pricingType: "member",
  totalPrice: 0,
  numberOfGuests: 0,
  paymentStatus: "UNPAID",
  paidAmount: 0,
  pendingAmount: 0,
  paymentMode: "CASH",
  paidBy: "MEMBER",
  guestName: "",
  guestContact: "",
  remarks: "",
  endDate: "",
  numberOfDays: 1,
  bookingDetails: [],
};

export const calculateHallPrice = (
  halls: Hall[],
  hallId: string,
  pricingType: PricingType,
  bookingDetails: { date: string; timeSlot: string }[]
) => {
  if (!hallId) return 0;

  const hall = halls.find((h) => h.id.toString() === hallId);
  if (!hall) return 0;

  const basePrice = pricingType === "member"
    ? Number(hall.chargesMembers || 0)
    : Number(hall.chargesGuests || 0);

  // If we have granular details, price is per-slot
  if (bookingDetails && bookingDetails.length > 0) {
    return basePrice * bookingDetails.length;
  }

  return basePrice;
};

export const calculateHallAccountingValues = (
  paymentStatus: PaymentStatus,
  totalPrice: number,
  paidAmount: number
) => {
  let paid = 0;
  let owed = totalPrice;

  if (paymentStatus === "PAID") {
    paid = totalPrice;
    owed = 0;
  } else if (paymentStatus === "HALF_PAID") {
    paid = paidAmount;
    owed = totalPrice - paidAmount;
  }

  return { paid, owed, pendingAmount: owed };
};


// Enhanced function to get hall date and time slot statuses
export const getHallDateTimeStatuses = (
  hallId: string,
  bookings: HallBooking[],
  halls: Hall[],
  reservations: any[] = []
) => {
  const hall = halls.find((h) => h.id.toString() === hallId);
  if (!hall) return {};

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const statusMap: Record<string, { disabled: boolean; unavailableTimeSlots: string[] }> = {};

  // Get all bookings for this hall
  const hallBookings = bookings.filter(
    (booking) => booking.hallId?.toString() === hallId
  );

  // Get all reservations for this hall
  const hallReservations = reservations.filter(
    (reservation) => reservation.hallId?.toString() === hallId
  );

  // Process next 60 days
  for (let i = 0; i < 60; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    const dateString = date.toISOString().split('T')[0];

    // Check if hall is out of order for this date
    const isOutOfOrder = isHallOutOfOrderForDate(hall, date);

    // Get unavailable time slots for this date
    const unavailableTimeSlots = getUnavailableTimeSlotsForDate(
      date,
      hallId,
      hallBookings,
      hallReservations
    );

    // Date is disabled only if ALL time slots are unavailable OR hall is out of order
    const allTimeSlotsUnavailable = unavailableTimeSlots.length === 3; // MORNING, EVENING, NIGHT
    const disabled = isOutOfOrder || allTimeSlotsUnavailable;

    statusMap[dateString] = {
      disabled,
      unavailableTimeSlots: disabled ? ['MORNING', 'EVENING', 'NIGHT'] : unavailableTimeSlots
    };
  }

  return statusMap;
};

// Check if hall is out of order for a specific date
export const isHallOutOfOrderForDate = (hall: Hall, date: Date): boolean => {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  // Check new outOfOrders relation
  if (hall.outOfOrders && Array.isArray(hall.outOfOrders)) {
    const isOut = hall.outOfOrders.some(period => {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return targetDate >= start && targetDate <= end;
    });
    if (isOut) return true;
  }

  // Fallback to legacy fields or manual flag
  if (hall.outOfServiceFrom && hall.outOfServiceTo) {
    const outOfServiceFrom = new Date(hall.outOfServiceFrom);
    const outOfServiceTo = new Date(hall.outOfServiceTo);

    outOfServiceFrom.setHours(0, 0, 0, 0);
    outOfServiceTo.setHours(0, 0, 0, 0);

    if (targetDate >= outOfServiceFrom && targetDate <= outOfServiceTo) return true;
  }

  return hall.isOutOfService;
};

// Get unavailable time slots for a specific date
export const getUnavailableTimeSlotsForDate = (
  date: Date,
  hallId: string,
  bookings: HallBooking[],
  reservations: any[]
): string[] => {
  // Format date as YYYY-MM-DD in local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;

  const unavailableSlots: string[] = [];

  // Check bookings for this date (already filtered by hallId in callers, but we double check here)
  bookings.filter(booking => booking.hallId?.toString() === hallId).forEach(booking => {
    // 1. Check granular bookingDetails if available
    if (booking.bookingDetails && Array.isArray(booking.bookingDetails)) {
      booking.bookingDetails.forEach((detail: any) => {
        const detailDateStr = format(new Date(detail.date), "yyyy-MM-dd");
        if (detailDateStr === dateString && detail.timeSlot) {
          if (!unavailableSlots.includes(detail.timeSlot)) {
            unavailableSlots.push(detail.timeSlot);
          }
        }
      });
    }
    // 2. Fallback to legacy bookingTime for backward compatibility
    else if (booking.bookingTime) {
      const bookingDate = new Date(booking.bookingDate);
      const bDateString = bookingDate.toISOString().split('T')[0];
      if (bDateString === dateString && !unavailableSlots.includes(booking.bookingTime)) {
        unavailableSlots.push(booking.bookingTime);
      }
    }
  });

  // Check reservations for this date
  const dateReservations = reservations.filter(reservation => {
    const reservedFrom = new Date(reservation.reservedFrom);
    const reservedTo = new Date(reservation.reservedTo);

    reservedFrom.setHours(0, 0, 0, 0);
    reservedTo.setHours(0, 0, 0, 0);

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);

    return targetDate >= reservedFrom && targetDate <= reservedTo;
  });

  dateReservations.forEach(reservation => {
    if (reservation.timeSlot && !unavailableSlots.includes(reservation.timeSlot)) {
      unavailableSlots.push(reservation.timeSlot);
    }
  });

  // Check holdings for this date
  const hall = (window as any).allHalls?.find((h: any) => h.id.toString() === hallId);
  if (hall && hall.holdings && Array.isArray(hall.holdings)) {
    hall.holdings.forEach((hold: any) => {
      if (!hold.onHold) return;
      const holdExpiry = new Date(hold.holdExpiry);
      if (holdExpiry < new Date()) return;

      if (hold.fromDate && hold.toDate) {
        const hStart = format(new Date(hold.fromDate), "yyyy-MM-dd");
        const hEnd = format(new Date(hold.toDate), "yyyy-MM-dd");
        if (dateString >= hStart && dateString <= hEnd) {
          if (hold.timeSlot && !unavailableSlots.includes(hold.timeSlot)) {
            unavailableSlots.push(hold.timeSlot);
          } else if (!hold.timeSlot) {
            // Global hold
            ['MORNING', 'EVENING', 'NIGHT'].forEach(slot => {
              if (!unavailableSlots.includes(slot)) unavailableSlots.push(slot);
            });
          }
        }
      } else {
        // Legacy hold (global)
        ['MORNING', 'EVENING', 'NIGHT'].forEach(slot => {
          if (!unavailableSlots.includes(slot)) unavailableSlots.push(slot);
        });
      }
    });
  }

  return unavailableSlots;
};

// Get available time slots for a specific date and hall
export const getAvailableTimeSlots = (
  hallId: string,
  date: string,
  bookings: HallBooking[],
  halls: Hall[],
  reservations: any[] = []
): string[] => {
  const allTimeSlots = ['MORNING', 'EVENING', 'NIGHT'];

  if (!date || !hallId) return allTimeSlots;

  const hall = halls.find((h) => h.id.toString() === hallId);
  if (!hall) return allTimeSlots;

  // Filter bookings for this specific hall
  const hallBookings = bookings.filter(
    (booking) => booking.hallId?.toString() === hallId
  );

  // Check if hall is out of order for the selected date
  if (isHallOutOfOrderForDate(hall, parseLocalDate(date))) {
    return [];
  }

  // Get unavailable time slots for the selected date
  const unavailableSlots = getUnavailableTimeSlotsForDate(
    parseLocalDate(date),
    hallId,
    hallBookings,
    reservations
  );

  return allTimeSlots.filter(slot =>
    !unavailableSlots.includes(slot)
  );
};

export const checkHallConflicts = (
  hallId: string,
  startDate: string,
  endDate: string,
  timeSlot: string,
  bookings: HallBooking[],
  halls: Hall[],
  reservations: any[] = [],
  excludeBookingId?: string,
  bookingDetails?: { date: string, timeSlot: string }[]
) => {
  const hall = halls.find(h => h.id.toString() === hallId);
  if (!hall) return { hasConflict: false };

  const start = parseLocalDate(startDate);
  const end = endDate ? parseLocalDate(endDate) : start;

  const numberOfDays = Math.abs(differenceInCalendarDays(end, start)) + 1;

  for (let i = 0; i < numberOfDays; i++) {
    const targetDate = addDays(start, i);
    const dateString = format(targetDate, "yyyy-MM-dd");

    // Get time slot for this specific date
    let currentSlot = timeSlot;
    if (bookingDetails && Array.isArray(bookingDetails)) {
      const detail = bookingDetails.find(d => {
        const dDate = format(new Date(d.date), "yyyy-MM-dd");
        return dDate === dateString;
      });
      if (detail) currentSlot = detail.timeSlot;
    }

    // 1. Check Out of Order
    if (isHallOutOfOrderForDate(hall, targetDate)) {
      return {
        hasConflict: true,
        type: 'OUT_OF_ORDER',
        date: dateString,
        message: `Hall is Out of Service on ${format(targetDate, "MMM d, yyyy")}`
      };
    }

    // 2. Check Bookings
    const isBooked = bookings.some(b => {
      if (excludeBookingId && b.id?.toString() === excludeBookingId?.toString()) return false;

      // Check granular details first
      if (b.bookingDetails && Array.isArray(b.bookingDetails)) {
        return b.hallId?.toString() === hallId && b.bookingDetails.some((d: any) => {
          const detailDateStr = format(new Date(d.date), "yyyy-MM-dd");
          return detailDateStr === dateString && d.timeSlot === currentSlot;
        });
      }

      // Fallback to legacy
      const bDate = format(new Date(b.bookingDate), "yyyy-MM-dd");
      return b.hallId?.toString() === hallId && bDate === dateString && b.bookingTime === currentSlot;
    });

    if (isBooked) {
      return {
        hasConflict: true,
        type: 'BOOKED',
        date: dateString,
        message: `Hall is already Booked for ${currentSlot} on ${format(targetDate, "MMM d, yyyy")}`
      };
    }

    // 3. Check Reservations
    const isReserved = reservations.some(r => {
      const rStart = new Date(r.reservedFrom);
      const rEnd = new Date(r.reservedTo);
      rStart.setHours(0, 0, 0, 0);
      rEnd.setHours(0, 0, 0, 0);

      const d = new Date(targetDate);
      d.setHours(0, 0, 0, 0);

      return r.hallId?.toString() === hallId && d >= rStart && d <= rEnd && r.timeSlot === currentSlot;
    });

    if (isReserved) {
      return {
        hasConflict: true,
        type: 'RESERVED',
        date: dateString,
        message: `Hall is Reserved for ${currentSlot} on ${format(targetDate, "MMM d, yyyy")}`
      };
    }

    // 4. Check Holdings
    if (hall.holdings && Array.isArray(hall.holdings)) {
      const isHeld = hall.holdings.some(hold => {
        if (!hold.onHold) return false;
        const holdExpiry = new Date(hold.holdExpiry);
        if (holdExpiry < new Date()) return false;

        if (hold.fromDate && hold.toDate) {
          const hStart = format(new Date(hold.fromDate), "yyyy-MM-dd");
          const hEnd = format(new Date(hold.toDate), "yyyy-MM-dd");

          if (dateString >= hStart && dateString <= hEnd) {
            return !hold.timeSlot || hold.timeSlot === currentSlot;
          }
          return false;
        }

        // Legacy hold
        return true;
      });

      if (isHeld) {
        return {
          hasConflict: true,
          type: 'HELD',
          date: dateString,
          message: `Hall is on Hold for ${currentSlot} on ${format(targetDate, "MMM d, yyyy")}`
        };
      }
    }
  }

  return { hasConflict: false };
};
