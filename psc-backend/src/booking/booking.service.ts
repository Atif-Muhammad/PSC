import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { BookingDto } from './dtos/booking.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  BookingOpt,
  BookingType,
  PaidBy,
  PaymentMode,
  PaymentStatus,
  Prisma,
  VoucherStatus,
  VoucherType,
} from '@prisma/client';
import {
  formatPakistanDate,
  getPakistanDate,
  parsePakistanDate,
} from 'src/utils/time';

@Injectable()
export class BookingService {
  constructor(private prismaService: PrismaService) { }

  private formatHallBookingRemarks(
    hallName: string,
    startDate: Date,
    endDate: Date,
    eventType: string,
    bookingDetails: any[],
    eventTime: string,
  ): string {
    const rangeStr =
      startDate.getTime() === endDate.getTime()
        ? formatPakistanDate(startDate)
        : `${formatPakistanDate(startDate)} to ${formatPakistanDate(endDate)}`;

    let remarks = `Hall Booking: ${hallName} | ${rangeStr}`;

    if (bookingDetails && Array.isArray(bookingDetails) && bookingDetails.length > 0) {
      const detailsList = bookingDetails
        .map((d) => {
          const dDate = formatPakistanDate(parsePakistanDate(d.date));
          const slot = d.timeSlot;
          const type = d.eventType || eventType;
          return `- ${dDate}: ${slot} (${type})`;
        })
        .join('\n');

      remarks += `\n${detailsList}`;
    } else {
      remarks += `\n- ${rangeStr}: ${eventTime} (${eventType})`;
    }

    return remarks;
  }
  async lock() {
    const bookings = await this.prismaService.roomBooking.findMany({
      where: {
        checkIn: {
          lte: new Date(),
        },
        checkOut: {
          gte: new Date(),
        },
      },
      select: { rooms: { select: { roomId: true } } },
    });

    const roomsTobeLocked = bookings.flatMap((b) => b.rooms.map((r) => r.roomId));
    return await this.prismaService.room.updateMany({
      where: { id: { in: roomsTobeLocked }, isBooked: false },
      data: { isBooked: true },
    });
  }

  // room booking
  // room booking
  // gBookingsRoom moved to bottom for better organization with new include logic


  async cBookingRoom(payload: BookingDto) {
    const {
      membershipNo,
      entityId,
      selectedRoomIds,
      checkIn,
      checkOut,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode,
      numberOfAdults = 1,
      numberOfChildren = 0,
      specialRequests = '',
      paidBy = 'MEMBER',
      guestContact,
      guestName,
    } = payload;

    // ── VALIDATION ───────────────────────────────────────────
    const checkInDate = parsePakistanDate(checkIn!);
    const checkOutDate = parsePakistanDate(checkOut!);

    const now = getPakistanDate();
    now.setHours(0, 0, 0, 0);

    const normalizedCheckIn = new Date(checkInDate);
    normalizedCheckIn.setHours(0, 0, 0, 0);

    if (!checkIn || !checkOut || checkInDate >= checkOutDate)
      throw new ConflictException('Check-in must be before check-out');
    if (normalizedCheckIn < now)
      throw new ConflictException('Check-in date cannot be in the past');
    if (numberOfAdults < 1)
      throw new ConflictException('At least one adult is required');
    if (numberOfAdults + numberOfChildren > 6) // This might need to be per room or total? Assuming per booking record.
      throw new ConflictException(
        'Maximum booking capacity exceeded',
      );

    if (pricingType === 'guest') {
      if (!guestName || !guestContact) {
        throw new ConflictException(
          'Guest name and contact are required for guest pricing',
        );
      }
    }

    // ── RESOLVE ROOM IDS ─────────────────────────────────────
    const roomIdsToBook = selectedRoomIds && selectedRoomIds.length > 0
      ? selectedRoomIds.map(id => Number(id))
      : entityId
        ? [Number(entityId)]
        : [];

    if (roomIdsToBook.length === 0) {
      throw new BadRequestException('No rooms selected for booking');
    }

    // ── ROOM VALIDATION LOOP ─────────────────────────────────
    const rooms = await this.prismaService.room.findMany({
      where: { id: { in: roomIdsToBook } },
      include: {
        reservations: {
          where: {
            reservedFrom: { lt: checkOutDate },
            reservedTo: { gt: checkInDate },
          },
        },
        outOfOrders: {
          where: {
            startDate: { lt: checkOutDate },
            endDate: { gt: checkInDate },
          },
        },
        bookings: {
          where: {
            booking: {
              checkIn: { lt: checkOutDate },
              checkOut: { gt: checkInDate },
            }
          }
        },
        roomType: true,
      },
    });

    if (rooms.length !== roomIdsToBook.length) {
      throw new NotFoundException('Some selected rooms were not found');
    }

    const roomNumbers = rooms.map(r => r.roomNumber).join(', ');

    for (const room of rooms) {
      if (!room.isActive) throw new ConflictException(`Room ${room.roomNumber} is not active`);

      // Check holdings with exact dates
      const roomHold = await this.prismaService.roomHoldings.findFirst({
        where: {
          roomId: room.id,
          onHold: true,
          OR: [
            {
              // Check for exact date overlap
              checkIn: { lt: checkOutDate },
              checkOut: { gt: checkInDate },
            },
            {
              // Fallback for legacy holds (only expiry)
              checkIn: null,
              holdExpiry: { gt: new Date() },
            },
          ],
        },
      });
      if (roomHold) throw new ConflictException(`Room ${room.roomNumber} is currently on hold`);

      if (room.outOfOrders.length > 0) {
        throw new ConflictException(`Room ${room.roomNumber} has maintenance during this period`);
      }

      if (room.reservations.length > 0) {
        throw new ConflictException(`Room ${room.roomNumber} is reserved during this period`);
      }

      if (room.bookings.length > 0) {
        throw new ConflictException(`Room ${room.roomNumber} is already booked during this period`);
      }
    }

    // ── PAYMENT CALCULATION ──────────────────────────────────
    const total = Number(totalPrice);
    let paid = 0,
      owed = total;

    if (paymentStatus === (PaymentStatus.PAID as unknown)) {
      paid = total;
      owed = 0;
    } else if (paymentStatus === (PaymentStatus.HALF_PAID as unknown)) {
      paid = Number(paidAmount) || 0;
      if (paid <= 0 || paid >= total)
        throw new ConflictException(
          'Paid amount must be >0 and <total for half-paid',
        );
      owed = total - paid;
    } else if (paymentStatus === (PaymentStatus.TO_BILL as unknown)) {
      paid = Number(paidAmount) || 0;
      owed = total - paid;
    }

    const isToBill = paymentStatus === (PaymentStatus.TO_BILL as unknown);
    const amountToBalance = isToBill ? owed : 0;
    const finalOwed = isToBill ? 0 : owed;

    // ── CREATE BOOKING ───────────────────────────────────────
    // Create join table entries for each room
    const booking = await this.prismaService.roomBooking.create({
      data: {
        createdAt: getPakistanDate(),
        Membership_No: membershipNo,
        rooms: {
          create: rooms.map(r => ({
            roomId: r.id,
            priceAtBooking: pricingType === 'member' ? r.roomType.priceMember : r.roomType.priceGuest
          }))
        },
        checkIn: checkInDate,
        checkOut: checkOutDate,
        totalPrice: total,
        paymentStatus: paymentStatus as unknown as PaymentStatus,
        pricingType,
        paidAmount: paid,
        pendingAmount: finalOwed,
        numberOfAdults,
        numberOfChildren,
        specialRequests,
        paidBy,
        guestName,
        guestContact: guestContact?.toString(),
      },
    });

    // ── UPDATE ROOM STATUS ───────────────────────────────────
    if (checkInDate <= now && checkOutDate > now) {
      // Mark all rooms as booked
      await this.prismaService.room.updateMany({
        where: { id: { in: roomIdsToBook } },
        data: { isBooked: true }
      });
    }

    // ── UPDATE MEMBER LEDGER ─────────────────────────────────
    await this.prismaService.member.update({
      where: { Membership_No: membershipNo },
      data: {
        totalBookings: { increment: 1 },
        lastBookingDate: now,
        bookingAmountPaid: { increment: Math.round(Number(paid)) },
        bookingAmountDue: { increment: Math.round(Number(finalOwed)) },
        bookingBalance: { increment: Math.round(Number(paid) - Number(finalOwed)) },
        Balance: { increment: Math.round(amountToBalance) },
        drAmount: { increment: Math.round(amountToBalance) },
      },
    });

    // ── CREATE PAYMENT VOUCHER ───────────────────────────────
    if (paid > 0) {
      const voucherType =
        paymentStatus === (PaymentStatus.PAID as unknown)
          ? VoucherType.FULL_PAYMENT
          : VoucherType.HALF_PAYMENT;

      await this.prismaService.paymentVoucher.create({
        data: {
          booking_type: 'ROOM',
          booking_id: booking.id,
          membership_no: membershipNo,
          amount: paid,
          payment_mode: paymentMode as unknown as PaymentMode,
          voucher_type: voucherType,
          status: VoucherStatus.CONFIRMED,
          issued_by: 'admin',
          remarks: `Rooms: ${roomNumbers} | ${formatPakistanDate(checkInDate)} → ${formatPakistanDate(checkOutDate)} | Guests: ${numberOfAdults}A/${numberOfChildren}C${specialRequests ? ` | ${specialRequests}` : ''}`,
        },
      });
    }

    // ── CREATE ROOM HOLDING (Mirrors Booking) ────────────────
    await this.prismaService.roomHoldings.createMany({
      data: rooms.map((r) => ({
        roomId: r.id,
        onHold: true,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        holdExpiry: checkOutDate,
        holdBy: membershipNo,
      })),
    });

    return booking;
  }

