import { differenceInCalendarDays, addDays, format } from "date-fns";
import {
  Hall,
  HallBooking,
  HallBookingForm,
  HallBookingTime,
  PricingType,
  PaymentStatus,
} from "@/types/hall-booking.type";
import { DateStatus } from "@/types/room-booking.type";

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
  numberOfDays: 1,
  remarks: "",
};

export const calculateHallPrice = (
  halls: Hall[],
  hallId: string,
  pricingType: PricingType,
  numberOfDays: number = 1
) => {
  if (!hallId) return 0;

  const hall = halls.find((h) => h.id.toString() === hallId);
  if (!hall) return 0;

  const basePrice = pricingType === "member"
    ? Number(hall.chargesMembers || 0)
    : Number(hall.chargesGuests || 0);

  return basePrice * numberOfDays;
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
  bookings: HallBooking[],
  reservations: any[]
): string[] => {
  // Format date as YYYY-MM-DD in local timezone
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateString = `${year}-${month}-${day}`;

  const unavailableSlots: string[] = [];

  // Check bookings for this date
  const dateBookings = bookings.filter(booking => {
    const bookingDate = new Date(booking.bookingDate);
    const bYear = bookingDate.getFullYear();
    const bMonth = String(bookingDate.getMonth() + 1).padStart(2, '0');
    const bDay = String(bookingDate.getDate()).padStart(2, '0');
    const bookingDateString = `${bYear}-${bMonth}-${bDay}`;
    return bookingDateString === dateString;
  });

  dateBookings.forEach(booking => {
    if (booking.bookingTime && !unavailableSlots.includes(booking.bookingTime)) {
      unavailableSlots.push(booking.bookingTime);
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

  // Get unavailable time slots for the selected date
  const unavailableSlots = getUnavailableTimeSlotsForDate(
    new Date(date),
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
  numberOfDays: number,
  timeSlot: string,
  bookings: HallBooking[],
  halls: Hall[],
  reservations: any[] = [],
  excludeBookingId?: string
) => {
  const hall = halls.find(h => h.id.toString() === hallId);
  if (!hall) return { hasConflict: false };

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);

  for (let i = 0; i < numberOfDays; i++) {
    const targetDate = addDays(start, i);
    const dateString = targetDate.toISOString().split('T')[0];

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
      if (excludeBookingId && b.id.toString() === excludeBookingId) return false;
      const bDate = new Date(b.bookingDate).toISOString().split('T')[0];
      return b.hallId?.toString() === hallId && bDate === dateString && b.bookingTime === timeSlot;
    });

    if (isBooked) {
      return {
        hasConflict: true,
        type: 'BOOKED',
        date: dateString,
        message: `Hall is already Booked for ${timeSlot} on ${format(targetDate, "MMM d, yyyy")}`
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

      return r.hallId?.toString() === hallId && d >= rStart && d <= rEnd && r.timeSlot === timeSlot;
    });

    if (isReserved) {
      return {
        hasConflict: true,
        type: 'RESERVED',
        date: dateString,
        message: `Hall is Reserved for ${timeSlot} on ${format(targetDate, "MMM d, yyyy")}`
      };
    }
  }

  return { hasConflict: false };
};
