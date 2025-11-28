import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { getPakistanDate, parsePakistanDate } from 'src/utils/time';

@Injectable()
export class PaymentService {
  constructor(private prismaService: PrismaService) {}

  // kuick pay
  // Mock payment gateway call - replace with actual integration
  private async callPaymentGateway(paymentData: any) {
    // Simulate API call to payment gateway
    // console.log('Calling payment gateway with:', paymentData);

    // This would be your actual payment gateway integration
    // For example:
    // const response = await axios.post('https://payment-gateway.com/invoice', paymentData);
    // return response.data;

    // the kuickpay api will call member booking api once payment is done
    await fetch('http://localhost:3000/booking/member/booking/room', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paymentData),
    });

    // Mock successful response
    return {
      success: true,
      transactionId:
        'TXN_' + Math.random().toString(36).substr(2, 9).toUpperCase(),
    };
  }

  ///////////////////////////////////////////////////////////////////////
  // generateInvoice
  async genInvoiceRoom(roomType: number, bookingData: any) {
    // console.log('Booking data received:', bookingData);

    // Validate room type exists
    const typeExists = await this.prismaService.roomType.findFirst({
      where: { id: roomType },
    });
    if (!typeExists) throw new NotFoundException(`Room type not found`);

    // Parse dates
    const checkIn = new Date(bookingData.from);
    const checkOut = new Date(bookingData.to);

    // Validate dates
    if (checkIn >= checkOut) {
      throw new BadRequestException(
        'Check-out date must be after check-in date',
      );
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const checkInDateOnly = new Date(checkIn);
    checkInDateOnly.setHours(0, 0, 0, 0);

    if (checkInDateOnly < today) {
      throw new BadRequestException('Check-in date cannot be in the past');
    }

    // Calculate number of nights
    const nights = Math.ceil(
      (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24),
    );

    // Calculate total price
    const pricePerNight =
      bookingData.pricingType === 'member'
        ? typeExists.priceMember
        : typeExists.priceGuest;
    const totalPrice =
      Number(pricePerNight) * nights * bookingData.numberOfRooms;

    // Check for available rooms
    const availableRooms = await this.prismaService.room.findMany({
      where: {
        roomTypeId: roomType,
        // isActive: true,
        // isOutOfOrder: false,
        // isBooked: false,
        OR: [
          // Rooms with no reservations or on hold (expired holds are considered available)
          {
            onHold: false,
          },
          // Rooms with expired holds
          {
            onHold: true,
            holdExpiry: { lt: new Date() },
          },
          // Rooms with reservations that don't conflict with selected dates
          {
            reservations: {
              none: {
                OR: [
                  // Reservation starts during booking period
                  {
                    reservedFrom: {
                      gte: checkIn,
                      lt: checkOut,
                    },
                  },
                  // Reservation ends during booking period
                  {
                    reservedTo: {
                      gt: checkIn,
                      lte: checkOut,
                    },
                  },
                  // Reservation spans the entire booking period
                  {
                    reservedFrom: { lte: checkIn },
                    reservedTo: { gte: checkOut },
                  },
                ],
              },
            },
          },
        ],
      },
      include: {
        reservations: {
          where: {
            OR: [
              { reservedTo: { gte: new Date() } }, // Current and future reservations
            ],
          },
        },
      },
    });

    // Filter out rooms that are currently reserved or on hold (not expired)
    const trulyAvailableRooms = availableRooms.filter(
      (room) =>
        // !room.isReserved &&
        // !room.isBooked &&
        !room.onHold || room.holdExpiry! < new Date(),
    );

    // console.log(
    //   `Found ${trulyAvailableRooms.length} available rooms out of ${availableRooms.length} total rooms of this type`,
    // );
    console.log(availableRooms);
    console.log(trulyAvailableRooms);

    // Check if enough rooms are available
    if (trulyAvailableRooms.length < bookingData.numberOfRooms) {
      throw new ConflictException(
        `Only ${trulyAvailableRooms.length} room(s) available. Requested: ${bookingData.numberOfRooms}`,
      );
    }

    // Check for overlapping bookings
    const overlappingBookings = await this.prismaService.roomBooking.findMany({
      where: {
        room: {
          roomTypeId: roomType,
        },
        OR: [
          // Booking starts during selected period
          {
            checkIn: {
              gte: checkIn,
              lt: checkOut,
            },
          },
          // Booking ends during selected period
          {
            checkOut: {
              gt: checkIn,
              lte: checkOut,
            },
          },
          // Booking spans the entire selected period
          {
            checkIn: { lte: checkIn },
            checkOut: { gte: checkOut },
          },
        ],
      },
    });

    if (overlappingBookings.length > 0) {
      throw new ConflictException(
        `There are ${overlappingBookings.length} overlapping booking(s) for the selected dates`,
      );
    }

    // Check for out-of-order rooms during the selected period
    const outOfOrderRooms = await this.prismaService.room.findMany({
      where: {
        roomTypeId: roomType,
        isOutOfOrder: true,
        OR: [
          {
            outOfOrderFrom: { lte: checkOut },
            outOfOrderTo: { gte: checkIn },
          },
        ],
      },
    });

    if (outOfOrderRooms.length > 0) {
      // console.log(
      //   `Warning: ${outOfOrderRooms.length} room(s) are out of order during selected period`,
      // );
    }

    // Select specific rooms for booking (first X available rooms)
    const selectedRooms = trulyAvailableRooms.slice(
      0,
      bookingData.numberOfRooms,
    );

    // Calculate expiry time (3 minutes from now)
    const holdExpiry = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes in milliseconds
    const invoiceDueDate = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes in milliseconds

    // Put rooms on hold with 3-minute expiry (NO temporary reservations)
    try {
      const holdPromises = selectedRooms.map((room) =>
        this.prismaService.room.update({
          where: { id: room.id },
          data: {
            onHold: true,
            holdExpiry: holdExpiry,
            holdBy: bookingData.membership_no?.toString(),
          },
        }),
      );

      await Promise.all(holdPromises);
      // console.log(
      //   `Put ${selectedRooms.length} rooms on hold until ${holdExpiry}`,
      // );
    } catch (holdError) {
      console.error('Failed to put rooms on hold:', holdError);
      throw new InternalServerErrorException(
        'Failed to reserve rooms temporarily',
      );
    }

    // Prepare booking data for database (to be created after successful payment)
    const bookingRecord = {
      roomTypeId: roomType,
      checkIn,
      checkOut,
      numberOfRooms: bookingData.numberOfRooms,
      numberOfAdults: bookingData.numberOfAdults,
      numberOfChildren: bookingData.numberOfChildren,
      pricingType: bookingData.pricingType,
      specialRequest: bookingData.specialRequest || '',
      totalPrice,
      selectedRoomIds: selectedRooms.map((room) => room.id),
    };

    // console.log('Booking record prepared:', bookingRecord);

    // Call payment gateway to generate invoice
    try {
      const invoiceResponse = await this.callPaymentGateway({
        amount: totalPrice,
        consumerInfo: {
          membership_no: bookingData.membership_no,
          roomType: typeExists.type,
          nights: nights,
          rooms: bookingData.numberOfRooms,
        },
        bookingData: bookingRecord,
      });

      return {
        ResponseCode: '00',
        ResponseMessage: 'Invoice Created Successfully',
        Data: {
          ConsumerNumber: '7701234567',
          InvoiceNumber:
            'INV-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          DueDate: invoiceDueDate.toISOString(),
          Amount: totalPrice.toString(),
          Instructions:
            'Complete payment within 3 minutes to confirm your booking',
          PaymentChannels: [
            'JazzCash',
            'Easypaisa',
            'HBL',
            'Meezan',
            'UBL',
            'ATM',
            'Internet Banking',
          ],
          BookingSummary: {
            RoomType: typeExists.type,
            CheckIn: bookingData.from,
            CheckOut: bookingData.to,
            Nights: nights,
            Rooms: bookingData.numberOfRooms,
            Adults: bookingData.numberOfAdults,
            Children: bookingData.numberOfChildren,
            PricePerNight: pricePerNight.toString(),
            TotalAmount: totalPrice.toString(),
            HoldExpiresAt: holdExpiry.toISOString(),
          },
        },
        // Include temporary data for cleanup if payment fails
        TemporaryData: {
          roomIds: selectedRooms.map((room) => room.id),
          holdExpiry: holdExpiry,
        },
      };
    } catch (paymentError) {
      // Clean up room holds if payment gateway fails
      try {
        await this.prismaService.room.updateMany({
          where: {
            id: { in: selectedRooms.map((room) => room.id) },
          },
          data: {
            onHold: false,
            holdExpiry: null,
            holdBy: null,
          },
        });

        // console.log('Cleaned up room holds after payment failure');
      } catch (cleanupError) {
        console.error('Failed to clean up room holds:', cleanupError);
      }

      throw new InternalServerErrorException(
        'Failed to generate invoice with payment gateway',
      );
    }
  }

  async genInvoiceHall(hallId: number, bookingData: any) {
    console.log('Hall booking data received:', bookingData);

    // ── 1. VALIDATE HALL EXISTS ─────────────────────────────
    const hallExists = await this.prismaService.hall.findFirst({
      where: { id: hallId },
    });

    if (!hallExists) {
      throw new NotFoundException(`Hall not found`);
    }

    // ── 2. VALIDATE REQUIRED FIELDS ─────────────────────────
    if (!bookingData.bookingDate) {
      throw new BadRequestException('Booking date is required');
    }
    if (!bookingData.eventTime) {
      throw new BadRequestException('Event time slot is required');
    }
    if (!bookingData.eventType) {
      throw new BadRequestException('Event type is required');
    }

    // ── 3. PARSE AND VALIDATE BOOKING DATE ──────────────────
    const bookingDate = new Date(bookingData.bookingDate);
    bookingDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Booking date cannot be in the past');
    }

    // ── 4. VALIDATE EVENT TIME SLOT ─────────────────────────
    const normalizedEventTime = bookingData.eventTime.toUpperCase() as
      | 'MORNING'
      | 'EVENING'
      | 'NIGHT';
    const validEventTimes = ['MORNING', 'EVENING', 'NIGHT'];

    if (!validEventTimes.includes(normalizedEventTime)) {
      throw new BadRequestException(
        'Invalid event time. Must be MORNING, EVENING, or NIGHT',
      );
    }

    // ── 5. CHECK IF HALL IS ON HOLD ─────────────────────────
    if (
      hallExists.onHold &&
      hallExists.holdExpiry &&
      hallExists.holdExpiry > new Date()
    ) {
      // Check if the hold is by a different user
      if (hallExists.holdBy !== bookingData.membership_no?.toString()) {
        throw new ConflictException(
          `Hall '${hallExists.name}' is currently on hold by another user`,
        );
      }
    }

    // ── 6. CHECK OUT OF SERVICE PERIODS ─────────────────────
    if (hallExists.isOutOfService) {
      const outOfServiceFrom = hallExists.outOfServiceFrom
        ? new Date(hallExists.outOfServiceFrom)
        : null;
      const outOfServiceTo = hallExists.outOfServiceTo
        ? new Date(hallExists.outOfServiceTo)
        : null;

      if (outOfServiceFrom && outOfServiceTo) {
        outOfServiceFrom.setHours(0, 0, 0, 0);
        outOfServiceTo.setHours(0, 0, 0, 0);

        if (bookingDate >= outOfServiceFrom && bookingDate <= outOfServiceTo) {
          throw new ConflictException(
            `Hall '${hallExists.name}' is out of service from ${outOfServiceFrom.toLocaleDateString()} to ${outOfServiceTo.toLocaleDateString()}`,
          );
        }
      } else if (hallExists.isOutOfService) {
        throw new ConflictException(
          `Hall '${hallExists.name}' is currently out of service`,
        );
      }
    }

    // Check for scheduled maintenance
    if (
      hallExists.outOfServiceFrom &&
      hallExists.outOfServiceTo &&
      !hallExists.isOutOfService
    ) {
      const scheduledFrom = new Date(hallExists.outOfServiceFrom);
      scheduledFrom.setHours(0, 0, 0, 0);
      const scheduledTo = new Date(hallExists.outOfServiceTo);
      scheduledTo.setHours(0, 0, 0, 0);

      if (bookingDate >= scheduledFrom && bookingDate <= scheduledTo) {
        throw new ConflictException(
          `Hall '${hallExists.name}' has scheduled maintenance from ${scheduledFrom.toLocaleDateString()}`,
        );
      }
    }

    // ── 7. CHECK FOR EXISTING BOOKINGS ──────────────────────
    const existingBooking = await this.prismaService.hallBooking.findFirst({
      where: {
        hallId: hallExists.id,
        bookingDate: bookingDate,
        bookingTime: normalizedEventTime,
      },
    });

    if (existingBooking) {
      const timeSlotMap = {
        MORNING: 'Morning (8:00 AM - 2:00 PM)',
        EVENING: 'Evening (2:00 PM - 8:00 PM)',
        NIGHT: 'Night (8:00 PM - 12:00 AM)',
      };

      throw new ConflictException(
        `Hall '${hallExists.name}' is already booked for ${bookingDate.toLocaleDateString()} during ${timeSlotMap[normalizedEventTime]}`,
      );
    }

    // ── 8. CHECK FOR RESERVATIONS ───────────────────────────
    const conflictingReservation =
      await this.prismaService.hallReservation.findFirst({
        where: {
          hallId: hallExists.id,
          AND: [
            { reservedFrom: { lte: bookingDate } },
            { reservedTo: { gt: bookingDate } },
          ],
          timeSlot: normalizedEventTime,
        },
      });

    if (conflictingReservation) {
      throw new ConflictException(
        `Hall '${hallExists.name}' is reserved from ${conflictingReservation.reservedFrom.toLocaleDateString()} to ${conflictingReservation.reservedTo.toLocaleDateString()} (${normalizedEventTime} time slot)`,
      );
    }

    // ── 9. CALCULATE TOTAL PRICE ────────────────────────────
    const basePrice =
      bookingData.pricingType === 'member'
        ? hallExists.chargesMembers
        : hallExists.chargesGuests;
    const totalPrice = Number(basePrice);

    // ── 10. CALCULATE HOLD EXPIRY ───────────────────────────
    const holdExpiry = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
    const invoiceDueDate = new Date(Date.now() + 3 * 60 * 1000);

    // ── 11. PUT HALL ON HOLD ────────────────────────────────
    try {
      await this.prismaService.hall.update({
        where: { id: hallExists.id },
        data: {
          onHold: true,
          holdExpiry: holdExpiry,
          holdBy: bookingData.membership_no?.toString(),
        },
      });

      console.log(`Put hall '${hallExists.name}' on hold until ${holdExpiry}`);
    } catch (holdError) {
      console.error('Failed to put hall on hold:', holdError);
      throw new InternalServerErrorException(
        'Failed to reserve hall temporarily',
      );
    }

    // ── 12. PREPARE BOOKING DATA ────────────────────────────
    const bookingRecord = {
      hallId: hallExists.id,
      bookingDate: bookingData.bookingDate,
      eventTime: normalizedEventTime,
      eventType: bookingData.eventType,
      numberOfGuests: bookingData.numberOfGuests || 0,
      pricingType: bookingData.pricingType,
      specialRequest: bookingData.specialRequest || '',
      totalPrice,
    };

    console.log('Booking record prepared:', bookingRecord);

    // ── 13. GENERATE INVOICE ────────────────────────────────
    try {
      const timeSlotMap = {
        MORNING: 'Morning (8:00 AM - 2:00 PM)',
        EVENING: 'Evening (2:00 PM - 8:00 PM)',
        NIGHT: 'Night (8:00 PM - 12:00 AM)',
      };

      const invoiceResponse = await this.callPaymentGateway({
        amount: totalPrice,
        consumerInfo: {
          membership_no: bookingData.membership_no,
          hallName: hallExists.name,
          eventType: bookingData.eventType,
          bookingDate: bookingData.bookingDate,
        },
        bookingData: bookingRecord,
      });

      return {
        ResponseCode: '00',
        ResponseMessage: 'Invoice Created Successfully',
        Data: {
          ConsumerNumber: '7701234567',
          InvoiceNumber:
            'INV-HALL-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          DueDate: invoiceDueDate.toISOString(),
          Amount: totalPrice.toString(),
          Instructions:
            'Complete payment within 3 minutes to confirm your hall booking',
          PaymentChannels: [
            'JazzCash',
            'Easypaisa',
            'HBL',
            'Meezan',
            'UBL',
            'ATM',
            'Internet Banking',
          ],
          BookingSummary: {
            HallName: hallExists.name,
            Capacity: hallExists.capacity,
            BookingDate: bookingData.bookingDate,
            TimeSlot: timeSlotMap[normalizedEventTime],
            EventType: bookingData.eventType,
            NumberOfGuests: bookingData.numberOfGuests || 0,
            PricingType:
              bookingData.pricingType === 'member'
                ? 'Member Rate'
                : 'Guest Rate',
            BasePrice: basePrice.toString(),
            TotalAmount: totalPrice.toString(),
            HoldExpiresAt: holdExpiry.toISOString(),
          },
        },
        // Include temporary data for cleanup if payment fails
        TemporaryData: {
          hallId: hallExists.id,
          holdExpiry: holdExpiry,
        },
      };
    } catch (paymentError) {
      // ── 14. CLEANUP ON FAILURE ──────────────────────────────
      console.error('Payment gateway error:', paymentError);

      try {
        await this.prismaService.hall.update({
          where: { id: hallExists.id },
          data: {
            onHold: false,
            holdExpiry: null,
            holdBy: null,
          },
        });

        console.log('Cleaned up hall hold after payment failure');
      } catch (cleanupError) {
        console.error('Failed to clean up hall hold:', cleanupError);
      }

      throw new InternalServerErrorException(
        'Failed to generate invoice with payment gateway',
      );
    }
  }

  async genInvoiceLawn(lawnId: number, bookingData: any) {
    console.log('Lawn booking data received:', bookingData);

    // ── 1. VALIDATE LAWN EXISTS ─────────────────────────────
    const lawnExists = await this.prismaService.lawn.findFirst({
      where: { id: lawnId },
      include: {
        lawnCategory: true,
      },
    });

    if (!lawnExists) {
      throw new NotFoundException(`Lawn not found`);
    }

    // ── 2. VALIDATE REQUIRED FIELDS ─────────────────────────
    if (!bookingData.bookingDate) {
      throw new BadRequestException('Booking date is required');
    }
    if (!bookingData.eventTime) {
      throw new BadRequestException('Event time slot is required');
    }
    if (!bookingData.numberOfGuests) {
      throw new BadRequestException('Number of guests is required');
    }

    // ── 3. PARSE AND VALIDATE BOOKING DATE ──────────────────
    const bookingDate = new Date(bookingData.bookingDate);
    bookingDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Booking date cannot be in the past');
    }

    // ── 4. VALIDATE EVENT TIME SLOT ─────────────────────────
    const normalizedEventTime = bookingData.eventTime.toUpperCase() as
      | 'MORNING'
      | 'EVENING'
      | 'NIGHT';
    const validEventTimes = ['MORNING', 'EVENING', 'NIGHT'];

    if (!validEventTimes.includes(normalizedEventTime)) {
      throw new BadRequestException(
        'Invalid event time. Must be MORNING, EVENING, or NIGHT',
      );
    }

    // ── 5. CHECK IF LAWN IS ACTIVE ──────────────────────────
    if (!lawnExists.isActive) {
      throw new ConflictException(
        `Lawn '${lawnExists.description}' is not active for bookings`,
      );
    }

    // ── 6. CHECK IF LAWN IS ON HOLD ─────────────────────────
    if (
      lawnExists.onHold &&
      lawnExists.holdExpiry &&
      lawnExists.holdExpiry > new Date()
    ) {
      // Check if the hold is by a different user
      if (lawnExists.holdBy !== bookingData.membership_no?.toString()) {
        throw new ConflictException(
          `Lawn '${lawnExists.description}' is currently on hold by another user`,
        );
      }
    }

    // ── 7. CHECK OUT OF SERVICE PERIODS ─────────────────────
    if (lawnExists.isOutOfService) {
      const outOfServiceFrom = lawnExists.outOfServiceFrom
        ? new Date(lawnExists.outOfServiceFrom)
        : null;
      const outOfServiceTo = lawnExists.outOfServiceTo
        ? new Date(lawnExists.outOfServiceTo)
        : null;

      if (outOfServiceFrom && outOfServiceTo) {
        outOfServiceFrom.setHours(0, 0, 0, 0);
        outOfServiceTo.setHours(0, 0, 0, 0);

        if (bookingDate >= outOfServiceFrom && bookingDate <= outOfServiceTo) {
          throw new ConflictException(
            `Lawn '${lawnExists.description}' is out of service from ${outOfServiceFrom.toLocaleDateString()} to ${outOfServiceTo.toLocaleDateString()}`,
          );
        }
      } else if (lawnExists.isOutOfService) {
        throw new ConflictException(
          `Lawn '${lawnExists.description}' is currently out of service${lawnExists.outOfServiceReason ? `: ${lawnExists.outOfServiceReason}` : ''}`,
        );
      }
    }

    // Check for scheduled maintenance
    if (
      lawnExists.outOfServiceFrom &&
      lawnExists.outOfServiceTo &&
      !lawnExists.isOutOfService
    ) {
      const scheduledFrom = new Date(lawnExists.outOfServiceFrom);
      scheduledFrom.setHours(0, 0, 0, 0);
      const scheduledTo = new Date(lawnExists.outOfServiceTo);
      scheduledTo.setHours(0, 0, 0, 0);

      if (bookingDate >= scheduledFrom && bookingDate <= scheduledTo) {
        throw new ConflictException(
          `Lawn '${lawnExists.description}' has scheduled maintenance from ${scheduledFrom.toLocaleDateString()}`,
        );
      }
    }

    // ── 8. CHECK GUEST COUNT AGAINST CAPACITY ───────────────
    if (bookingData.numberOfGuests < (lawnExists.minGuests || 0)) {
      throw new ConflictException(
        `Number of guests (${bookingData.numberOfGuests}) is below the minimum requirement of ${lawnExists.minGuests} for this lawn`,
      );
    }

    if (bookingData.numberOfGuests > lawnExists.maxGuests) {
      throw new ConflictException(
        `Number of guests (${bookingData.numberOfGuests}) exceeds the maximum capacity of ${lawnExists.maxGuests} for this lawn`,
      );
    }

    // ── 9. CHECK FOR EXISTING BOOKINGS ──────────────────────
    const existingBooking = await this.prismaService.lawnBooking.findFirst({
      where: {
        lawnId: lawnExists.id,
        bookingDate: bookingDate,
        bookingTime: normalizedEventTime,
      },
    });

    if (existingBooking) {
      const timeSlotMap = {
        MORNING: 'Morning (8:00 AM - 2:00 PM)',
        EVENING: 'Evening (2:00 PM - 8:00 PM)',
        NIGHT: 'Night (8:00 PM - 12:00 AM)',
      };

      throw new ConflictException(
        `Lawn '${lawnExists.description}' is already booked for ${bookingDate.toLocaleDateString()} during ${timeSlotMap[normalizedEventTime]}`,
      );
    }

    // ── 10. CALCULATE TOTAL PRICE ───────────────────────────
    const basePrice =
      bookingData.pricingType === 'member'
        ? lawnExists.memberCharges
        : lawnExists.guestCharges;
    const totalPrice = Number(basePrice);

    // ── 11. CALCULATE HOLD EXPIRY ───────────────────────────
    const holdExpiry = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes
    const invoiceDueDate = new Date(Date.now() + 3 * 60 * 1000);

    // ── 12. PUT LAWN ON HOLD ────────────────────────────────
    try {
      await this.prismaService.lawn.update({
        where: { id: lawnExists.id },
        data: {
          onHold: true,
          holdExpiry: holdExpiry,
          holdBy: bookingData.membership_no?.toString(),
        },
      });

      console.log(
        `Put lawn '${lawnExists.description}' on hold until ${holdExpiry}`,
      );
    } catch (holdError) {
      console.error('Failed to put lawn on hold:', holdError);
      throw new InternalServerErrorException(
        'Failed to reserve lawn temporarily',
      );
    }

    // ── 13. PREPARE BOOKING DATA ────────────────────────────
    const bookingRecord = {
      lawnId: lawnExists.id,
      bookingDate: bookingData.bookingDate,
      bookingTime: normalizedEventTime,
      guestsCount: bookingData.numberOfGuests,
      pricingType: bookingData.pricingType,
      specialRequest: bookingData.specialRequest || '',
      totalPrice,
    };

    console.log('Lawn booking record prepared:', bookingRecord);

    // ── 14. GENERATE INVOICE ────────────────────────────────
    try {
      const timeSlotMap = {
        MORNING: 'Morning (8:00 AM - 2:00 PM)',
        EVENING: 'Evening (2:00 PM - 8:00 PM)',
        NIGHT: 'Night (8:00 PM - 12:00 AM)',
      };

      const invoiceResponse = await this.callPaymentGateway({
        amount: totalPrice,
        consumerInfo: {
          membership_no: bookingData.membership_no,
          lawnName: lawnExists.description,
          category: lawnExists.lawnCategory?.category || 'Standard',
          bookingDate: bookingData.bookingDate,
        },
        bookingData: bookingRecord,
      });

      return {
        ResponseCode: '00',
        ResponseMessage: 'Lawn Booking Invoice Created Successfully',
        Data: {
          ConsumerNumber: '7701234567',
          InvoiceNumber:
            'INV-LAWN-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
          DueDate: invoiceDueDate.toISOString(),
          Amount: totalPrice.toString(),
          Instructions:
            'Complete payment within 3 minutes to confirm your lawn booking',
          PaymentChannels: [
            'JazzCash',
            'Easypaisa',
            'HBL',
            'Meezan',
            'UBL',
            'ATM',
            'Internet Banking',
          ],
          BookingSummary: {
            LawnName: lawnExists.description,
            Category: lawnExists.lawnCategory?.category,
            Capacity: `${lawnExists.minGuests || 0} - ${lawnExists.maxGuests} guests`,
            BookingDate: bookingData.bookingDate,
            TimeSlot: timeSlotMap[normalizedEventTime],
            NumberOfGuests: bookingData.numberOfGuests,
            PricingType:
              bookingData.pricingType === 'member'
                ? 'Member Rate'
                : 'Guest Rate',
            BasePrice: basePrice.toString(),
            TotalAmount: totalPrice.toString(),
            HoldExpiresAt: holdExpiry.toISOString(),
          },
        },
        // Include temporary data for cleanup if payment fails
        TemporaryData: {
          lawnId: lawnExists.id,
          holdExpiry: holdExpiry,
        },
      };
    } catch (paymentError) {
      // ── 15. CLEANUP ON FAILURE ──────────────────────────────
      console.error('Payment gateway error:', paymentError);

      try {
        await this.prismaService.lawn.update({
          where: { id: lawnExists.id },
          data: {
            onHold: false,
            holdExpiry: null,
            holdBy: null,
          },
        });

        console.log('Cleaned up lawn hold after payment failure');
      } catch (cleanupError) {
        console.error('Failed to clean up lawn hold:', cleanupError);
      }

      throw new InternalServerErrorException(
        'Failed to generate invoice with payment gateway',
      );
    }
  }

  async genInvoicePhotoshoot(photoshootId: number, bookingData: any) {
    console.log('Photoshoot booking data received:', bookingData);

    // ── 1. VALIDATE PHOTOSHOOT EXISTS ───────────────────────
    const photoshootExists = await this.prismaService.photoshoot.findFirst({
      where: { id: photoshootId },
    });

    if (!photoshootExists) {
      throw new NotFoundException(`Photoshoot service not found`);
    }

    // ── 2. VALIDATE REQUIRED FIELDS ─────────────────────────
    if (!bookingData.bookingDate) {
      throw new BadRequestException('Booking date is required');
    }
    if (!bookingData.timeSlot) {
      throw new BadRequestException('Time slot is required');
    }
    if (!bookingData.membership_no) {
      throw new BadRequestException('Membership number is required');
    }

    // ── 3. VALIDATE MEMBER EXISTS ───────────────────────────
    const member = await this.prismaService.member.findUnique({
      where: { Membership_No: bookingData.membership_no.toString() },
    });

    if (!member) {
      throw new NotFoundException('Member not found');
    }

    // ── 4. PARSE AND VALIDATE BOOKING DATE & TIME ───────────
    const bookingDate = new Date(bookingData.bookingDate);
    bookingDate.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (bookingDate < today) {
      throw new BadRequestException('Booking date cannot be in the past');
    }

    const startTime = parsePakistanDate(bookingData.timeSlot);
    const now = getPakistanDate();

    if (startTime < now) {
      throw new BadRequestException('Booking time cannot be in the past');
    }

    // Validate time slot is between 9am and 6pm (since booking is 2 hours, last slot ends at 8pm)
    const bookingHour = startTime.getHours();
    if (bookingHour < 9 || bookingHour >= 18) {
      throw new BadRequestException('Photoshoot bookings are only available between 9:00 AM and 6:00 PM');
    }

    // ── 5. CALCULATE END TIME ───────────────────────────────
    const endTime = new Date(startTime.getTime() + 2 * 60 * 60 * 1000);

    // REMOVED: Existing booking check to allow same date/time

    // ── 6. CALCULATE TOTAL PRICE ────────────────────────────
    const basePrice =
      bookingData.pricingType === 'member'
        ? photoshootExists.memberCharges
        : photoshootExists.guestCharges;
    const totalPrice = Number(basePrice);

    // ── 7. PREPARE BOOKING DATA ─────────────────────────────
    const bookingRecord = {
      photoshootId: photoshootExists.id,
      bookingDate: bookingDate,
      startTime: startTime,
      endTime: endTime,
      pricingType: bookingData.pricingType,
      specialRequest: bookingData.specialRequest || '',
      totalPrice,
      memberId: member.Sno,
      membershipNo: bookingData.membership_no,
    };

    console.log('Photoshoot booking record prepared:', bookingRecord);

    // ── 8. GENERATE INVOICE VIA PAYMENT GATEWAY ─────────────
    try {
      const invoiceDueDate = new Date(Date.now() + 3 * 60 * 1000);

      const invoiceResponse = await this.callPaymentGateway({
        amount: totalPrice,
        consumerInfo: {
          membership_no: bookingData.membership_no,
          member_name: member.Name,
          serviceName: photoshootExists.description,
          serviceType: 'Photoshoot Session',
          bookingDate: bookingDate.toISOString(),
          bookingTime: startTime.toISOString(),
        },
        bookingData: bookingRecord,
      });

      return {
        ResponseCode: '00',
        ResponseMessage: 'Photoshoot Booking Invoice Created Successfully',
        Data: {
          ConsumerNumber: '7701234567',
          InvoiceNumber:
            'INV-PHOTO-' +
            Math.random().toString(36).substr(2, 9).toUpperCase(),
          DueDate: invoiceDueDate.toISOString(),
          Amount: totalPrice.toString(),
          Instructions:
            'Complete payment within 3 minutes to confirm your photoshoot booking',
          PaymentChannels: [
            'JazzCash',
            'Easypaisa',
            'HBL',
            'Meezan',
            'UBL',
            'ATM',
            'Internet Banking',
          ],
          BookingSummary: {
            ServiceName: photoshootExists.description,
            BookingDate: bookingDate.toLocaleDateString(),
            Time: startTime.toLocaleTimeString(),
            Duration: '2 hours',
            PricingType:
              bookingData.pricingType === 'member'
                ? 'Member Rate'
                : 'Guest Rate',
            BasePrice: basePrice.toString(),
            TotalAmount: totalPrice.toString(),
          },
        },
      };
    } catch (paymentError) {
      console.error('Payment gateway error:', paymentError);
      throw new InternalServerErrorException(
        'Failed to generate invoice with payment gateway',
      );
    }
  }

  /////////////////////////////////////////////////////////////////////

  async getMemberVouchers(membershipNo: string) {
    return await this.prismaService.paymentVoucher.findMany({
      where: { membership_no: membershipNo },
      orderBy: { issued_at: 'desc' },
    });
  }
}