  async uBookingRoom(payload: Partial<BookingDto>) {
    const {
      id,
      membershipNo,
      entityId,
      selectedRoomIds,
      checkIn,
      checkOut,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode,
      numberOfAdults,
      numberOfChildren,
      specialRequests,
      remarks,
      paidBy = 'MEMBER',
      guestContact,
      guestName,
    } = payload;

    if (!id) throw new BadRequestException('Booking ID required');

    // ── FETCH EXISTING ──────────────────────────────────────
    const booking = await this.prismaService.roomBooking.findUnique({
      where: { id: Number(id) },
      include: {
        rooms: {
          include: {
            room: {
              include: {
                roomType: true
              }
            }
          }
        }
      },
    });
    if (!booking) throw new UnprocessableEntityException('Booking not found');

    // ── DATA PREP ──────────────────────────────────────────
    const currentRoomIds = booking.rooms.map(r => r.roomId);

    const newCheckIn = checkIn ? parsePakistanDate(checkIn) : booking.checkIn;
    const newCheckOut = checkOut
      ? parsePakistanDate(checkOut)
      : booking.checkOut;

    // Normalize dates
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    const normalizedNewCheckIn = new Date(newCheckIn);
    normalizedNewCheckIn.setHours(0, 0, 0, 0);

    if (newCheckIn >= newCheckOut)
      throw new ConflictException('Check-in must be before check-out');

    // ── GUEST COUNT VALIDATION ──────────────────────────────
    const newAdults = numberOfAdults ?? booking.numberOfAdults;
    const newChildren = numberOfChildren ?? booking.numberOfChildren;
    if (newAdults < 1)
      throw new ConflictException('At least one adult is required');
    if (newAdults + newChildren > 6)
      throw new ConflictException('Max capacity exceeded');

    const newPricingType = pricingType ?? booking.pricingType;
    if (newPricingType === 'guest') {
      const newGuestName = guestName ?? booking.guestName;
      const newGuestContact = guestContact ?? booking.guestContact;
      if (!newGuestName || !newGuestContact) {
        throw new ConflictException(
          'Guest name and contact are required for guest pricing',
        );
      }
    }

    // ── ROOM SELECTION ──────────────────────────────────────
    // If selectedRoomIds or entityId provided, use them. Else use current rooms.
    let targetRoomIds: number[] = [];
    if (selectedRoomIds && selectedRoomIds.length > 0) {
      targetRoomIds = selectedRoomIds.map(Number);
    } else if (entityId) {
      targetRoomIds = [Number(entityId)];
    } else {
      targetRoomIds = currentRoomIds;
    }

    if (targetRoomIds.length === 0) throw new BadRequestException("No rooms part of this booking");

    // ── ROOM VALIDATION ─────────────────────────────────────
    const rooms = await this.prismaService.room.findMany({
      where: { id: { in: targetRoomIds } },
      include: {
        outOfOrders: {
          where: {
            startDate: { lt: newCheckOut },
            endDate: { gt: newCheckIn },
          },
        },
        reservations: {
          where: {
            reservedFrom: { lt: newCheckOut },
            reservedTo: { gt: newCheckIn },
          },
        },
        bookings: {
          where: {
            bookingId: { not: booking.id }, // Exclude current booking
            booking: {
              checkIn: { lt: newCheckOut },
              checkOut: { gt: newCheckIn },
            }
          }
        },
        roomType: true,
      },
    });

    if (rooms.length !== targetRoomIds.length) throw new NotFoundException('Some rooms not found');

    const roomNumbers = rooms.map(r => r.roomNumber).join(', ');

    for (const room of rooms) {
      if (!room.isActive) throw new ConflictException(`Room ${room.roomNumber} not active`);

      // Check holdings
      // Check holdings with exact dates
      const roomHold = await this.prismaService.roomHoldings.findFirst({
        where: {
          roomId: room.id,
          onHold: true,
          OR: [
            {
              checkIn: { lt: newCheckOut },
              checkOut: { gt: newCheckIn },
            },
            {
              checkIn: null,
              holdExpiry: { gt: new Date() },
            },
          ],
          // Exclude holds by this booking's user? 
          // Assuming user might be updating their own booking, but the hold might be separate.
          // Ideally we should exclude holds linked to THIS booking, but holds aren't linked to bookings by ID.
          // We can exclude holds by this `membershipNo` if we assume 1 active booking/process per user.
          // But safe to just alert conflict if blocked.
          // NOT: { holdBy: booking.Membership_No } // logic below exists in member update, maybe add here?
          // Adding exclusion for same member to allow updates
          NOT: { holdBy: booking.Membership_No },
        },
      });
      if (roomHold) throw new ConflictException(`Room ${room.roomNumber} is currently on hold`);

      if (room.outOfOrders.length > 0) throw new ConflictException(`Room ${room.roomNumber} has maintenance`);
      if (room.reservations.length > 0) throw new ConflictException(`Room ${room.roomNumber} is reserved`);
      if (room.bookings.length > 0) throw new ConflictException(`Room ${room.roomNumber} is already booked`);
    }

    // ── PAYMENT CALCULATIONS ────────────────────────────────
    const currTotal = Number(booking.totalPrice);
    const currPaid = Number(booking.paidAmount);
    const currStatus = booking.paymentStatus;

    // Favor payload values, fall back to current values
    const newTotal = totalPrice !== undefined ? Number(totalPrice) : currTotal;
    let newPaymentStatus = (paymentStatus as unknown as PaymentStatus) || currStatus;

    let newPaid = currPaid;
    if (newPaymentStatus === PaymentStatus.PAID) {
      newPaid = newTotal;
    } else if (newPaymentStatus === PaymentStatus.UNPAID) {
      newPaid = 0;
    } else {
      // HALF_PAID or TO_BILL
      newPaid = paidAmount !== undefined ? Number(paidAmount) : currPaid;
    }

    // Adjustment for TO_BILL
    let newOwed = newTotal - newPaid;
    let amountToBalance = 0;
    if (newPaymentStatus === PaymentStatus.TO_BILL) {
      amountToBalance = newOwed;
      newOwed = 0;
    }

    // Handle Vouchers and get Refund Amount
    const refundAmount = await this.handleVoucherUpdateUnified(
      booking.id,
      'ROOM',
      membershipNo ?? booking.Membership_No,
      newTotal,
      newPaid,
      newPaymentStatus,
      currTotal,
      currPaid,
      currStatus,
      {
        roomNumbers,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        remarks: remarks
      },
      (paymentMode as unknown as PaymentMode) || PaymentMode.CASH,
      'admin'
    );



    const paidDiff = newPaid - currPaid;
    const owedDiff = newOwed - (currTotal - currPaid);

    // ── UPDATE BOOKING ──────────────────────────────────────
    const updated = await this.prismaService.roomBooking.update({
      where: { id: booking.id },
      data: {
        Membership_No: membershipNo ?? booking.Membership_No,
        // Update rooms relation using join table
        rooms: {
          deleteMany: {},
          create: rooms.map(r => ({
            roomId: r.id,
            priceAtBooking: (pricingType ?? booking.pricingType) === 'member' ? r.roomType.priceMember : r.roomType.priceGuest
          }))
        },
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        totalPrice: newTotal,
        paymentStatus: newPaymentStatus,
        pricingType: pricingType ?? booking.pricingType,
        paidAmount: newPaid,
        pendingAmount: newOwed,
        numberOfAdults: newAdults,
        numberOfChildren: newChildren,
        specialRequests: specialRequests ?? booking.specialRequests,
        remarks: remarks!,
        paidBy,
        guestName,
        guestContact: guestContact?.toString(),
        refundAmount,
        refundReturned: false,
      },
    });

    // ── UPDATE DATES IN VOUCHERS ────────────────────────────
    const datesChanged =
      booking.checkIn.getTime() !== newCheckIn.getTime() ||
      booking.checkOut.getTime() !== newCheckOut.getTime();
    if (
      datesChanged &&
      (newPaymentStatus === 'PAID' || newPaymentStatus === 'HALF_PAID')
    ) {
      await this.updateVoucherDates(
        booking.id,
        newCheckIn,
        newCheckOut,
        remarks,
      );
    }

    // ── UPDATE ROOM STATUS ───────────────────────────────────
    await this.updateRoomStatusMulti(
      currentRoomIds,
      targetRoomIds,
      newCheckIn,
      newCheckOut,
    );

    // ── UPDATE MEMBER LEDGER ─────────────────────────────────
    if (paidDiff !== 0 || owedDiff !== 0 || amountToBalance !== 0) {
      await this.prismaService.member.update({
        where: { Membership_No: membershipNo ?? booking.Membership_No },
        data: {
          bookingAmountPaid: { increment: Math.round(Number(paidDiff)) },
          bookingAmountDue: { increment: Math.round(Number(owedDiff)) },
          bookingBalance: { increment: Math.round(Number(paidDiff) - Number(owedDiff)) },
          lastBookingDate: new Date(),
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });
    }

    return { ...updated, prevRoomId: booking.roomId };
  }

  async gBookingsRoom() {
    return await this.prismaService.roomBooking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        rooms: {
          include: {
            room: {
              select: {
                id: true,
                roomNumber: true,
                roomType: {
                  select: { type: true, id: true },
                },
              }
            }
          }
        },
        member: {
          select: {
            Membership_No: true,
            Name: true,
            Balance: true,
          },
        },
      },
    });
  }

  // ... (cBookingRoom and uBookingRoom are above)

  // Helper methods for uBookingRoom
  private async handleVoucherUpdateUnified(
    bookingId: number,
    bookingType: 'ROOM' | 'HALL' | 'LAWN' | 'PHOTOSHOOT',
    membershipNo: string,
    newTotal: number,
    newPaid: number,
    newStatus: PaymentStatus,
    oldTotal: number,
    oldPaid: number,
    oldStatus: PaymentStatus,
    details: {
      roomNumbers?: string;
      hallName?: string;
      lawnName?: string;
      photoshootDesc?: string;
      checkIn?: Date;
      checkOut?: Date;
      bookingDate?: Date;
      endDate?: Date;
      eventTime?: string;
      eventType?: string;
      bookingDetails?: any[];
      remarks?: string;
    },
    paymentMode: PaymentMode = PaymentMode.CASH,
    issuedBy: string = 'admin'
  ) {
    const paidDiff = newPaid - oldPaid;
    let refundAmount = 0;

    const commonData = {
      booking_id: bookingId,
      booking_type: bookingType,
      membership_no: membershipNo,
      payment_mode: paymentMode,
      issued_by: issuedBy,
    };

    let itemInfo = '';
    let dateInfo = '';
    if (bookingType === 'ROOM') {
      itemInfo = `Rooms: ${details.roomNumbers}`;
      dateInfo = `${formatPakistanDate(details.checkIn!)} → ${formatPakistanDate(details.checkOut!)}`;
    } else if (bookingType === 'HALL') {
      itemInfo = details.hallName || 'Hall';
      dateInfo = `${formatPakistanDate(details.bookingDate!)} (${details.eventType}) - ${details.eventTime}`;
    } else if (bookingType === 'LAWN') {
      itemInfo = details.lawnName || 'Lawn';
      dateInfo = `${formatPakistanDate(details.bookingDate!)} (${details.eventTime})`;
    } else if (bookingType === 'PHOTOSHOOT') {
      itemInfo = details.photoshootDesc || 'Photoshoot';
      dateInfo = `${formatPakistanDate(details.bookingDate!)} (${details.eventTime})`;
    }

    const baseRemarks =
      bookingType === 'HALL'
        ? this.formatHallBookingRemarks(
          details.hallName || 'Hall',
          details.bookingDate!,
          details.endDate || details.bookingDate!,
          details.eventType!,
          details.bookingDetails || [],
          details.eventTime!,
        ) + (details.remarks ? ` | ${details.remarks}` : '')
        : `${itemInfo} | ${dateInfo}${details.remarks ? ` | ${details.remarks}` : ''}`;

    if (paidDiff < 0) {
      // Scenario: Payment decreased (Less -> cancel the voucher and gen new)
      await this.prismaService.paymentVoucher.updateMany({
        where: {
          booking_id: bookingId,
          booking_type: bookingType,
          status: VoucherStatus.CONFIRMED,
          voucher_type: { in: [VoucherType.FULL_PAYMENT, VoucherType.HALF_PAYMENT] }
        },
        data: { status: VoucherStatus.CANCELLED }
      });

      if (newPaid > 0) {
        await this.prismaService.paymentVoucher.create({
          data: {
            ...commonData,
            amount: newPaid,
            voucher_type: newStatus === PaymentStatus.PAID ? VoucherType.FULL_PAYMENT : VoucherType.HALF_PAYMENT,
            status: VoucherStatus.CONFIRMED,
            remarks: `${baseRemarks} | Payment Correction (Decrease)`
          }
        });
      }

      // Check for refund if it was fully paid before and now charges are less
      if (oldStatus === PaymentStatus.PAID && newPaid < oldTotal) {
        refundAmount = oldTotal - newPaid;
        await this.prismaService.paymentVoucher.create({
          data: {
            ...commonData,
            amount: refundAmount,
            payment_mode: PaymentMode.CASH,
            voucher_type: VoucherType.REFUND,
            status: VoucherStatus.PENDING,
            remarks: `Refund for reduced charges | ${dateInfo}`
          }
        });
      }
    } else if (paidDiff > 0) {
      // Scenario: Payment increased (greater will gen new for the new amount)
      await this.prismaService.paymentVoucher.create({
        data: {
          ...commonData,
          amount: paidDiff,
          voucher_type: newStatus === PaymentStatus.PAID ? VoucherType.FULL_PAYMENT : VoucherType.HALF_PAYMENT,
          status: VoucherStatus.CONFIRMED,
          remarks: `${baseRemarks} | Payment Update (Increase)`
        }
      });
    }

    return refundAmount;
  }

  private async updateVoucherDates(
    bookingId: number,
    checkIn: Date,
    checkOut: Date,
    remarks?: string,
  ) {
    await this.prismaService.paymentVoucher.updateMany({
      where: {
        booking_id: bookingId,
        booking_type: 'ROOM',
        status: VoucherStatus.CONFIRMED,
        voucher_type: {
          in: [VoucherType.FULL_PAYMENT, VoucherType.HALF_PAYMENT],
        },
      },
      data: {
        remarks: `${formatPakistanDate(checkIn)} to ${formatPakistanDate(checkOut)}${remarks ? ` | ${remarks}` : ''}`,
      },
    });
  }

  private async updateRoomStatus(
    oldRoomId: number,
    newRoomId: number,
    checkIn: Date,
    checkOut: Date,
  ) {
    // Legacy support wrapper
    await this.updateRoomStatusMulti([oldRoomId], [newRoomId], checkIn, checkOut);
  }

  private async updateRoomStatusMulti(
    oldRoomIds: number[],
    newRoomIds: number[],
    checkIn: Date,
    checkOut: Date,
  ) {
    const now = getPakistanDate();
    const isCurrentlyBooked = checkIn <= now && checkOut > now;

    // 1. Unbook old rooms that are NOT in the new list
    const roomsToUnbook = oldRoomIds.filter(id => !newRoomIds.includes(id));
    if (roomsToUnbook.length > 0) {
      await this.prismaService.room.updateMany({
        where: { id: { in: roomsToUnbook } },
        data: { isBooked: false }
      });
    }

    // 2. Book new rooms (or keep booked if they were already)
    if (isCurrentlyBooked && newRoomIds.length > 0) {
      await this.prismaService.room.updateMany({
        where: { id: { in: newRoomIds } },
        data: { isBooked: true }
      });
    } else if (!isCurrentlyBooked && newRoomIds.length > 0) {
      // If the booking is in future, ensure isBooked is false? 
      // Logic says "isBooked" means *currently* occupied.
      // So if future booking, we don't set isBooked=true.
      // But if we moved from current->future, we might need to unbook.
      // The check `isCurrentlyBooked` handles this.

      // HOWEVER, if a room was in old list AND new list, and we moved date to future, it should stay unbooked.
      // But if it was isBooked=true because of THIS booking, we need to set it false.
      // Safe bet: Update all newRoomIds to isCurrentlyBooked status.
      await this.prismaService.room.updateMany({
        where: { id: { in: newRoomIds } },
        data: { isBooked: isCurrentlyBooked }
      });
    }
  }

  async cBookingRoomMember(payload: any) {
    const {
      membershipNo,
      entityId,
      checkIn,
      checkOut,
      totalPrice,
      paymentStatus = 'PAID',
      pricingType,
      paidAmount,
      paymentMode = 'ONLINE',
      numberOfAdults = 1,
      numberOfChildren = 0,
      specialRequests = '',
      selectedRoomIds,
      paidBy = 'MEMBER',
      guestContact,
      guestName,
      remarks = '',
    } = payload;

    // ── VALIDATION ───────────────────────────────────────────
    const checkInDate = parsePakistanDate(checkIn);
    const checkOutDate = parsePakistanDate(checkOut);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (!checkIn || !checkOut || checkInDate >= checkOutDate)
      throw new ConflictException('Check-in must be before check-out');
    if (new Date(checkInDate).setHours(0, 0, 0, 0) < today.getTime())
      throw new ConflictException('Check-in date cannot be in the past');
    if (numberOfAdults < 1)
      throw new ConflictException('At least one adult required');

    if (pricingType === 'guest') {
      if (!guestName || !guestContact) {
        throw new ConflictException(
          'Guest name and contact are required for guest pricing',
        );
      }
    }

    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: membershipNo.toString() },
    });
    if (!member) throw new NotFoundException('Member not found');

    const roomIdsToBook = selectedRoomIds && selectedRoomIds.length > 0
      ? selectedRoomIds.map(id => Number(id))
      : [Number(entityId)];

    if (roomIdsToBook.length === 0) throw new BadRequestException('No rooms selected');

    // ── PROCESS IN TRANSACTION ───────────────────────────────
    return await this.prismaService.$transaction(async (prisma) => {

      // Validate all rooms
      const rooms = await prisma.room.findMany({
        where: { id: { in: roomIdsToBook } },
        include: {
          roomType: true,
          outOfOrders: {
            where: {
              startDate: { lt: checkOutDate },
              endDate: { gt: checkInDate },
            }
          },
          reservations: {
            where: {
              reservedFrom: { lt: checkOutDate },
              reservedTo: { gt: checkInDate },
            }
          },
          bookings: {
            where: {
              booking: {
                checkIn: { lt: checkOutDate },
                checkOut: { gt: checkInDate },
              }
            }
          }
        }
      });

      if (rooms.length !== roomIdsToBook.length) throw new NotFoundException('Some selected rooms not found');
      const roomNumbers = rooms.map(r => r.roomNumber).join(', ');

      for (const room of rooms) {
        if (!room.isActive) throw new ConflictException(`Room ${room.roomNumber} is not active`);
        if (room.outOfOrders.length > 0) throw new ConflictException(`Room ${room.roomNumber} has maintenance`);
        if (room.reservations.length > 0) throw new ConflictException(`Room ${room.roomNumber} is reserved`);
        if (room.bookings.length > 0) throw new ConflictException(`Room ${room.roomNumber} is already booked`);

        const roomHold = await prisma.roomHoldings.findFirst({
          where: {
            roomId: room.id,
            onHold: true,
            OR: [
              {
                checkIn: { lt: checkOutDate },
                checkOut: { gt: checkInDate },
              },
              {
                checkIn: null,
                holdExpiry: { gt: new Date() },
              },
            ],
            // Exclude holds by current user
            NOT: { holdBy: membershipNo.toString() },
          },
        });
        if (roomHold) throw new ConflictException(`Room ${room.roomNumber} is on hold by another user`);
      }

      const nights = Math.ceil(
        (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      let calculatedTotal = 0;
      if (totalPrice) {
        calculatedTotal = Number(totalPrice);
      } else {
        for (const room of rooms) {
          const pricePerNight =
            pricingType === 'member'
              ? room.roomType.priceMember
              : room.roomType.priceGuest;
          calculatedTotal += Number(pricePerNight) * nights;
        }
      }
      const total = calculatedTotal;

      let paid = 0;
      let owed = total;

      let amountToBalance = 0;
      const isToBill = paymentStatus === 'TO_BILL';

      if (paymentStatus === 'PAID') {
        paid = total;
        owed = 0;
      } else if (paymentStatus === 'HALF_PAID') {
        paid = Number(paidAmount) || 0;
        if (paid <= 0) throw new ConflictException('Paid amount must be > 0 for half-paid');
        if (paid >= total) throw new ConflictException('Paid amount must be < total for half-paid');
        owed = total - paid;
      } else {
        paid = Number(paidAmount) || 0;
        owed = total - paid;
      }

      const finalOwed = isToBill ? 0 : owed;
      amountToBalance = isToBill ? owed : 0;

      // ── CREATE BOOKING ──────────────────────────────────
      const booking = await prisma.roomBooking.create({
        data: {
          Membership_No: membershipNo,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          totalPrice: total,
          paymentStatus: paymentStatus as PaymentStatus,
          pricingType,
          paidAmount: paid,
          pendingAmount: finalOwed,
          numberOfAdults: Number(numberOfAdults),
          numberOfChildren: Number(numberOfChildren),
          specialRequests,
          paidBy,
          guestName,
          guestContact: guestContact?.toString(),
          remarks,
          // Create join table entries
          rooms: {
            create: rooms.map(r => ({
              roomId: r.id,
              priceAtBooking: pricingType === 'member' ? r.roomType.priceMember : r.roomType.priceGuest
            }))
          }
        },
      });

      // Update Member Ledger
      const now = new Date();
      await prisma.member.update({
        where: { Membership_No: membershipNo },
        data: {
          totalBookings: { increment: 1 },
          lastBookingDate: now,
          bookingAmountPaid: { increment: Math.round(Number(paid)) },
          bookingAmountDue: { increment: Math.round(Number(finalOwed)) },
          bookingBalance: { increment: Math.round(Number(paid) - Number(finalOwed)) },
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        }
      });

      // Create Voucher
      if (paid > 0) {
        const voucherType = paymentStatus === 'PAID' ? VoucherType.FULL_PAYMENT : VoucherType.HALF_PAYMENT;
        await prisma.paymentVoucher.create({
          data: {
            booking_type: 'ROOM',
            booking_id: booking.id,
            membership_no: membershipNo,
            amount: paid,
            payment_mode: (paymentMode as PaymentMode) || PaymentMode.CASH,
            voucher_type: voucherType,
            status: VoucherStatus.CONFIRMED,
            issued_by: 'system',
            remarks: `Rooms: ${roomNumbers} | ${formatPakistanDate(checkInDate)} → ${formatPakistanDate(checkOutDate)} | Online Booking`,
          }
        });
      }

      // Update Room Status if current
      const isCurrentlyBooked = checkInDate <= now && checkOutDate > now;
      if (isCurrentlyBooked) {
        await prisma.room.updateMany({
          where: { id: { in: roomIdsToBook } },
          data: { isBooked: true }
        });
      }

      // Create permanent hold record matching booking
      await prisma.roomHoldings.createMany({
        data: rooms.map((r) => ({
          roomId: r.id,
          onHold: true,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          holdExpiry: checkOutDate,
          holdBy: membershipNo.toString(),
        })),
      });

      // Optionally delete OLD/Temporary holds that don't match?
      // For now, removing the deleteMany or changing it to only delete expired/temp ones?
      // Since we just created new ones, we can clean up any 'temp' holds for this user checking in now?
      // But we just created a hold with `membershipNo`.
      // The old code `deleteMany({ where: { ..., holdBy: membershipNo } })` would delete what we just created if we ran it after!
      // So we should delete BEFORE creating, or delete only those specific temp holds.
      // Better: Delete all holds by this user for these rooms, THEN create new ones.
      // This handles "converting" temp hold to permanent.

      // Delete existing holds by this user
      await prisma.roomHoldings.deleteMany({
        where: { roomId: { in: roomIdsToBook }, holdBy: membershipNo.toString() }
      });

      // Create new holds (Moved check logic before delete to ensure we don't block ourselves if we check first? No, we check before txn or inside loop)
      // The creation is here.

      await prisma.roomHoldings.createMany({
        data: rooms.map((r) => ({
          roomId: r.id,
          onHold: true,
          checkIn: checkInDate,
          checkOut: checkOutDate,
          holdExpiry: checkOutDate,
          holdBy: membershipNo.toString(),
        })),
      });

      return {
        success: true,
        message: `Booked ${roomIdsToBook.length} room(s)`,
        booking,
        totalAmount: total,
        paidAmount: paid,
        pendingAmount: finalOwed,
      };
    });
  }

  async uBookingRoomMember(payload: any) {
    const {
      id,
      membershipNo,
      entityId,
      selectedRoomIds,
      checkIn,
      checkOut,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode = 'ONLINE',
      numberOfAdults = 1,
      numberOfChildren = 0,
      specialRequests = '',
      paidBy = 'MEMBER',
      guestContact,
      guestName,
      remarks,
    } = payload;

    if (!id || !membershipNo)
      throw new BadRequestException('Booking ID and membership required');

    const newCheckIn = parsePakistanDate(checkIn);
    const newCheckOut = parsePakistanDate(checkOut);

    if (!checkIn || !checkOut || newCheckIn >= newCheckOut)
      throw new ConflictException('Check-in must be before check-out');

    // ── FETCH EXISTING ──────────────────────────────────────
    const booking = await this.prismaService.roomBooking.findUnique({
      where: { id: Number(id) },
      include: {
        rooms: {
          include: {
            room: {
              include: {
                roomType: true
              }
            }
          }
        }
      },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: membershipNo.toString() },
    });
    if (!member) throw new NotFoundException('Member not found');

    // ── RESOLVE ROOM IDS ─────────────────────────────────────
    const currentRoomIds = booking.rooms.map(r => r.roomId);
    const roomIdsToBook = selectedRoomIds && selectedRoomIds.length > 0
      ? selectedRoomIds.map(id => Number(id))
      : currentRoomIds;

    const rooms = await this.prismaService.room.findMany({
      where: { id: { in: roomIdsToBook } },
      include: {
        outOfOrders: {
          where: {
            startDate: { lt: newCheckOut },
            endDate: { gt: newCheckIn },
          },
        },
        roomType: true,
      },
    });

    if (rooms.length === 0) throw new ConflictException('No rooms available');

    const roomNumbers = rooms.map(r => r.roomNumber).join(', ');

    for (const room of rooms) {
      if (!room.isActive) throw new ConflictException(`Room ${room.roomNumber} is not available`);

      // Check holdings
      const roomHold = await this.prismaService.roomHoldings.findFirst({
        where: {
          roomId: room.id,
          onHold: true,
          OR: [
            {
              checkIn: { lt: newCheckOut },
              checkOut: { gt: newCheckIn }
            },
            {
              checkIn: null,
              holdExpiry: { gt: new Date() }
            }
          ],
          NOT: { holdBy: membershipNo.toString() }
        },
      });
      if (roomHold) throw new ConflictException(`Room ${room.roomNumber} is currently on hold`);

      if (room.outOfOrders.length > 0) {
        const conflicts = room.outOfOrders
          .map(
            (oo) =>
              `${formatPakistanDate(oo.startDate)} to ${formatPakistanDate(oo.endDate)}`,
          )
          .join(', ');
        throw new ConflictException(`Room ${room.roomNumber} has maintenance: ${conflicts}`);
      }

      const overlapping = await this.prismaService.roomBooking.findFirst({
        where: {
          rooms: { some: { roomId: room.id } },
          id: { not: Number(id) },
          checkIn: { lt: newCheckOut },
          checkOut: { gt: newCheckIn },
        },
      });
      if (overlapping) throw new ConflictException(`Room ${room.roomNumber} already booked`);
    }

    // ── PAYMENT CALCULATIONS ────────────────────────────────
    const currTotal = Number(booking.totalPrice);
    const currPaid = Number(booking.paidAmount);
    const currStatus = booking.paymentStatus;

    // Use total from payload if provided, otherwise calculate based on all rooms
    let calculatedTotal = 0;
    if (totalPrice) {
      calculatedTotal = Number(totalPrice);
    } else {
      const nights = Math.ceil(
        (newCheckOut.getTime() - newCheckIn.getTime()) / (1000 * 60 * 60 * 24),
      );
      for (const room of rooms) {
        const pricePerNight = pricingType === 'member' ? room.roomType.priceMember : room.roomType.priceGuest;
        calculatedTotal += Number(pricePerNight) * nights;
      }
    }
    const newTotal = calculatedTotal;

    let newPaymentStatus = (paymentStatus as unknown as PaymentStatus) || currStatus;

    let newPaid = currPaid;
    if (newPaymentStatus === PaymentStatus.PAID) {
      newPaid = newTotal;
    } else if (newPaymentStatus === PaymentStatus.UNPAID) {
      newPaid = 0;
    } else {
      // HALF_PAID or TO_BILL
      newPaid = paidAmount !== undefined ? Number(paidAmount) : currPaid;
    }

    let newOwed = newTotal - newPaid;
    let amountToBalance = 0;
    if (newPaymentStatus === PaymentStatus.TO_BILL) {
      amountToBalance = newOwed;
      newOwed = 0;
    }

    // Handle Vouchers and get Refund Amount
    const refundAmount = await this.handleVoucherUpdateUnified(
      booking.id,
      'ROOM',
      membershipNo.toString(),
      newTotal,
      newPaid,
      newPaymentStatus,
      currTotal,
      currPaid,
      currStatus,
      {
        roomNumbers,
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        remarks: remarks
      },
      (paymentMode as unknown as PaymentMode) || PaymentMode.CASH,
      'member'
    );

    const paidDiff = newPaid - currPaid;
    const owedDiff = newOwed - (currTotal - currPaid);

    // ── UPDATE BOOKING ──────────────────────────────────────
    const updated = await this.prismaService.roomBooking.update({
      where: { id: Number(id) },
      data: {
        Membership_No: membershipNo ?? booking.Membership_No,
        rooms: {
          deleteMany: {},
          create: rooms.map(r => ({
            roomId: r.id,
            priceAtBooking: pricingType === 'member' ? r.roomType.priceMember : r.roomType.priceGuest
          }))
        },
        checkIn: newCheckIn,
        checkOut: newCheckOut,
        totalPrice: newTotal,
        paymentStatus: newPaymentStatus,
        pricingType,
        paidAmount: newPaid,
        pendingAmount: newOwed,
        numberOfAdults,
        numberOfChildren,
        specialRequests,
        remarks: remarks!,
        paidBy,
        guestName,
        guestContact: guestContact?.toString(),
        refundAmount,
        refundReturned: false,
      },
    });

    // ── UPDATE MEMBER LEDGER ─────────────────────────────────
    if (paidDiff !== 0 || owedDiff !== 0 || amountToBalance !== 0) {
      await this.prismaService.member.update({
        where: { Membership_No: membershipNo.toString() },
        data: {
          bookingAmountPaid: { increment: Math.round(Number(paidDiff)) },
          bookingAmountDue: { increment: Math.round(Number(owedDiff)) },
          bookingBalance: { increment: Math.round(Number(paidDiff) - Number(owedDiff)) },
          lastBookingDate: new Date(),
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });
    }

    return {
      success: true,
      message: 'Booking updated',
      booking: updated,
      refundAmount,
    };
  }

  async dBookingRoom(bookingId: number) {
    // find booking with rooms before deleting
    const booking = await this.prismaService.roomBooking.findUnique({
      where: { id: bookingId },
      include: { rooms: true }
    });

    if (!booking) throw new NotFoundException('Booking not found');

    // delete booking
    const deleted = await this.prismaService.roomBooking.delete({
      where: { id: bookingId },
    });

    if (!deleted) throw new InternalServerErrorException('Failed to delete booking');

    // find rooms and deactivate isBooked flag
    await this.prismaService.room.updateMany({
      where: { id: { in: booking.rooms.map(r => r.id) } },
      data: {
        isBooked: false,
      },
    });
    return deleted;
  }

  /////////////////////////////////////////////////////////////////////////////////////////////////////////
  // hall bookings
  async gBookingsHall() {
    return await this.prismaService.hallBooking.findMany({
      orderBy: {
        bookingDate: 'desc',
      },
      include: {
        hall: {
          select: {
            name: true,
            outOfOrders: {
              orderBy: {
                startDate: 'asc',
              },
            },
          },
        },
        member: {
          select: {
            Sno: true,
            Membership_No: true,
            Name: true,
            Balance: true,
          },
        },
      },
    });
  }

  async cBookingHall(payload: BookingDto) {
    const {
      membershipNo,
      entityId,
      bookingDate,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode,
      eventType,
      numberOfGuests,
      endDate: endDateInput,
      eventTime,
      paidBy,
      guestName,
      guestContact,
      remarks,
    } = payload;

    // ── VALIDATION ───────────────────────────────────────────
    if (!membershipNo || !entityId || !bookingDate || !eventType || !eventTime)
      throw new BadRequestException('Required fields missing');

    const booking = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (booking < today)
      throw new UnprocessableEntityException('Booking date cannot be in past');

    // Resolve End Date
    const endDate = endDateInput ? new Date(endDateInput) : new Date(booking);
    // Ensure endDate is at least bookingDate
    if (endDate < booking) {
      throw new BadRequestException('End Date cannot be before Start Date');
    }

    // Calculate number of days for DB (inclusive)
    // Add 1 hour to handle DST potential issues when dividing by 24h, verifying with rounding
    const diffTime = Math.abs(endDate.getTime() - booking.getTime());
    const numberOfDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // ── BOOKING DETAILS NORMALIZATION ──
    const bookingDetails = payload.bookingDetails || [];
    const normalizedDetails: { date: Date; timeSlot: string; eventType?: string }[] = [];

    if (bookingDetails && bookingDetails.length > 0) {
      // Use provided details
      for (const detail of bookingDetails) {
        const dDate = new Date(detail.date);
        dDate.setHours(0, 0, 0, 0);
        normalizedDetails.push({
          date: dDate,
          timeSlot: detail.timeSlot,
          eventType: detail.eventType || eventType,
        });
      }
    } else {
      // Fallback: Generate for each day in range using the single eventTime
      for (let i = 0; i < numberOfDays; i++) {
        const currentCheckDate = new Date(booking);
        currentCheckDate.setDate(booking.getDate() + i);
        currentCheckDate.setHours(0, 0, 0, 0);
        normalizedDetails.push({
          date: currentCheckDate,
          timeSlot: payload.eventTime || 'EVENING',
          eventType: eventType,
        });
      }
    }

    const member = await this.prismaService.member.findFirst({
      where: { Membership_No: membershipNo },
    });
    if (!member) throw new BadRequestException('Member not found');

    // ── PROCESS IN TRANSACTION ───────────────────────────────
    return await this.prismaService.$transaction(async (prisma) => {
      const hall = await prisma.hall.findFirst({
        where: { id: Number(entityId) },
        include: { outOfOrders: true },
      });
      if (!hall) throw new BadRequestException('Hall not found');

      // ── TIME VALIDATION ────────────────────────────────────
      const normalizedEventTime = eventTime.toUpperCase() as
        | 'MORNING'
        | 'EVENING'
        | 'NIGHT';
      if (!['MORNING', 'EVENING', 'NIGHT'].includes(normalizedEventTime))
        throw new BadRequestException('Invalid event time');

      // ── CONFLICT CHECKS ────────────────────────────────────
      // ── CONFLICT CHECKS (Granular) ─────────────────────────
      for (const detail of normalizedDetails) {
        const currentCheckDate = detail.date;
        const currentSlot = detail.timeSlot; // e.g. "MORNING"

        // 1. Check Out of Order for this specific date
        const outOfOrderConflict = hall.outOfOrders?.find((period) => {
          const pStart = new Date(period.startDate).setHours(0, 0, 0, 0);
          const pEnd = new Date(period.endDate).setHours(0, 0, 0, 0);
          return (currentCheckDate.getTime() >= pStart && currentCheckDate.getTime() <= pEnd);
        });

        if (outOfOrderConflict) {
          throw new ConflictException(
            `Hall '${hall.name}' out of order on ${currentCheckDate.toDateString()}`,
          );
        }

        // 2. Check Existing Bookings
        // Query conflicts impacting this specific date
        const existingBooking = await prisma.hallBooking.findFirst({
          where: {
            hallId: hall.id,
            bookingDate: { lte: currentCheckDate },
            endDate: { gte: currentCheckDate },
          },
        });

        if (existingBooking) {
          const details = existingBooking.bookingDetails as any[];
          let hasConflict = false;

          if (details && Array.isArray(details) && details.length > 0) {
            // Check if existing booking has THIS slot on THIS date
            const conflictDetail = details.find((d: any) => {
              const dDate = new Date(d.date);
              dDate.setHours(0, 0, 0, 0);
              return (
                dDate.getTime() === currentCheckDate.getTime() &&
                d.timeSlot === currentSlot
              );
            });
            if (conflictDetail) hasConflict = true;
          } else {
            // Legacy/Fallback: blocks its `bookingTime`
            if (existingBooking.bookingTime === currentSlot) {
              hasConflict = true;
            }
          }

          if (hasConflict) {
            throw new ConflictException(
              `Hall already booked for ${currentSlot} on ${currentCheckDate.toDateString()}`,
            );
          }
        }

        // 3. Check Reservations (Inclusive of the day)
        const dayStart = new Date(currentCheckDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentCheckDate);
        dayEnd.setHours(23, 59, 59, 999);

        const reservation = await prisma.hallReservation.findFirst({
          where: {
            hallId: hall.id,
            reservedFrom: { lte: dayEnd },
            reservedTo: { gte: dayStart },
            timeSlot: currentSlot,
          },
        });

        if (reservation) {
          throw new ConflictException(
            `Hall reserved for ${currentSlot} on ${currentCheckDate.toDateString()}`,
          );
        }

        // 4. Check Holdings (Granular)
        const holding = await prisma.hallHoldings.findFirst({
          where: {
            hallId: hall.id,
            onHold: true,
            holdExpiry: { gt: new Date() },
            OR: [
              {
                fromDate: { lte: currentCheckDate },
                toDate: { gte: currentCheckDate },
                timeSlot: currentSlot,
              },
              {
                // Fallback for legacy holds (only expiry)
                fromDate: null,
              }
            ]
          },
        });

        if (holding) {
          throw new ConflictException(
            `Hall is currently on hold for ${currentSlot} on ${currentCheckDate.toDateString()}`,
          );
        }
      }

      // ── PAYMENT CALCULATION ────────────────────────────────
      const basePrice =
        pricingType === 'member' ? hall.chargesMembers : hall.chargesGuests;
      const total = totalPrice ? Number(totalPrice) : Number(basePrice) * numberOfDays;
      let paid = 0,
        owed = total;

      if ((paymentStatus as unknown as PaymentStatus) === 'PAID') {
        paid = total;
        owed = 0;
      } else if (
        (paymentStatus as unknown as PaymentStatus) === 'HALF_PAID'
      ) {
        paid = Number(paidAmount) || 0;
        if (paid <= 0 || paid >= total)
          throw new ConflictException(
            'For half-paid: paid amount must be >0 and <total',
          );
        owed = total - paid;
      } else if (
        (paymentStatus as unknown as PaymentStatus) === 'TO_BILL'
      ) {
        paid = Number(paidAmount) || 0;
        owed = total - paid;
      }

      const isToBill = (paymentStatus as unknown as PaymentStatus) === 'TO_BILL';
      const finalOwed = isToBill ? 0 : owed;
      const amountToBalance = isToBill ? owed : 0;

      // ── CREATE BOOKING ─────────────────────────────────────
      const booked = await prisma.hallBooking.create({
        data: {
          memberId: member.Sno,
          hallId: hall.id,
          bookingDate: booking,
          endDate: endDate,
          numberOfDays: numberOfDays,
          bookingDetails: normalizedDetails,
          totalPrice: total,
          paymentStatus: paymentStatus as any,
          pricingType,
          numberOfGuests: Number(numberOfGuests!),
          paidAmount: paid,
          pendingAmount: finalOwed,
          eventType,
          bookingTime: normalizedEventTime,
          paidBy,
          guestName,
          guestContact: guestContact?.toString(),
          remarks: remarks!,
        },
      });

      // ── UPDATE HALL STATUS ─────────────────────────────────
      if (booking.getTime() <= today.getTime() && endDate.getTime() >= today.getTime()) {
        await prisma.hall.update({
          where: { id: hall.id },
          data: { isBooked: true },
        });
      }

      // ── UPDATE MEMBER LEDGER ───────────────────────────────
      await prisma.member.update({
        where: { Membership_No: membershipNo },
        data: {
          totalBookings: { increment: 1 },
          lastBookingDate: new Date(),
          bookingAmountPaid: { increment: Math.round(Number(paid)) },
          bookingAmountDue: { increment: Math.round(Number(finalOwed)) },
          bookingBalance: { increment: Math.round(Number(paid) - Number(finalOwed)) },
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });

      // ── CREATE PAYMENT VOUCHER ─────────────────────────────
      if (paid > 0) {
        const voucherType =
          (paymentStatus as unknown as PaymentStatus) === 'PAID'
            ? VoucherType.FULL_PAYMENT
            : VoucherType.HALF_PAYMENT;
        await prisma.paymentVoucher.create({
          data: {
            booking_type: 'HALL',
            booking_id: booked.id,
            membership_no: membershipNo,
            amount: paid,
            payment_mode: paymentMode as any,
            voucher_type: voucherType,
            status: VoucherStatus.CONFIRMED,
            issued_by: 'admin',
            remarks: this.formatHallBookingRemarks(hall.name, booking, endDate, eventType, normalizedDetails, normalizedEventTime),
          },
        });
      }

      // ── CREATE HALL HOLDINGS (Mirrors Booking) ─────────────
      await prisma.hallHoldings.createMany({
        data: normalizedDetails.map((detail) => ({
          hallId: hall.id,
          onHold: true,
          fromDate: detail.date,
          toDate: detail.date,
          timeSlot: detail.timeSlot,
          holdExpiry: endDate, // Expire at the end of the booking period
          holdBy: membershipNo,
        })),
      });

      return booked;
    });
  }

  async uBookingHall(payload: Partial<BookingDto>) {
    const {
      id,
      membershipNo,
      entityId,
      bookingDate,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode,
      eventType,
      eventTime,
      endDate: endDateInput,
      numberOfGuests,
      paidBy,
      guestName,
      guestContact,
      remarks,
    } = payload;

    if (
      !id ||
      !membershipNo ||
      !entityId ||
      !bookingDate ||
      !eventType ||
      !eventTime
    )
      throw new BadRequestException('Required fields missing');

    const booking = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Resolve End Date
    const endDate = endDateInput ? new Date(endDateInput) : new Date(booking);
    if (endDate < booking) {
      throw new BadRequestException('End Date cannot be before Start Date');
    }

    const diffTime = Math.abs(endDate.getTime() - booking.getTime());
    const numberOfDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // ── BOOKING DETAILS NORMALIZATION ──
    const bookingDetailsIn = payload.bookingDetails || [];
    const normalizedDetails: { date: Date; timeSlot: string; eventType?: string }[] = [];

    if (bookingDetailsIn && bookingDetailsIn.length > 0) {
      for (const detail of bookingDetailsIn) {
        const dDate = new Date(detail.date);
        dDate.setHours(0, 0, 0, 0);
        normalizedDetails.push({
          date: dDate,
          timeSlot: detail.timeSlot,
          eventType: detail.eventType || eventType,
        });
      }
    } else {
      for (let i = 0; i < numberOfDays; i++) {
        const currentCheckDate = new Date(booking);
        currentCheckDate.setDate(booking.getDate() + i);
        currentCheckDate.setHours(0, 0, 0, 0);
        normalizedDetails.push({
          date: currentCheckDate,
          timeSlot: eventTime,
          eventType: eventType,
        });
      }
    }

    const existing = await this.prismaService.hallBooking.findUnique({
      where: { id: Number(id) },
      include: { hall: { include: { outOfOrders: true } }, member: true },
    });
    if (!existing) throw new NotFoundException('Booking not found');

    const member = await this.prismaService.member.findFirst({
      where: { Membership_No: membershipNo },
    });
    if (!member) throw new BadRequestException('Member not found');

    // ── PROCESS IN TRANSACTION ───────────────────────────────
    return await this.prismaService.$transaction(async (prisma) => {
      const hall = await prisma.hall.findFirst({
        where: { id: Number(entityId) },
        include: { outOfOrders: true },
      });
      if (!hall) throw new BadRequestException('Hall not found');

      // ── TIME VALIDATION ────────────────────────────────────
      const normalizedEventTime = eventTime.toUpperCase() as
        | 'MORNING'
        | 'EVENING'
        | 'NIGHT';
      if (!['MORNING', 'EVENING', 'NIGHT'].includes(normalizedEventTime))
        throw new BadRequestException('Invalid event time');

      // Check for conflicts only if details changed
      const detailsChanged =
        existing.hallId !== Number(entityId) ||
        existing.bookingDate.getTime() !== booking.getTime() ||
        existing.endDate.getTime() !== endDate.getTime() || // Check endDate change
        existing.bookingTime !== normalizedEventTime ||
        JSON.stringify(existing.bookingDetails) !== JSON.stringify(normalizedDetails);

      if (detailsChanged) {
        // Granular check for each date/slot
        for (const detail of normalizedDetails) {
          const currentCheckDate = detail.date;
          const currentSlot = detail.timeSlot;

          // existingBooking conflict check
          const conflictingBooking = await prisma.hallBooking.findFirst({
            where: {
              hallId: Number(entityId),
              id: { not: Number(id) },
              bookingDate: { lte: currentCheckDate },
              endDate: { gte: currentCheckDate },
            },
          });

          if (conflictingBooking) {
            const cDetails = conflictingBooking.bookingDetails as any[];
            let hasConflict = false;
            if (cDetails && Array.isArray(cDetails) && cDetails.length > 0) {
              const conflict = cDetails.find((d: any) => {
                const dDate = new Date(d.date);
                dDate.setHours(0, 0, 0, 0);
                return dDate.getTime() === currentCheckDate.getTime() && d.timeSlot === currentSlot;
              });
              if (conflict) hasConflict = true;
            } else {
              if (conflictingBooking.bookingTime === currentSlot) hasConflict = true;
            }

            if (hasConflict) {
              throw new ConflictException(
                `Hall already booked for ${currentSlot} on ${currentCheckDate.toDateString()}`,
              );
            }
          }

          // Reservation conflict check (Inclusive of the day)
          const dayStart = new Date(currentCheckDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(currentCheckDate);
          dayEnd.setHours(23, 59, 59, 999);

          const conflictingReservation = await prisma.hallReservation.findFirst({
            where: {
              hallId: Number(entityId),
              timeSlot: currentSlot,
              reservedFrom: { lte: dayEnd },
              reservedTo: { gte: dayStart },
            },
          });

          if (conflictingReservation) {
            throw new ConflictException(
              `Hall reserved for ${currentSlot} on ${currentCheckDate.toDateString()}`,
            );
          }

          // 3. Hall Holding conflict check (Granular)
          const conflictingHolding = await prisma.hallHoldings.findFirst({
            where: {
              hallId: Number(entityId),
              onHold: true,
              holdExpiry: { gt: new Date() },
              NOT: { holdBy: membershipNo }, // Exclude holds by this member
              OR: [
                {
                  fromDate: { lte: currentCheckDate },
                  toDate: { gte: currentCheckDate },
                  timeSlot: currentSlot,
                },
                {
                  fromDate: null,
                }
              ]
            },
          });

          if (conflictingHolding) {
            throw new ConflictException(
              `Hall is currently on hold for ${currentSlot} on ${currentCheckDate.toDateString()}`,
            );
          }
        }
      }

      // ── PAYMENT RECALCULATION ──────────────────────────────

      // ── PAYMENT CALCULATIONS ────────────────────────────────
      const currTotal = Number(existing.totalPrice);
      const currPaid = Number(existing.paidAmount);
      const currStatus = existing.paymentStatus as unknown as PaymentStatus;

      const newTotal = Number(totalPrice);
      let newPaymentStatus = (paymentStatus as unknown as PaymentStatus) || currStatus;

      let newPaid = currPaid;
      if (newPaymentStatus === PaymentStatus.PAID) {
        newPaid = newTotal;
      } else if (newPaymentStatus === PaymentStatus.UNPAID) {
        newPaid = 0;
      } else {
        newPaid = paidAmount !== undefined ? Number(paidAmount) : currPaid;
      }

      let newOwed = newTotal - newPaid;
      let amountToBalance = 0;
      if (newPaymentStatus === PaymentStatus.TO_BILL) {
        amountToBalance = newOwed;
        newOwed = 0;
      }

      const refundAmount = await this.handleVoucherUpdateUnified(
        Number(id),
        'HALL',
        membershipNo,
        newTotal,
        newPaid,
        newPaymentStatus,
        currTotal,
        currPaid,
        currStatus,
        {
          hallName: hall.name,
          bookingDate: booking,
          endDate: endDate,
          eventTime: normalizedEventTime,
          eventType: eventType,
          bookingDetails: normalizedDetails,
          remarks: remarks,
        },
        PaymentMode.CASH,
        'admin'
      );

      const paidDiff = newPaid - currPaid;
      const owedDiff = newOwed - (currTotal - currPaid);

      // ── UPDATE BOOKING ─────────────────────────────────────
      const updated = await prisma.hallBooking.update({
        where: { id: Number(id) },
        data: {
          hallId: hall.id,
          memberId: member.Sno,
          bookingDate: booking,
          endDate: endDate,
          numberOfDays: numberOfDays,
          bookingDetails: normalizedDetails,
          totalPrice: newTotal,
          paymentStatus: newPaymentStatus,
          pricingType,
          paidAmount: newPaid,
          pendingAmount: newOwed,
          numberOfGuests: Number(numberOfGuests!),
          eventType,
          bookingTime: normalizedEventTime,
          paidBy,
          guestName,
          guestContact: guestContact?.toString(),
          refundAmount,
          refundReturned: false,
        } as any,
      });

      // ── UPDATE VOUCHER DATES ───────────────────────────────
      const dateChanged = existing.bookingDate.getTime() !== booking.getTime();
      if (
        dateChanged &&
        (newPaymentStatus === 'PAID' || newPaymentStatus === 'HALF_PAID')
      ) {
        await prisma.paymentVoucher.updateMany({
          where: {
            booking_id: Number(id),
            booking_type: 'HALL',
            status: VoucherStatus.CONFIRMED,
            voucher_type: {
              in: [VoucherType.FULL_PAYMENT, VoucherType.HALF_PAYMENT],
            },
          },
          data: {
            remarks: this.formatHallBookingRemarks(existing.hall.name, booking, endDate, eventType, normalizedDetails, normalizedEventTime),
          },
        });
      }

      // ── UPDATE HALL STATUS ─────────────────────────────────
      // We need to re-evaluate isBooked based on current date
      // If current date is within the range, isBooked = true
      const now = new Date().getTime();
      const isWithinRange = now >= booking.getTime() && now <= endDate.getTime();
      const wasWithinRange = now >= existing.bookingDate.getTime() && now <= existing.endDate.getTime();

      // Simple update: Check if ANY booking is currently active for this hall, if so set True, else False
      // But that's expensive to query all.
      // Optimistic approach: if we just added a current booking, set true.
      if (isWithinRange && !wasWithinRange) {
        await prisma.hall.update({ where: { id: hall.id }, data: { isBooked: true } });
      }
      // If we removed a current booking (moved dates), we should check if others exist?
      // Or just set false if we think we were the only one? Safer to leave as is or do a check if critical.
      // Given existing logic was simple toggle, we'll stick to simple logic:
      // If we are active NOW, ensure encoded.
      if (isWithinRange) {
        await prisma.hall.update({ where: { id: hall.id }, data: { isBooked: true } });
      }

      // ── UPDATE MEMBER LEDGER ───────────────────────────────
      if (paidDiff !== 0 || owedDiff !== 0) {
        await prisma.member.update({
          where: { Membership_No: membershipNo },
          data: {
            bookingAmountPaid: { increment: Math.round(Number(paidDiff)) },
            bookingAmountDue: { increment: Math.round(Number(owedDiff)) },
            bookingBalance: { increment: Math.round(Number(paidDiff) - Number(owedDiff)) },
            lastBookingDate: new Date(),
            Balance: { increment: Math.round(amountToBalance) },
            drAmount: { increment: Math.round(amountToBalance) },
          },
        });
      }

      // ── CREATE/UPDATE HALL HOLDINGS ───────────────────────
      // For updates, we clear existing holds for this member/hall and re-create
      await prisma.hallHoldings.deleteMany({
        where: {
          hallId: hall.id,
          holdBy: existing.member.Membership_No,
        },
      });

      await prisma.hallHoldings.createMany({
        data: normalizedDetails.map((detail) => ({
          hallId: hall.id,
          onHold: true,
          fromDate: detail.date,
          toDate: detail.date,
          timeSlot: detail.timeSlot,
          holdExpiry: endDate,
          holdBy: membershipNo,
        })),
      });

      return updated;
    });
  }

  // member hall booking
  async cBookingHallMember(payload: any) {
    const {
      membershipNo,
      entityId,
      bookingDate,
      totalPrice,
      paymentStatus = 'PAID',
      pricingType,
      paidAmount,
      paymentMode = 'ONLINE',
      eventType,
      eventTime,
      endDate: endDateInput,
      specialRequests = '',
      paidBy = 'MEMBER',
      guestName,
      guestContact,
    } = payload;

    // ── VALIDATION ───────────────────────────────────────────
    if (!membershipNo || !entityId || !bookingDate || !eventType || !eventTime)
      throw new BadRequestException('Required fields missing');

    const booking = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (booking < today)
      throw new ConflictException('Booking date cannot be in past');

    // Resolve End Date
    const endDate = endDateInput ? new Date(endDateInput) : new Date(booking);
    if (endDate < booking) {
      throw new BadRequestException('End Date cannot be before Start Date');
    }

    const diffTime = Math.abs(endDate.getTime() - booking.getTime());
    const numberOfDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // ── BOOKING DETAILS NORMALIZATION ──
    const bookingDetailsIn = payload.bookingDetails || [];
    const normalizedDetails: { date: Date; timeSlot: string; eventType?: string }[] = [];

    const normalizedEventTime = eventTime.toUpperCase() as
      | 'MORNING'
      | 'EVENING'
      | 'NIGHT';
    if (!['MORNING', 'EVENING', 'NIGHT'].includes(normalizedEventTime))
      throw new BadRequestException('Invalid event time');

    if (bookingDetailsIn && bookingDetailsIn.length > 0) {
      for (const detail of bookingDetailsIn) {
        const dDate = new Date(detail.date);
        dDate.setHours(0, 0, 0, 0);
        normalizedDetails.push({
          date: dDate,
          timeSlot: detail.timeSlot,
          eventType: detail.eventType || eventType,
        });
      }
    } else {
      for (let i = 0; i < numberOfDays; i++) {
        const currentCheckDate = new Date(booking);
        currentCheckDate.setDate(booking.getDate() + i);
        currentCheckDate.setHours(0, 0, 0, 0);
        normalizedDetails.push({
          date: currentCheckDate,
          timeSlot: normalizedEventTime,
          eventType: eventType,
        });
      }
    }

    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: membershipNo.toString() },
    });
    if (!member) throw new NotFoundException('Member not found');


    // ── PROCESS IN TRANSACTION ───────────────────────────────
    return await this.prismaService.$transaction(async (prisma) => {
      const hall = await prisma.hall.findFirst({
        where: { id: Number(entityId) },
        include: { outOfOrders: true },
      });
      if (!hall) throw new NotFoundException('Hall not found');

      // (Replaced below with granular check)
      // Check holdings
      // const hallHold: any = await prisma.hallHoldings.findFirst({ ... });
      // if (hallHold) throw new ConflictException('Hall is currently on hold');

      // ── CONFLICT CHECKS (Granular) ─────────────────────────
      for (const detail of normalizedDetails) {
        const currentCheckDate = detail.date;
        const currentSlot = detail.timeSlot;

        // 1. Check Out of Order
        const outOfOrderConflict = hall.outOfOrders?.find((period) => {
          const start = new Date(period.startDate).setHours(0, 0, 0, 0);
          const end = new Date(period.endDate).setHours(0, 0, 0, 0);
          return (currentCheckDate.getTime() >= start && currentCheckDate.getTime() <= end);
        });
        if (outOfOrderConflict) {
          throw new ConflictException(`Hall '${hall.name}' out of order on ${currentCheckDate.toDateString()}`);
        }

        // 2. Check Existing Bookings
        const existingBooking = await prisma.hallBooking.findFirst({
          where: {
            hallId: hall.id,
            bookingDate: { lte: currentCheckDate },
            endDate: { gte: currentCheckDate },
          },
        });

        if (existingBooking) {
          const details = existingBooking.bookingDetails as any[];
          let hasConflict = false;
          if (details && Array.isArray(details) && details.length > 0) {
            const conflict = details.find((d: any) => {
              const dDate = new Date(d.date);
              dDate.setHours(0, 0, 0, 0);
              return dDate.getTime() === currentCheckDate.getTime() && d.timeSlot === currentSlot;
            });
            if (conflict) hasConflict = true;
          } else {
            if (existingBooking.bookingTime === currentSlot) hasConflict = true;
          }

          if (hasConflict) {
            throw new ConflictException(`Hall already booked for ${currentSlot} on ${currentCheckDate.toDateString()}`);
          }
        }

        // 3. Check Reservations (Inclusive of the day)
        const dayStart = new Date(currentCheckDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentCheckDate);
        dayEnd.setHours(23, 59, 59, 999);

        const conflictingReservation = await prisma.hallReservation.findFirst({
          where: {
            hallId: hall.id,
            timeSlot: currentSlot,
            reservedFrom: { lte: dayEnd },
            reservedTo: { gte: dayStart },
          },
        });

        if (conflictingReservation) {
          throw new ConflictException(
            `Hall reserved for ${currentSlot} on ${currentCheckDate.toDateString()}`,
          );
        }

        // 4. Check Holdings (Granular)
        const holding = await prisma.hallHoldings.findFirst({
          where: {
            hallId: hall.id,
            onHold: true,
            holdExpiry: { gt: new Date() },
            NOT: { holdBy: membershipNo.toString() },
            OR: [
              {
                fromDate: { lte: currentCheckDate },
                toDate: { gte: currentCheckDate },
                timeSlot: currentSlot,
              },
              {
                fromDate: null,
              }
            ]
          },
        });

        if (holding) {
          throw new ConflictException(
            `Hall is currently on hold for ${currentSlot} on ${currentCheckDate.toDateString()}`,
          );
        }
      }

      // ── PAYMENT CALCULATION ────────────────────────────────
      const basePrice =
        pricingType === 'member' ? hall.chargesMembers : hall.chargesGuests;
      const total = totalPrice ? Number(totalPrice) : Number(basePrice) * numberOfDays;
      let paid = 0,
        owed = total;

      let amountToBalance = 0;
      const isToBill = paymentStatus === 'TO_BILL';

      if (paymentStatus === 'PAID') {
        paid = total;
        owed = 0;
      } else if (paymentStatus === 'HALF_PAID') {
        paid = Number(paidAmount) || 0;
        if (paid <= 0 || paid >= total)
          throw new ConflictException(
            'For half-paid: paid amount must be >0 and <total',
          );
        owed = total - paid;
      }

      if (isToBill) {
        amountToBalance = owed;
        owed = 0;
      }

      // ── CREATE BOOKING ─────────────────────────────────────
      const booked = await prisma.hallBooking.create({
        data: {
          memberId: member.Sno,
          hallId: hall.id,
          bookingDate: booking,
          endDate: endDate,
          numberOfDays: numberOfDays,
          bookingDetails: normalizedDetails,
          totalPrice: total,
          paymentStatus: paymentStatus as any,
          pricingType,
          paidAmount: paid,
          pendingAmount: owed,
          eventType,
          bookingTime: normalizedEventTime,
          paidBy,
          guestName,
          guestContact: guestContact?.toString(),
        },
        include: { hall: { select: { name: true, capacity: true } } },
      });

      // ── CREATE HALL HOLDINGS (Mirrors Booking) ─────────────
      await prisma.hallHoldings.createMany({
        data: normalizedDetails.map((detail) => ({
          hallId: hall.id,
          onHold: true,
          fromDate: detail.date,
          toDate: detail.date,
          timeSlot: detail.timeSlot,
          holdExpiry: endDate,
          holdBy: membershipNo.toString(),
        })),
      });

      // ── UPDATE HALL STATUS ─────────────────────────────────
      if (booking.getTime() <= today.getTime() && endDate.getTime() >= today.getTime()) {
        await prisma.hall.update({
          where: { id: hall.id },
          data: {
            isBooked: true,
          },
        });
      }

      // ── UPDATE MEMBER LEDGER ───────────────────────────────
      await prisma.member.update({
        where: { Membership_No: membershipNo.toString() },
        data: {
          totalBookings: { increment: 1 },
          lastBookingDate: new Date(),
          bookingAmountPaid: { increment: Math.round(Number(paid)) },
          bookingAmountDue: { increment: Math.round(Number(owed)) },
          bookingBalance: { increment: Math.round(Number(paid) - Number(owed)) },
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });

      // ── CREATE PAYMENT VOUCHER ─────────────────────────────
      if (paid > 0) {
        const voucherType =
          paymentStatus === 'PAID'
            ? VoucherType.FULL_PAYMENT
            : VoucherType.HALF_PAYMENT;
        await prisma.paymentVoucher.create({
          data: {
            booking_type: 'HALL',
            booking_id: booked.id,
            membership_no: membershipNo.toString(),
            amount: paid,
            payment_mode: paymentMode as unknown as PaymentMode,
            voucher_type: voucherType,
            status: VoucherStatus.CONFIRMED,
            issued_by: 'member',
            remarks: this.formatHallBookingRemarks(hall.name, booking, endDate, eventType, normalizedDetails, normalizedEventTime) + (specialRequests ? ` | ${specialRequests}` : ''),
          },
        });
      }

      return {
        success: true,
        message: `Booked ${hall.name}`,
        booking: booked,
        totalAmount: total,
        paidAmount: paid,
        pendingAmount: owed,
      };
    });
  }

  async uBookingHallMember(payload: any) {
    const {
      id,
      membershipNo,
      entityId,
      bookingDate,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode = 'ONLINE',
      eventType,
      numberOfGuests,
      eventTime,
      paidBy = 'MEMBER',
      guestName,
      guestContact,
      remarks,
      endDate: endDateInput,
      bookingDetails: bookingDetailsIn,
    } = payload;

    if (
      !id ||
      !membershipNo ||
      !entityId ||
      !bookingDate ||
      !eventType ||
      !eventTime
    )
      throw new BadRequestException('Required fields missing');

    const booking = new Date(bookingDate);
    booking.setHours(0, 0, 0, 0);

    const existing = await this.prismaService.hallBooking.findUnique({
      where: { id: Number(id) },
      include: { hall: { include: { outOfOrders: true } }, member: true },
    });
    if (!existing) throw new NotFoundException('Hall booking not found');

    // Resolve End Date
    const endDate = endDateInput ? new Date(endDateInput) : new Date(booking);
    if (endDate < booking) {
      throw new BadRequestException('End Date cannot be before Start Date');
    }

    const diffTime = Math.abs(endDate.getTime() - booking.getTime());
    const numberOfDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    // ── BOOKING DETAILS NORMALIZATION ──
    const normalizedDetails: { date: Date; timeSlot: string; eventType?: string }[] = [];
    const normalizedEventTime = eventTime.toUpperCase() as
      | 'MORNING'
      | 'EVENING'
      | 'NIGHT';
    if (!['MORNING', 'EVENING', 'NIGHT'].includes(normalizedEventTime))
      throw new BadRequestException('Invalid event time');

    if (bookingDetailsIn && bookingDetailsIn.length > 0) {
      for (const detail of bookingDetailsIn) {
        const dDate = new Date(detail.date);
        dDate.setHours(0, 0, 0, 0);
        normalizedDetails.push({
          date: dDate,
          timeSlot: detail.timeSlot,
          eventType: detail.eventType || eventType,
        });
      }
    } else {
      for (let i = 0; i < numberOfDays; i++) {
        const currentCheckDate = new Date(booking);
        currentCheckDate.setDate(booking.getDate() + i);
        currentCheckDate.setHours(0, 0, 0, 0);
        normalizedDetails.push({
          date: currentCheckDate,
          timeSlot: normalizedEventTime,
          eventType: eventType,
        });
      }
    }

    const member = await this.prismaService.member.findFirst({
      where: { Membership_No: membershipNo },
    });
    if (!member) throw new NotFoundException('Member not found');

    // ── PROCESS IN TRANSACTION ───────────────────────────────
    return await this.prismaService.$transaction(async (prisma) => {
      const hall = await prisma.hall.findFirst({
        where: { id: Number(entityId) },
        include: { outOfOrders: true },
      });
      if (!hall) throw new BadRequestException('Hall not found');

      // ── CONFLICT CHECKS (Granular & Inclusive) ────────────
      for (const detail of normalizedDetails) {
        const currentCheckDate = detail.date;
        const currentSlot = detail.timeSlot;

        // 1. Check Out of Order
        const outOfOrderConflict = hall.outOfOrders?.find((period) => {
          const start = new Date(period.startDate).setHours(0, 0, 0, 0);
          const end = new Date(period.endDate).setHours(0, 0, 0, 0);
          return (currentCheckDate.getTime() >= start && currentCheckDate.getTime() <= end);
        });
        if (outOfOrderConflict) {
          throw new ConflictException(`Hall '${hall.name}' out of order on ${currentCheckDate.toDateString()}`);
        }

        // 2. Check Existing Bookings
        const confBooking = await prisma.hallBooking.findFirst({
          where: {
            hallId: hall.id,
            id: { not: Number(id) },
            bookingDate: { lte: currentCheckDate },
            endDate: { gte: currentCheckDate },
          },
        });

        if (confBooking) {
          const dArr = confBooking.bookingDetails as any[];
          let hasConflict = false;
          if (dArr && Array.isArray(dArr) && dArr.length > 0) {
            const conflictFound = dArr.find((d: any) => {
              const dDate = new Date(d.date);
              dDate.setHours(0, 0, 0, 0);
              return dDate.getTime() === currentCheckDate.getTime() && d.timeSlot === currentSlot;
            });
            if (conflictFound) hasConflict = true;
          } else {
            if (confBooking.bookingTime === currentSlot) hasConflict = true;
          }

          if (hasConflict) {
            throw new ConflictException(`Hall already booked for ${currentSlot} on ${currentCheckDate.toDateString()}`);
          }
        }

        // 3. Check Reservations (Inclusive of the day)
        const dayStart = new Date(currentCheckDate);
        dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(currentCheckDate);
        dayEnd.setHours(23, 59, 59, 999);

        const confReservation = await prisma.hallReservation.findFirst({
          where: {
            hallId: hall.id,
            timeSlot: currentSlot,
            reservedFrom: { lte: dayEnd },
            reservedTo: { gte: dayStart },
          },
        });

        if (confReservation) {
          throw new ConflictException(`Hall reserved for ${currentSlot} on ${currentCheckDate.toDateString()}`);
        }

        // 4. Check Holdings (Granular)
        const holding = await prisma.hallHoldings.findFirst({
          where: {
            hallId: hall.id,
            onHold: true,
            holdExpiry: { gt: new Date() },
            NOT: { holdBy: membershipNo.toString() },
            OR: [
              {
                fromDate: { lte: currentCheckDate },
                toDate: { gte: currentCheckDate },
                timeSlot: currentSlot,
              },
              {
                fromDate: null,
              }
            ]
          },
        });

        if (holding) {
          throw new ConflictException(
            `Hall is currently on hold for ${currentSlot} on ${currentCheckDate.toDateString()}`,
          );
        }
      }

      // ── PAYMENT CALCULATIONS ────────────────────────────────
      const currTotal = Number(existing.totalPrice);
      const currPaid = Number(existing.paidAmount);
      const currStatus = existing.paymentStatus as unknown as PaymentStatus;

      const basePrice = pricingType === 'member' ? hall.chargesMembers : hall.chargesGuests;
      const newTotal = totalPrice ? Number(totalPrice) : Number(basePrice);
      let newPaymentStatus = (paymentStatus as unknown as PaymentStatus) || currStatus;

      let newPaid = currPaid;
      if (newPaymentStatus === PaymentStatus.PAID) {
        newPaid = newTotal;
      } else if (newPaymentStatus === PaymentStatus.UNPAID) {
        newPaid = 0;
      } else {
        newPaid = paidAmount !== undefined ? Number(paidAmount) : currPaid;
      }

      let newOwed = newTotal - newPaid;

      // Handle TO_BILL adjustment
      let amountToBalance = 0;
      if (newPaymentStatus === PaymentStatus.TO_BILL) {
        amountToBalance = newOwed;
        newOwed = 0;
      }

      const refundAmount = await this.handleVoucherUpdateUnified(
        Number(id),
        'HALL',
        membershipNo,
        newTotal,
        newPaid,
        newPaymentStatus,
        currTotal,
        currPaid,
        currStatus,
        {
          hallName: hall.name,
          bookingDate: booking,
          endDate: endDate,
          eventTime: normalizedEventTime,
          eventType: eventType,
          bookingDetails: normalizedDetails,
          remarks: remarks,
        },
        (paymentMode as unknown as PaymentMode) || PaymentMode.ONLINE,
        'member'
      );

      const paidDiff = newPaid - currPaid;
      const owedDiff = newOwed - (currTotal - currPaid);

      // ── CREATE/UPDATE HALL HOLDINGS ───────────────────────
      await prisma.hallHoldings.deleteMany({
        where: {
          hallId: hall.id,
          holdBy: existing.member.Membership_No,
        },
      });

      await prisma.hallHoldings.createMany({
        data: normalizedDetails.map((detail) => ({
          hallId: hall.id,
          onHold: true,
          fromDate: detail.date,
          toDate: detail.date,
          timeSlot: detail.timeSlot,
          holdExpiry: endDate,
          holdBy: membershipNo.toString(),
        })),
      });

      const updated = await prisma.hallBooking.update({
        where: { id: Number(id) },
        data: {
          hallId: hall.id,
          memberId: member.Sno,
          bookingDate: booking,
          endDate: endDate,
          numberOfDays: numberOfDays,
          bookingDetails: normalizedDetails,
          totalPrice: newTotal,
          paymentStatus: newPaymentStatus,
          pricingType,
          paidAmount: newPaid,
          pendingAmount: newOwed,
          numberOfGuests: Number(numberOfGuests!),
          eventType,
          bookingTime: normalizedEventTime,
          paidBy,
          guestName,
          guestContact: guestContact?.toString(),
          refundAmount,
          refundReturned: false,
        } as any,
      });

      // ── UPDATE HALL STATUS ─────────────────────────────────
      const nowTs = new Date().getTime();
      const isWithinRange = nowTs >= booking.getTime() && nowTs <= endDate.getTime();
      const wasWithinRange = nowTs >= existing.bookingDate.getTime() && nowTs <= (existing.endDate || existing.bookingDate).getTime();

      if (isWithinRange && !wasWithinRange) {
        await prisma.hall.update({
          where: { id: hall.id },
          data: { isBooked: true },
        });
      } else if (wasWithinRange && !isWithinRange) {
        await prisma.hall.update({
          where: { id: hall.id },
          data: { isBooked: false },
        });
      }

      // ── UPDATE MEMBER LEDGER ───────────────────────────────
      if (paidDiff !== 0 || owedDiff !== 0 || amountToBalance !== 0) {
        await prisma.member.update({
          where: { Membership_No: membershipNo },
          data: {
            bookingAmountPaid: { increment: Math.round(Number(paidDiff)) },
            bookingAmountDue: { increment: Math.round(Number(owedDiff)) },
            bookingBalance: { increment: Math.round(Number(paidDiff) - Number(owedDiff)) },
            lastBookingDate: new Date(),
            Balance: { increment: Math.round(amountToBalance) },
            drAmount: { increment: Math.round(amountToBalance) },
          },
        });
      }

      return {
        success: true,
        message: 'Hall booking updated',
        booking: updated,
        refundAmount,
      };
    });
  }

  async dBookingHall(bookingId: number) {
    return await this.prismaService.hallBooking.delete({
      where: { id: bookingId },
    });
  }

  // lawn booking
  async gBookingsLawn() {
    return await this.prismaService.lawnBooking.findMany({
      orderBy: { bookingDate: 'desc' },
      include: {
        lawn: { include: { lawnCategory: true } },
        member: {
          select: { Membership_No: true, Name: true },
        },
      },
    });
  }
  async cBookingLawn(payload: BookingDto) {
    const {
      membershipNo,
      entityId,
      bookingDate,
      endDate: endDateInput,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode,
      numberOfGuests,
      eventTime,
      paidBy = 'MEMBER',
      guestName,
      guestContact,
      eventType,
    } = payload;

    // ── VALIDATION ───────────────────────────────────────────
    if (!membershipNo || !entityId || !bookingDate || !numberOfGuests || !eventType)
      throw new BadRequestException('Required fields missing');

    const booking = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (booking < today)
      throw new UnprocessableEntityException('Booking date cannot be in past');

    // Resolve End Date and Days
    const endDate = endDateInput ? new Date(endDateInput) : new Date(booking);
    if (endDate < booking) {
      throw new BadRequestException('End Date cannot be before Start Date');
    }
    const diffTime = Math.abs(endDate.getTime() - booking.getTime());
    const numberOfDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;

    const member = await this.prismaService.member.findFirst({
      where: { Membership_No: membershipNo },
    });
    if (!member) throw new BadRequestException('Member not found');

    const lawn = await this.prismaService.lawn.findFirst({
      where: { id: Number(entityId) },
      include: { outOfOrders: { orderBy: { startDate: 'asc' } } },
    });
    if (!lawn) throw new BadRequestException('Lawn not found');
    if (!lawn.isActive) throw new ConflictException('Lawn is not active');

    // Check holdings
    const lawnHold = await this.prismaService.lawnHoldings.findFirst({
      where: { lawnId: lawn.id, onHold: true, holdExpiry: { gt: new Date() } },
    });
    if (lawnHold) throw new ConflictException('Lawn is currently on hold');

    // ── CONFLICT CHECKS (Multi-Day) ─────────────────────────
    for (let i = 0; i < numberOfDays; i++) {
      const currentCheckDate = new Date(booking);
      currentCheckDate.setDate(booking.getDate() + i);
      currentCheckDate.setHours(0, 0, 0, 0);

      const currentSlot = eventTime as BookingOpt || 'NIGHT';

      // 1. Out of Order Check
      const outOfOrderConflict = lawn.outOfOrders?.find((period) => {
        const start = new Date(period.startDate).setHours(0, 0, 0, 0);
        const end = new Date(period.endDate).setHours(0, 0, 0, 0);
        const checkTime = currentCheckDate.getTime();
        return checkTime >= start && checkTime <= end;
      });

      if (outOfOrderConflict) {
        const start = new Date(outOfOrderConflict.startDate);
        const isScheduled = start > today;
        throw new ConflictException(
          `Lawn '${lawn.description}' ${isScheduled ? 'has scheduled maintenance' : 'is out of service'} on ${currentCheckDate.toDateString()}`
        );
      }

      // 2. Existing Booking Check (Overlap with range)
      // Check if ANY existing booking covers this specific date and time slot
      const conflictingBooking = await this.prismaService.lawnBooking.findFirst({
        where: {
          lawnId: lawn.id,
          bookingDate: { lte: currentCheckDate },
          // Prior to migration, endDate didn't exist, defaulting to bookingDate in logic implies single day.
          // After migration, we assume endDate is populated or we use logic to handle fallback.
          // For now, assume schema has endDate.
          endDate: { gte: currentCheckDate },
          bookingTime: currentSlot,
        },
      });

      if (conflictingBooking) {
        throw new ConflictException(
          `Lawn '${lawn.description}' already booked for ${currentSlot} on ${currentCheckDate.toDateString()}`
        );
      }

      // 3. Reservation Check
      const dayStart = new Date(currentCheckDate);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(currentCheckDate);
      dayEnd.setHours(23, 59, 59, 999);

      const reservation = await this.prismaService.lawnReservation.findFirst({
        where: {
          lawnId: lawn.id,
          reservedFrom: { lte: dayEnd },
          reservedTo: { gte: dayStart },
          // Lawn Reservation also has timeSlot? Yes, line 538 in schema.
          timeSlot: currentSlot,
        },
      });

      if (reservation) {
        throw new ConflictException(
          `Lawn reserved for ${currentSlot} on ${currentCheckDate.toDateString()}`
        );
      }
    }

    // ── CAPACITY CHECK ───────────────────────────────────────
    if (numberOfGuests < (lawn.minGuests || 0))
      throw new ConflictException(
        `Guests (${numberOfGuests}) below minimum ${lawn.minGuests}`,
      );
    if (numberOfGuests > lawn.maxGuests)
      throw new ConflictException(
        `Guests (${numberOfGuests}) exceeds maximum ${lawn.maxGuests}`,
      );

    // ── PAYMENT CALCULATION ──────────────────────────────────
    const basePrice =
      pricingType === 'member' ? lawn.memberCharges : lawn.guestCharges;

    // Total price logic: if totalPrice provided, use it. Else basePrice * days? 
    // In Hall, it was basePrice * days if not provided. Here Lawns might charge per event. 
    // Usually lawn price is per event. If multiday event, price multiplies?
    // User didn't specify. Assuming price multiplies by days if not manual.
    // Hall logic: const total = totalPrice ? Number(totalPrice) : Number(basePrice) * numberOfDays;
    // Lawn logic (original): const total = totalPrice ? Number(totalPrice) : Number(basePrice);
    // I will adopt Hall logic for consistency in Multi-day.
    const total = totalPrice
      ? Number(totalPrice)
      : Number(basePrice) * numberOfDays;

    let paid = 0,
      owed = total;

    let amountToBalance = 0;
    const isToBill = (paymentStatus as unknown as string) === 'TO_BILL';

    if ((paymentStatus as unknown as PaymentStatus) === 'PAID') {
      paid = total;
      owed = 0;
    } else if ((paymentStatus as unknown as PaymentStatus) === 'HALF_PAID') {
      paid = Number(paidAmount) || 0;
      if (paid <= 0 || paid >= total)
        throw new ConflictException(
          'For half-paid: paid amount must be >0 and <total',
        );
      owed = total - paid;
    }

    if (isToBill) {
      amountToBalance = owed;
      owed = 0;
    }

    // ── CREATE BOOKING ───────────────────────────────────────
    const booked = await this.prismaService.lawnBooking.create({
      data: {
        memberId: member.Sno,
        lawnId: lawn.id,
        bookingDate: booking,
        endDate: endDate,
        numberOfDays: numberOfDays,
        guestsCount: numberOfGuests!,
        totalPrice: total,
        paymentStatus: paymentStatus as any,
        pricingType,
        paidAmount: paid,
        pendingAmount: owed,
        bookingTime: eventTime as BookingOpt,
        paidBy,
        guestName,
        guestContact: guestContact?.toString(),
        eventType,
      },
    });

    // ── UPDATE LAWN STATUS ───────────────────────────────────
    const updateData: any = { onHold: false, holdBy: null, holdExpiry: null };
    if (booking.getTime() === today.getTime()) updateData.isBooked = true;

    await this.prismaService.lawn.update({
      where: { id: lawn.id },
      data: updateData,
    });

    // ── UPDATE MEMBER LEDGER ─────────────────────────────────
    await this.prismaService.member.update({
      where: { Membership_No: membershipNo },
      data: {
        totalBookings: { increment: 1 },
        lastBookingDate: new Date(),
        bookingAmountPaid: { increment: Math.round(Number(paid)) },
        bookingAmountDue: { increment: Math.round(Number(owed)) },
        bookingBalance: { increment: Math.round(Number(paid) - Number(owed)) },
        Balance: { increment: Math.round(amountToBalance) },
        drAmount: { increment: Math.round(amountToBalance) },
      },
    });

    // ── CREATE PAYMENT VOUCHER ───────────────────────────────
    if (paid > 0) {
      const voucherType =
        (paymentStatus as unknown as PaymentStatus) === 'PAID'
          ? VoucherType.FULL_PAYMENT
          : VoucherType.HALF_PAYMENT;
      await this.prismaService.paymentVoucher.create({
        data: {
          booking_type: 'LAWN',
          booking_id: booked.id,
          membership_no: membershipNo,
          amount: paid,
          payment_mode: paymentMode as any,
          voucher_type: voucherType,
          status: VoucherStatus.CONFIRMED,
          issued_by: 'admin',
          remarks: `${lawn.description} | ${formatPakistanDate(booking)} | ${eventTime} | ${numberOfGuests} guests`,
        },
      });
    }

    return {
      ...booked,
      lawnName: lawn.description,
      outOfOrderPeriods: lawn.outOfOrders.map((period) => ({
        dates: `${new Date(period.startDate).toLocaleDateString()} - ${new Date(period.endDate).toLocaleDateString()}`,
        reason: period.reason,
      })),
    };
  }
  async uBookingLawn(payload: Partial<BookingDto>) {
    const {
      id,
      membershipNo,
      entityId,
      bookingDate,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode = 'CASH',
      numberOfGuests,
      eventTime,
      paidBy = 'MEMBER',
      guestName,
      guestContact,
      remarks,
      eventType,
    } = payload;

    if (
      !id ||
      !membershipNo ||
      !entityId ||
      !bookingDate ||
      !numberOfGuests ||
      !eventTime ||
      !eventType
    )
      throw new BadRequestException('Required fields missing');

    const existing = await this.prismaService.lawnBooking.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) throw new NotFoundException('Lawn booking not found');

    const member = await this.prismaService.member.findFirst({
      where: { Membership_No: membershipNo },
    });
    if (!member) throw new NotFoundException('Member not found');

    // ── PROCESS IN TRANSACTION ───────────────────────────────
    return await this.prismaService.$transaction(async (prisma) => {
      const lawn = await prisma.lawn.findFirst({
        where: { id: Number(entityId) },
        include: { outOfOrders: true },
      });
      if (!lawn) throw new NotFoundException('Lawn not found');

      // ── VALIDATION CHECKS ──────────────────────────────────
      const bookingDateObj = new Date(bookingDate);
      bookingDateObj.setHours(0, 0, 0, 0);

      const outOfOrderConflict = lawn.outOfOrders?.find((period) => {
        const start = new Date(period.startDate).setHours(0, 0, 0, 0);
        const end = new Date(period.endDate).setHours(0, 0, 0, 0);
        return (
          bookingDateObj.getTime() >= start && bookingDateObj.getTime() <= end
        );
      });
      if (outOfOrderConflict)
        throw new ConflictException('Lawn out of service');

      const normalizedEventTime = eventTime.toUpperCase() as
        | 'MORNING'
        | 'EVENING'
        | 'NIGHT';

      const conflictingBooking = await prisma.lawnBooking.findFirst({
        where: {
          lawnId: lawn.id,
          id: { not: Number(id) },
          bookingDate: bookingDateObj,
          bookingTime: normalizedEventTime,
        },
      });
      if (conflictingBooking)
        throw new ConflictException('Lawn already booked');

      if (numberOfGuests < (lawn.minGuests || 0))
        throw new ConflictException(`Guests below minimum ${lawn.minGuests}`);
      if (numberOfGuests > lawn.maxGuests)
        throw new ConflictException(`Guests exceeds maximum ${lawn.maxGuests}`);

      // ── PAYMENT CALCULATIONS ────────────────────────────────
      const currTotal = Number(existing.totalPrice);
      const currPaid = Number(existing.paidAmount);
      const currStatus = existing.paymentStatus as unknown as PaymentStatus;

      const basePrice = pricingType === 'member' ? lawn.memberCharges : lawn.guestCharges;
      const newTotal = totalPrice ? Number(totalPrice) : Number(basePrice);
      let newPaymentStatus = (paymentStatus as unknown as PaymentStatus) || currStatus;

      let newPaid = currPaid;
      if (newPaymentStatus === PaymentStatus.PAID) {
        newPaid = newTotal;
      } else if (newPaymentStatus === PaymentStatus.UNPAID) {
        newPaid = 0;
      } else {
        newPaid = paidAmount !== undefined ? Number(paidAmount) : currPaid;
      }

      let newOwed = newTotal - newPaid;
      let amountToBalance = 0;
      if (newPaymentStatus === PaymentStatus.TO_BILL) {
        amountToBalance = newOwed;
        newOwed = 0;
      }

      const refundAmount = await this.handleVoucherUpdateUnified(
        Number(id),
        'LAWN',
        membershipNo,
        newTotal,
        newPaid,
        newPaymentStatus,
        currTotal,
        currPaid,
        currStatus,
        {
          lawnName: lawn.description,
          bookingDate: bookingDateObj,
          eventTime: normalizedEventTime,
          remarks: remarks,
        },
        PaymentMode.CASH,
        'admin'
      );

      const paidDiff = newPaid - currPaid;
      const owedDiff = newOwed - (currTotal - currPaid);

      // ── UPDATE BOOKING ─────────────────────────────────────
      const updated = await prisma.lawnBooking.update({
        where: { id: Number(id) },
        data: {
          lawnId: lawn.id,
          memberId: member.Sno,
          bookingDate: bookingDateObj,
          totalPrice: newTotal,
          paymentStatus: newPaymentStatus,
          pricingType,
          paidAmount: newPaid,
          pendingAmount: newOwed,
          guestsCount: Number(numberOfGuests),
          bookingTime: normalizedEventTime,
          paidBy,
          guestName,
          guestContact: guestContact?.toString(),
          eventType,
          refundAmount,
          refundReturned: false,
        },
      });

      // ── UPDATE MEMBER LEDGER ───────────────────────────────
      if (paidDiff !== 0 || owedDiff !== 0 || amountToBalance !== 0) {
        await prisma.member.update({
          where: { Membership_No: membershipNo },
          data: {
            bookingAmountPaid: { increment: Math.round(Number(paidDiff)) },
            bookingAmountDue: { increment: Math.round(Number(owedDiff)) },
            bookingBalance: { increment: Math.round(Number(paidDiff) - Number(owedDiff)) },
            lastBookingDate: new Date(),
            Balance: { increment: Math.round(amountToBalance) },
            drAmount: { increment: Math.round(amountToBalance) },
          },
        });
      }

      return {
        success: true,
        message: 'Lawn booking updated',
        booking: updated,
        refundAmount,
      };
    });
  }


  async dBookingLawn(bookingId) { }

  // member lawn booking
  async cBookingLawnMember(payload: any) {
    const {
      membershipNo,
      entityId,
      bookingDate,
      totalPrice,
      paymentStatus = 'PAID',
      pricingType,
      paidAmount,
      paymentMode = 'ONLINE',
      numberOfGuests,
      eventTime,
      specialRequests = '',
      paidBy = 'MEMBER',
      guestName,
      guestContact,
      eventType,
    } = payload;

    console.log(payload)

    // ── VALIDATION ───────────────────────────────────────────
    if (
      !membershipNo ||
      !entityId ||
      !bookingDate ||
      !numberOfGuests ||
      !eventTime
    )
      throw new BadRequestException('Required fields missing');

    const booking = new Date(bookingDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (booking < today)
      throw new ConflictException('Booking date cannot be in past');

    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: membershipNo.toString() },
    });
    if (!member) throw new NotFoundException('Member not found');

    const normalizedEventTime = eventTime.toUpperCase() as
      | 'MORNING'
      | 'EVENING'
      | 'NIGHT';
    if (!['MORNING', 'EVENING', 'NIGHT'].includes(normalizedEventTime))
      throw new BadRequestException('Invalid event time');

    // ── PROCESS IN TRANSACTION ───────────────────────────────
    return await this.prismaService.$transaction(async (prisma) => {
      const lawn = await prisma.lawn.findFirst({
        where: { id: Number(entityId) },
        include: { outOfOrders: { orderBy: { startDate: 'asc' } } },
      });
      if (!lawn) throw new NotFoundException('Lawn not found');
      if (!lawn.isActive) throw new ConflictException('Lawn is not active');

      // Check holdings
      const lawnHold = await prisma.lawnHoldings.findFirst({
        where: {
          lawnId: lawn.id,
          onHold: true,
          holdExpiry: { gt: new Date() },
          NOT: { holdBy: member.Membership_No }
        },
      });
      if (lawnHold) throw new ConflictException('Lawn is currently on hold');

      // ── OUT OF ORDER CHECK ─────────────────────────────────
      const outOfOrderConflict = lawn.outOfOrders?.find((period) => {
        const start = new Date(period.startDate).setHours(0, 0, 0, 0);
        const end = new Date(period.endDate).setHours(0, 0, 0, 0);
        const bookingDate = booking.getTime();
        return bookingDate >= start && bookingDate <= end;
      });

      if (outOfOrderConflict) {
        const start = new Date(outOfOrderConflict.startDate);
        const end = new Date(outOfOrderConflict.endDate);
        const isScheduled = start > today;
        throw new ConflictException(
          `Lawn '${lawn.description}' ${isScheduled ? 'has scheduled maintenance' : 'is out of service'} from ${start.toLocaleDateString()} to ${end.toLocaleDateString()}`,
        );
      }

      // ── CAPACITY CHECK ─────────────────────────────────────
      if (numberOfGuests < (lawn.minGuests || 0))
        throw new ConflictException(
          `Guests (${numberOfGuests}) below minimum ${lawn.minGuests}`,
        );
      if (numberOfGuests > lawn.maxGuests)
        throw new ConflictException(
          `Guests (${numberOfGuests}) exceeds maximum ${lawn.maxGuests}`,
        );

      // ── CONFLICT CHECK ─────────────────────────────────────
      const conflictingBooking = await prisma.lawnBooking.findFirst({
        where: {
          lawnId: lawn.id,
          bookingDate: booking,
          bookingTime: normalizedEventTime,
        },
      });
      if (conflictingBooking)
        throw new ConflictException(
          `Lawn '${lawn.description}' already booked`,
        );

      // ── PAYMENT CALCULATION ────────────────────────────────
      const basePrice =
        pricingType === 'member' ? lawn.memberCharges : lawn.guestCharges;
      const total = totalPrice ? Number(totalPrice) : Number(basePrice);
      let paid = 0,
        owed = total;

      let amountToBalance = 0;
      const isToBill = paymentStatus === 'TO_BILL';

      if (paymentStatus === 'PAID') {
        paid = total;
        owed = 0;
      } else if (paymentStatus === 'HALF_PAID') {
        paid = Number(paidAmount) || 0;
        if (paid <= 0 || paid >= total)
          throw new ConflictException(
            'For half-paid: paid amount must be >0 and <total',
          );
        owed = total - paid;
      }

      if (isToBill) {
        amountToBalance = owed;
        owed = 0;
      }

      // ── CREATE BOOKING ─────────────────────────────────────
      const booked = await prisma.lawnBooking.create({
        data: {
          memberId: member.Sno,
          lawnId: lawn.id,
          bookingDate: booking,
          guestsCount: numberOfGuests!,
          totalPrice: total,
          paymentStatus: paymentStatus as any,
          pricingType,
          paidAmount: paid,
          pendingAmount: owed,
          bookingTime: normalizedEventTime,
          paidBy,
          guestName,
          guestContact: guestContact?.toString(),
          eventType,
        },
        include: {
          lawn: {
            select: { description: true, minGuests: true, maxGuests: true },
          },
        },
      });

      // ── UPDATE LAWN STATUS ─────────────────────────────────
      const updateData: any = { onHold: false, holdBy: null, holdExpiry: null };
      if (booking.getTime() === today.getTime()) updateData.isBooked = true;

      // ── UPDATE MEMBER LEDGER ───────────────────────────────
      await prisma.member.update({
        where: { Membership_No: membershipNo.toString() },
        data: {
          totalBookings: { increment: 1 },
          lastBookingDate: new Date(),
          bookingAmountPaid: { increment: Math.round(Number(paid)) },
          bookingAmountDue: { increment: Math.round(Number(owed)) },
          bookingBalance: { increment: Math.round(Number(paid) - Number(owed)) },
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });

      // ── CREATE PAYMENT VOUCHER ─────────────────────────────
      if (paid > 0) {
        const voucherType =
          paymentStatus === 'PAID'
            ? VoucherType.FULL_PAYMENT
            : VoucherType.HALF_PAYMENT;
        await prisma.paymentVoucher.create({
          data: {
            booking_type: 'LAWN',
            booking_id: booked.id,
            membership_no: membershipNo.toString(),
            amount: paid,
            payment_mode: paymentMode as unknown as PaymentMode,
            voucher_type: voucherType,
            status: VoucherStatus.CONFIRMED,
            issued_by: 'member',
            remarks: `${lawn.description} | ${formatPakistanDate(booking)} | ${normalizedEventTime} | ${numberOfGuests} guests${specialRequests ? ` | ${specialRequests}` : ''}`,
          },
        });
      }

      // remove onhold
      await this.prismaService.lawnHoldings.deleteMany({
        where: { lawnId: booked.lawnId }
      })
      console.log("::::", booked)

      return {
        success: true,
        message: `Booked ${lawn.description}`,
        booking: booked,
        totalAmount: total,
        paidAmount: paid,
        pendingAmount: owed,
        capacity: { minGuests: lawn.minGuests, maxGuests: lawn.maxGuests },
        outOfOrderPeriods: lawn.outOfOrders.map((period) => ({
          dates: `${new Date(period.startDate).toLocaleDateString()} - ${new Date(period.endDate).toLocaleDateString()}`,
          reason: period.reason,
        })),
      };
    });
  }

  async uBookingLawnMember(payload: any) {
    const {
      id,
      membershipNo,
      entityId,
      bookingDate,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode = 'ONLINE',
      numberOfGuests,
      eventTime,
      specialRequests = '',
      paidBy = 'MEMBER',
      guestName,
      guestContact,
      remarks,
      eventType,
    } = payload;

    if (
      !id ||
      !membershipNo ||
      !entityId ||
      !bookingDate ||
      !numberOfGuests ||
      !eventTime
    )
      throw new BadRequestException('Required fields missing');

    const booking = new Date(bookingDate);
    booking.setHours(0, 0, 0, 0);

    const existing = await this.prismaService.lawnBooking.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) throw new NotFoundException('Lawn booking not found');

    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: membershipNo },
    });
    if (!member) throw new NotFoundException('Member not found');

    const lawn = await this.prismaService.lawn.findFirst({
      where: { id: Number(entityId) },
      include: { outOfOrders: true },
    });
    if (!lawn) throw new NotFoundException('Lawn not found');

    // ── VALIDATION CHECKS ────────────────────────────────────
    const outOfOrderConflict = lawn.outOfOrders?.find((period) => {
      const start = new Date(period.startDate).setHours(0, 0, 0, 0);
      const end = new Date(period.endDate).setHours(0, 0, 0, 0);
      return booking.getTime() >= start && booking.getTime() <= end;
    });
    if (outOfOrderConflict) throw new ConflictException('Lawn out of service');

    const normalizedEventTime = eventTime.toUpperCase() as
      | 'MORNING'
      | 'EVENING'
      | 'NIGHT';

    const conflictingBooking = await this.prismaService.lawnBooking.findFirst({
      where: {
        lawnId: lawn.id,
        id: { not: Number(id) },
        bookingDate: booking,
        bookingTime: normalizedEventTime,
      },
    });
    if (conflictingBooking) throw new ConflictException('Lawn already booked');

    if (numberOfGuests < (lawn.minGuests || 0))
      throw new ConflictException(`Guests below minimum ${lawn.minGuests}`);
    if (numberOfGuests > lawn.maxGuests)
      throw new ConflictException(`Guests exceeds maximum ${lawn.maxGuests}`);

    // ── PAYMENT CALCULATIONS ────────────────────────────────
    const currTotal = Number(existing.totalPrice);
    const currPaid = Number(existing.paidAmount);
    const currStatus = existing.paymentStatus as unknown as PaymentStatus;

    const basePrice = pricingType === 'member' ? lawn.memberCharges : lawn.guestCharges;
    const newTotal = totalPrice ? Number(totalPrice) : Number(basePrice);
    let newPaymentStatus = (paymentStatus as unknown as PaymentStatus) || currStatus;

    let newPaid = currPaid;
    if (newPaymentStatus === PaymentStatus.PAID) {
      newPaid = newTotal;
    } else if (newPaymentStatus === PaymentStatus.UNPAID) {
      newPaid = 0;
    } else {
      newPaid = paidAmount !== undefined ? Number(paidAmount) : currPaid;
    }

    let newOwed = newTotal - newPaid;

    let amountToBalance = 0;
    if (newPaymentStatus === PaymentStatus.TO_BILL) {
      amountToBalance = newOwed;
      newOwed = 0;
    }

    const refundAmount = await this.handleVoucherUpdateUnified(
      Number(id),
      'LAWN',
      membershipNo,
      newTotal,
      newPaid,
      newPaymentStatus,
      currTotal,
      currPaid,
      currStatus,
      {
        lawnName: lawn.description,
        bookingDate: booking,
        eventTime: normalizedEventTime,
        remarks: remarks,
      },
      (paymentMode as any) || PaymentMode.ONLINE,
      'member'
    );

    const paidDiff = newPaid - currPaid;
    const owedDiff = newOwed - (currTotal - currPaid);

    // ── UPDATE BOOKING ───────────────────────────────────────
    const updated = await this.prismaService.lawnBooking.update({
      where: { id: Number(id) },
      data: {
        lawnId: lawn.id,
        memberId: member.Sno,
        bookingDate: booking,
        totalPrice: newTotal,
        paymentStatus: newPaymentStatus,
        pricingType,
        paidAmount: newPaid,
        pendingAmount: newOwed,
        guestsCount: Number(numberOfGuests),
        bookingTime: normalizedEventTime,
        paidBy,
        guestName,
        guestContact: guestContact?.toString(),
        eventType,
        refundAmount,
        refundReturned: false,
      },
    });

    // ── UPDATE MEMBER LEDGER ─────────────────────────────────
    if (paidDiff !== 0 || owedDiff !== 0 || amountToBalance !== 0) {
      await this.prismaService.member.update({
        where: { Membership_No: membershipNo },
        data: {
          bookingAmountPaid: { increment: Math.round(Number(paidDiff)) },
          bookingAmountDue: { increment: Math.round(Number(owedDiff)) },
          bookingBalance: { increment: Math.round(Number(paidDiff) - Number(owedDiff)) },
          lastBookingDate: new Date(),
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });
    }

    return {
      success: true,
      message: 'Lawn booking updated',
      booking: updated,
      refundAmount,
    };
  }

  // helper methods
  private isCurrentlyOutOfOrder(outOfOrders: any[]): boolean {
    if (!outOfOrders || outOfOrders.length === 0) return false;

    const now = new Date();
    return outOfOrders.some((period) => {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      return start <= now && end >= now;
    });
  }

  private getCurrentOutOfOrderPeriod(outOfOrders: any[]): any | null {
    if (!outOfOrders || outOfOrders.length === 0) return null;

    const now = new Date();
    return outOfOrders.find((period) => {
      const start = new Date(period.startDate);
      const end = new Date(period.endDate);
      return start <= now && end >= now;
    });
  }

  private hasScheduledMaintenance(outOfOrders: any[]): boolean {
    if (!outOfOrders || outOfOrders.length === 0) return false;

    const now = new Date();
    return outOfOrders.some((period) => {
      const start = new Date(period.startDate);
      return start > now;
    });
  }

  // photoshoot booking

  async cBookingPhotoshoot(payload: BookingDto) {
    const {
      membershipNo,
      entityId,
      checkIn,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode,
      timeSlot,
      paidBy = 'MEMBER',
      guestName,
      guestContact,
    } = payload;

    // 1. Validate Member
    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: membershipNo },
    });
    if (!member) throw new NotFoundException('Member not found');

    // 2. Validate Photoshoot Service
    const photoshoot = await this.prismaService.photoshoot.findUnique({
      where: { id: Number(entityId) },
    });
    if (!photoshoot)
      throw new NotFoundException('Photoshoot service not found');

    // 3. Validate Date and Time
    if (!timeSlot) throw new BadRequestException('Time slot is required');

    // FIXED: Proper datetime parsing
    const startTime = new Date(timeSlot);

    // Validate the date is valid
    if (isNaN(startTime.getTime())) {
      throw new BadRequestException('Invalid time slot format');
    }

    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    // FIXED: Extract date part properly
    const bookingDate = new Date(startTime);

    const now = new Date();

    // Check if booking datetime is in the past
    if (startTime < now) {
      throw new ConflictException('Booking time cannot be in the past');
    }

    // Validate time slot is between 9am and 6pm (since booking is 2 hours, last slot ends at 8pm)
    const bookingHour = startTime.getHours();
    if (bookingHour < 9 && bookingHour > 6) {
      throw new BadRequestException(
        'Photoshoot bookings are only available between 9:00 AM and 6:00 PM',
      );
    }

    const total = Number(totalPrice);
    let paid = 0;
    let owed = total;

    let amountToBalance = 0;
    const isToBill = (paymentStatus as unknown as string) === 'TO_BILL';

    if (paymentStatus === (PaymentStatus.PAID as unknown)) {
      paid = total;
      owed = 0;
    } else if (paymentStatus === (PaymentStatus.HALF_PAID as unknown)) {
      paid = Number(paidAmount) || 0;
      if (paid <= 0)
        throw new ConflictException(
          'Paid amount must be greater than 0 for half-paid status',
        );
      if (paid >= total)
        throw new ConflictException(
          'Paid amount must be less than total for half-paid status',
        );
      owed = total - paid;
    } else if (isToBill) {
      paid = 0; // or Number(paidAmount) || 0 if partial payment is allowed with TO_BILL
      owed = total - paid;
      amountToBalance = owed;
      owed = 0;
    } else {
      paid = 0;
      owed = total;
    }

    // 5. Create Booking
    const booking = await this.prismaService.photoshootBooking.create({
      data: {
        memberId: member.Sno,
        photoshootId: photoshoot.id,
        bookingDate: bookingDate,
        startTime: startTime,
        endTime: endTime,
        totalPrice: total,
        paymentStatus: paymentStatus as unknown as PaymentStatus,
        pricingType,
        paidAmount: paid,
        pendingAmount: owed,
        paidBy,
        guestName,
        guestContact,
      },
    });

    // 6. Update Member Ledger
    await this.prismaService.member.update({
      where: { Sno: member.Sno },
      data: {
        totalBookings: { increment: 1 },
        lastBookingDate: new Date(),
        bookingAmountPaid: { increment: Math.round(Number(paid)) },
        bookingAmountDue: { increment: Math.round(Number(owed)) },
        bookingBalance: { increment: Math.round(Number(paid) - Number(owed)) },
        Balance: { increment: Math.round(amountToBalance) },
        drAmount: { increment: Math.round(amountToBalance) },
      },
    });

    // 7. Create Voucher
    if (paid > 0) {
      let voucherType: VoucherType | null = null;
      if (paymentStatus === (PaymentStatus.PAID as unknown))
        voucherType = VoucherType.FULL_PAYMENT;
      else if (paymentStatus === (PaymentStatus.HALF_PAID as unknown))
        voucherType = VoucherType.HALF_PAYMENT;

      await this.prismaService.paymentVoucher.create({
        data: {
          booking_type: 'PHOTOSHOOT',
          booking_id: booking.id,
          membership_no: membershipNo,
          amount: paid,
          payment_mode: paymentMode as unknown as PaymentMode,
          voucher_type: voucherType!,
          status: VoucherStatus.CONFIRMED,
          issued_by: 'admin',
          remarks: `Photoshoot | ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}`,
        },
      });
    }

    return booking;
  }

  async uBookingPhotoshoot(payload: Partial<BookingDto>) {
    const {
      id,
      membershipNo,
      entityId,
      checkIn,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode,
      timeSlot,
      paidBy = 'MEMBER',
      guestName,
      guestContact,
      remarks,
    } = payload;
    // 1. Fetch Existing Booking
    const booking = await this.prismaService.photoshootBooking.findUnique({
      where: { id: Number(id) },
      include: { member: true, photoshoot: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    // 2. Validate Date and Time
    let newStartTime = booking.startTime;
    let newBookingDate = booking.bookingDate;
    if (timeSlot) {
      newStartTime = parsePakistanDate(timeSlot);
      newBookingDate = new Date(newStartTime);
      newBookingDate.setHours(0, 0, 0, 0);
    } else if (checkIn) {
      const newDate = parsePakistanDate(checkIn);
      newStartTime = new Date(newDate);
      newStartTime.setHours(
        booking.startTime.getHours(),
        booking.startTime.getMinutes(),
        booking.startTime.getSeconds(),
        booking.startTime.getMilliseconds(),
      );
      newBookingDate = newDate;
    }
    const newEndTime = new Date(newStartTime.getTime() + 2 * 60 * 60 * 1000);
    const now = getPakistanDate();
    // Validate time slot is between 9am and 6pm (since booking is 2 hours, last slot ends at 8pm)
    const bookingHour = newStartTime.getHours();
    if (bookingHour < 9 && bookingHour > 6) {
      throw new BadRequestException(
        'Photoshoot bookings are only available between 9:00 AM and 6:00 PM',
      );
    }
    // 3. Calculate Amounts and Auto-Adjust Status
    // ── PAYMENT CALCULATIONS ────────────────────────────────
    const currTotal = Number(booking.totalPrice);
    const currPaid = Number(booking.paidAmount);
    const currStatus = booking.paymentStatus as unknown as PaymentStatus;

    const newTotal = totalPrice !== undefined ? Number(totalPrice) : currTotal;
    let newPaymentStatus = (paymentStatus as unknown as PaymentStatus) || currStatus;

    let newPaid = currPaid;
    if (newPaymentStatus === PaymentStatus.PAID) {
      newPaid = newTotal;
    } else if (newPaymentStatus === PaymentStatus.UNPAID) {
      newPaid = 0;
    } else {
      newPaid = paidAmount !== undefined ? Number(paidAmount) : currPaid;
    }

    let newOwed = newTotal - newPaid;
    let amountToBalance = 0;
    if (newPaymentStatus === PaymentStatus.TO_BILL) {
      amountToBalance = newOwed;
      newOwed = 0;
    }

    const refundAmount = await this.handleVoucherUpdateUnified(
      booking.id,
      'PHOTOSHOOT',
      booking.member.Membership_No,
      newTotal,
      newPaid,
      newPaymentStatus,
      currTotal,
      currPaid,
      currStatus,
      {
        photoshootDesc: booking.photoshoot.description,
        bookingDate: newBookingDate,
        eventTime: newStartTime.toLocaleTimeString(),
        remarks: remarks,
      },
      (paymentMode as unknown as PaymentMode) || PaymentMode.CASH,
      'admin'
    );

    const paidDiff = newPaid - currPaid;
    const owedDiff = newOwed - (currTotal - currPaid);
    // 4. Update Booking
    const updated = await this.prismaService.photoshootBooking.update({
      where: { id: booking.id },
      data: {
        memberId: booking.memberId,
        photoshootId: entityId ? Number(entityId) : booking.photoshootId,
        bookingDate: newBookingDate,
        startTime: newStartTime,
        endTime: newEndTime,
        totalPrice: newTotal,
        paymentStatus: newPaymentStatus,
        pricingType: pricingType ?? booking.pricingType,
        paidAmount: newPaid,
        pendingAmount: newOwed,
        refundAmount,
        paidBy,
        guestName,
        guestContact,
        refundReturned: false,
      },
    });
    // 5. Update Member Ledger
    if (paidDiff !== 0 || owedDiff !== 0 || amountToBalance !== 0) {
      await this.prismaService.member.update({
        where: { Sno: booking.memberId },
        data: {
          bookingAmountPaid: { increment: Math.round(Number(paidDiff)) },
          bookingAmountDue: { increment: Math.round(Number(owedDiff)) },
          bookingBalance: { increment: Math.round(Number(paidDiff) - Number(owedDiff)) },
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });
      // 7. Update voucher remarks if date/time changed
      const dateChanged = booking.startTime.getTime() !== newStartTime.getTime();
      if (
        dateChanged &&
        (newPaymentStatus === PaymentStatus.PAID ||
          newPaymentStatus === PaymentStatus.HALF_PAID)
      ) {
        await this.prismaService.paymentVoucher.updateMany({
          where: {
            booking_id: booking.id,
            booking_type: 'PHOTOSHOOT',
            status: VoucherStatus.CONFIRMED,
            voucher_type: {
              in: [VoucherType.FULL_PAYMENT, VoucherType.HALF_PAYMENT],
            },
          },
          data: {
            remarks: `Photoshoot | ${newStartTime.toLocaleDateString()} ${newStartTime.toLocaleTimeString()}`,
          },
        });
      }
    }
    return updated;
  }
  async gBookingPhotoshoot() {
    return await this.prismaService.photoshootBooking.findMany({
      orderBy: { bookingDate: 'asc' },
      include: {
        member: {
          select: {
            Membership_No: true,
            Name: true,
            Balance: true,
          },
        },
        photoshoot: true,
      },
    });
  }

  // member photoshoot booking
  async cBookingPhotoshootMember(payload: any) {
    const {
      membershipNo,
      entityId,
      bookingDate,
      totalPrice,
      paymentStatus = 'PAID',
      pricingType,
      paidAmount,
      paymentMode = 'ONLINE',
      timeSlot,
      specialRequests = '',
      paidBy = 'MEMBER',
      guestName,
      guestContact,
    } = payload;

    // ── 1. VALIDATE REQUIRED FIELDS ─────────────────────────
    if (!membershipNo)
      throw new BadRequestException('Membership number is required');
    if (!entityId)
      throw new BadRequestException('Photoshoot service ID is required');
    if (!bookingDate) throw new BadRequestException('Booking date is required');
    if (!timeSlot) throw new BadRequestException('Time slot is required');

    // ── 2. VALIDATE BOOKING DATE & TIME ─────────────────────
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const booking = new Date(bookingDate);

    if (booking < today) {
      throw new ConflictException('Booking date cannot be in the past');
    }

    const startTime = parsePakistanDate(timeSlot);
    const now = getPakistanDate();

    if (startTime < now) {
      throw new ConflictException('Booking time cannot be in the past');
    }

    // Validate time slot is between 9am and 6pm (since booking is 2 hours, last slot ends at 8pm)
    const bookingHour = startTime.getHours();
    // if (bookingHour < 9 && bookingHour > 6) {
    //   throw new BadRequestException(
    //     'Photoshoot bookings are only available between 9:00 AM and 6:00 PM',
    //   );
    // }

    // ── 3. VALIDATE MEMBER ─────────────────────────────────
    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: membershipNo.toString() },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // Use transaction for atomic operations
    return await this.prismaService.$transaction(async (prisma) => {
      // ── 4. VALIDATE PHOTOSHOOT SERVICE ────────────────────
      const photoshoot = await prisma.photoshoot.findFirst({
        where: { id: Number(entityId) },
      });

      if (!photoshoot) {
        throw new NotFoundException('Photoshoot service not found');
      }

      // ── 5. CALCULATE END TIME ────────────────────────────
      const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

      // REMOVED: Booking conflict check to allow same date/time

      // ── 6. CALCULATE PRICE BASED ON PRICING TYPE ──────────
      const basePrice =
        pricingType === 'member'
          ? photoshoot.memberCharges
          : photoshoot.guestCharges;
      const total = totalPrice ? Number(totalPrice) : Number(basePrice);

      // ── 7. PAYMENT CALCULATIONS ───────────────────────────
      let paid = 0;
      let owed = total;

      let amountToBalance = 0;
      const isToBill = paymentStatus === 'TO_BILL';

      if (paymentStatus === 'PAID') {
        paid = total;
        owed = 0;
      } else if (paymentStatus === 'HALF_PAID') {
        paid = Number(paidAmount) || 0;
        if (paid <= 0) {
          throw new ConflictException(
            'Paid amount must be greater than 0 for half-paid status',
          );
        }
        if (paid >= total) {
          throw new ConflictException(
            'Paid amount must be less than total price for half-paid status',
          );
        }
        owed = total - paid;
      }

      if (isToBill) {
        amountToBalance = owed;
        owed = 0;
      }

      // ── 8. CREATE BOOKING ───────────────────────────────
      const booked = await prisma.photoshootBooking.create({
        data: {
          memberId: member.Sno,
          photoshootId: photoshoot.id,
          bookingDate: booking,
          startTime: startTime,
          endTime: endTime,
          totalPrice: total,
          paymentStatus: paymentStatus as any,
          pricingType,
          paidAmount: paid,
          pendingAmount: owed,
          paidBy,
          guestName,
          guestContact,
        },
        include: {
          photoshoot: {
            select: {
              description: true,
            },
          },
          member: {
            select: {
              Name: true,
              Membership_No: true,
            },
          },
        },
      });

      // ── 9. UPDATE MEMBER LEDGER ─────────────────────────
      await prisma.member.update({
        where: { Membership_No: membershipNo.toString() },
        data: {
          totalBookings: { increment: 1 },
          lastBookingDate: new Date(),
          bookingAmountPaid: { increment: Math.round(Number(paid)) },
          bookingAmountDue: { increment: Math.round(Number(owed)) },
          bookingBalance: { increment: Math.round(Number(paid) - Number(owed)) },
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });

      // ── 10. CREATE PAYMENT VOUCHER ───────────────────────
      if (paid > 0) {
        let voucherType: VoucherType | null = null;
        if (paymentStatus === ('PAID' as unknown))
          voucherType = VoucherType.FULL_PAYMENT;
        else if (paymentStatus === ('HALF_PAID' as unknown))
          voucherType = VoucherType.HALF_PAYMENT;

        await prisma.paymentVoucher.create({
          data: {
            booking_type: 'PHOTOSHOOT',
            booking_id: booked.id,
            membership_no: membershipNo.toString(),
            amount: paid,
            payment_mode: paymentMode as unknown as PaymentMode,
            voucher_type: voucherType!,
            status: VoucherStatus.CONFIRMED,
            issued_by: 'member',
            remarks: `Photoshoot: ${photoshoot.description} | ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}${specialRequests ? ` | Requests: ${specialRequests}` : ''}`,
          },
        });
      }
      // console.log(booked);
      return {
        success: true,
        message: `Successfully booked ${photoshoot.description} for ${startTime.toLocaleDateString()} at ${startTime.toLocaleTimeString()}`,
        booking: {
          id: booked.id,
          memberName: booked.member.Name,
          membershipNo: booked.member.Membership_No,
          service: booked.photoshoot.description,
          date: booked.bookingDate.toLocaleDateString(),
          timeSlot: `${startTime.toLocaleTimeString()} - ${endTime.toLocaleTimeString()}`,
          duration: '2 hours',
          totalAmount: total,
          paidAmount: paid,
          pendingAmount: owed,
          paymentStatus: paymentStatus,
        },
        receipt: {
          bookingId: booked.id,
          service: photoshoot.description,
          date: startTime.toLocaleDateString(),
          time: startTime.toLocaleTimeString(),
          total: total,
          paid: paid,
          balance: owed,
        },
      };
    });
  }

  async uBookingPhotoshootMember(payload: any) {
    const {
      id,
      membershipNo,
      entityId,
      bookingDate,
      startTime,
      endTime,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      paymentMode = 'ONLINE',
      specialRequests = '',
      paidBy = 'MEMBER',
      guestName,
      guestContact,
      remarks,
    } = payload;

    // Validate required fields
    if (!id) throw new BadRequestException('Booking ID is required');
    if (!membershipNo)
      throw new BadRequestException('Membership number is required');
    if (!entityId)
      throw new BadRequestException('Photoshoot service ID is required');
    if (!bookingDate) throw new BadRequestException('Booking date is required');
    if (!startTime) throw new BadRequestException('Start time is required');
    if (!endTime) throw new BadRequestException('End time is required');

    // Parse dates and times
    const booking = new Date(bookingDate);
    booking.setHours(0, 0, 0, 0);
    const newStartTime = new Date(startTime);
    const newEndTime = new Date(endTime);

    // Get existing booking
    const existing = await this.prismaService.photoshootBooking.findUnique({
      where: { id: Number(id) },
      include: {
        member: true,
        photoshoot: true,
      },
    });

    if (!existing) {
      throw new NotFoundException('Photoshoot booking not found');
    }

    // Get member
    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: membershipNo },
    });

    if (!member) {
      throw new NotFoundException(`Member ${membershipNo} not found`);
    }

    // Validate photoshoot service
    const photoshoot = await this.prismaService.photoshoot.findFirst({
      where: { id: Number(entityId) },
    });

    if (!photoshoot)
      throw new NotFoundException('Photoshoot service not found');
    if (!photoshoot.isActive) {
      throw new ConflictException('Photoshoot service is not active');
    }

    // Check for conflicting bookings (exclude current)
    const conflictingBooking =
      await this.prismaService.photoshootBooking.findFirst({
        where: {
          photoshootId: photoshoot.id,
          id: { not: Number(id) },
          bookingDate: booking,
          OR: [
            {
              AND: [
                { startTime: { lt: newEndTime } },
                { endTime: { gt: newStartTime } },
              ],
            },
          ],
        },
      });

    if (conflictingBooking) {
      throw new ConflictException(
        `Photoshoot service already booked for this date and time slot`,
      );
    }

    // Calculate price
    const basePrice =
      pricingType === 'member'
        ? photoshoot.memberCharges
        : photoshoot.guestCharges;
    const newTotal = totalPrice ? Number(totalPrice) : Number(basePrice);

    // ── PAYMENT CALCULATIONS ────────────────────────────────
    const currTotal = Number(existing.totalPrice);
    const currPaid = Number(existing.paidAmount);
    const currStatus = existing.paymentStatus as unknown as PaymentStatus;

    let newPaymentStatus = (paymentStatus as unknown as PaymentStatus) || currStatus;

    let newPaid = currPaid;
    if (newPaymentStatus === PaymentStatus.PAID) {
      newPaid = newTotal;
    } else if (newPaymentStatus === PaymentStatus.UNPAID) {
      newPaid = 0;
    } else {
      newPaid = paidAmount !== undefined ? Number(paidAmount) : currPaid;
    }

    let newOwed = newTotal - newPaid;
    let amountToBalance = 0;
    if (newPaymentStatus === PaymentStatus.TO_BILL) {
      amountToBalance = newOwed;
      newOwed = 0;
    }

    const refundAmount = await this.handleVoucherUpdateUnified(
      Number(id),
      'PHOTOSHOOT',
      membershipNo,
      newTotal,
      newPaid,
      newPaymentStatus,
      currTotal,
      currPaid,
      currStatus,
      {
        photoshootDesc: photoshoot.description,
        bookingDate: booking,
        eventTime: newStartTime.toLocaleTimeString(),
        remarks: remarks,
      },
      (paymentMode as any) || PaymentMode.ONLINE,
      'member'
    );

    const paidDiff = newPaid - currPaid;
    const owedDiff = newOwed - (currTotal - currPaid);

    // ── UPDATE BOOKING ───────────────────────────────────────
    const updated = await this.prismaService.photoshootBooking.update({
      where: { id: Number(id) },
      data: {
        photoshootId: photoshoot.id,
        memberId: member.Sno,
        bookingDate: booking,
        startTime: newStartTime,
        endTime: newEndTime,
        totalPrice: newTotal,
        paymentStatus: newPaymentStatus,
        pricingType,
        paidAmount: newPaid,
        pendingAmount: newOwed,
        refundAmount,
        paidBy,
        guestName,
        guestContact: guestContact?.toString(),
        refundReturned: false,
      },
    });

    // ── UPDATE MEMBER LEDGER ─────────────────────────────────
    if (paidDiff !== 0 || owedDiff !== 0 || amountToBalance !== 0) {
      await this.prismaService.member.update({
        where: { Membership_No: membershipNo },
        data: {
          bookingAmountPaid: { increment: Math.round(Number(paidDiff)) },
          bookingAmountDue: { increment: Math.round(Number(owedDiff)) },
          bookingBalance: { increment: Math.round(Number(paidDiff) - Number(owedDiff)) },
          lastBookingDate: new Date(),
          Balance: { increment: Math.round(amountToBalance) },
          drAmount: { increment: Math.round(amountToBalance) },
        },
      });
    }

    return {
      success: true,
      message: 'Photoshoot booking updated successfully',
      booking: updated,
      refundAmount,
    };
  }

  async dBookingPhotoshoot(bookingId: number) {
    console.log(`Delete request for photoshoot booking ID: ${bookingId}`);
    return { message: 'Delete skipped for now' };
  }

  async getMemberBookings(membershipNo: string) {
    const [roomBookings, hallBookings, lawnBookings, photoshootBookings] =
      await Promise.all([
        this.prismaService.roomBooking.findMany({
          where: { Membership_No: membershipNo },
          include: {
            rooms: {
              include: {
                room: {
                  include: {
                    roomType: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prismaService.hallBooking.findMany({
          where: {
            member: {
              Membership_No: membershipNo,
            },
          },
          include: {
            hall: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prismaService.lawnBooking.findMany({
          where: {
            member: {
              Membership_No: membershipNo,
            },
          },
          include: {
            lawn: {
              include: {
                lawnCategory: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        }),
        this.prismaService.photoshootBooking.findMany({
          where: {
            member: {
              Membership_No: membershipNo,
            },
          },
          include: {
            photoshoot: true,
          },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

    // Normalize and combine bookings
    const allBookings = [
      ...roomBookings.map((b) => ({
        id: b.id,
        type: 'Room',
        name: `Room ${b.rooms.map((r) => r.room.roomNumber).join(', ')} (${b.rooms[0]?.room.roomType?.type || 'N/A'})`,
        date: `${new Date(b.checkIn).toLocaleDateString()} - ${new Date(b.checkOut).toLocaleDateString()}`,
        amount: b.totalPrice,
        status: b.paymentStatus,
        createdAt: b.createdAt,
      })),
      ...hallBookings.map((b) => ({
        id: b.id,
        type: 'Hall',
        name: b.hall.name,
        date: `${new Date(b.bookingDate).toLocaleDateString()} (${b.bookingTime})`,
        amount: b.totalPrice,
        status: b.paymentStatus,
        createdAt: b.createdAt,
      })),
      ...lawnBookings.map((b) => ({
        id: b.id,
        type: 'Lawn',
        name: b.lawn.description,
        date: `${new Date(b.bookingDate).toLocaleDateString()} (${b.bookingTime})`,
        amount: b.totalPrice,
        status: b.paymentStatus,
        createdAt: b.createdAt,
      })),
      ...photoshootBookings.map((b) => ({
        id: b.id,
        type: 'Photoshoot',
        name: b.photoshoot.description,
        date: `${new Date(b.bookingDate).toLocaleDateString()} (${b.startTime} - ${b.endTime})`,
        amount: b.totalPrice,
        status: b.paymentStatus,
        createdAt: b.createdAt,
      })),
    ];

    // Sort by date desc
    return allBookings.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
  }
  // ── VOUCHER MANAGEMENT ─────────────────────────────────────
  async getVouchersByBooking(bookingType: string, bookingId: number) {
    return await this.prismaService.paymentVoucher.findMany({
      where: {
        booking_type: bookingType as BookingType,
        booking_id: bookingId,
      },
      orderBy: {
        issued_at: 'desc',
      },
    });
  }

  async updateVoucherStatus(
    voucherId: number,
    status: 'PENDING' | 'CONFIRMED' | 'CANCELLED',
  ) {
    const voucher = await this.prismaService.paymentVoucher.findUnique({
      where: { id: voucherId },
    });

    if (!voucher) {
      throw new NotFoundException('Voucher not found');
    }

    return await this.prismaService.paymentVoucher.update({
      where: { id: voucherId },
      data: {
        status: status as VoucherStatus,
      },
    });
  }

  // member bookings
  async memberBookings(Membership_No: string, type: 'Room' | 'Hall' | 'Lawn' | 'Photoshoot') {
    const member = await this.prismaService.member.findFirst({
      where: { Membership_No }
    })
    if (!member) throw new NotFoundException(`Membership number not found`)

    if (type === "Room") {
      return await this.prismaService.roomBooking.findMany({
        where: { Membership_No },
        include: {
          rooms: {
            include: {
              room: {
                include: {
                  roomType: true,
                },
              },
            },
          },
        },
      })
    } else if (type === "Hall") {
      return await this.prismaService.hallBooking.findMany({
        where: { memberId: member.Sno }
      })
    } else if (type === "Lawn") {
      return await this.prismaService.lawnBooking.findMany({
        where: { memberId: member.Sno }
      })
    } else if (type === "Photoshoot") {
      return await this.prismaService.photoshootBooking.findMany({
        where: { memberId: member.Sno }
      })
    }

  }


}



