import { ConflictException, HttpStatus, Injectable } from '@nestjs/common';
import { BookingDto } from './dtos/booking.dto';
import { PrismaService } from 'src/prisma/prisma.service';
import {
  PaymentMode,
  PaymentStatus,
  Prisma,
  VoucherStatus,
  VoucherType,
} from '@prisma/client';

@Injectable()
export class BookingService {
  constructor(private prismaService: PrismaService) {}
  // room booking
  async cBookingRoom(payload: BookingDto) {
    const {
      membershipNo,
      entityId,
      checkIn,
      checkOut,
      totalPrice,
      paymentStatus,
      pricingType,
      paidAmount,
      pendingAmount,
      paymentMode,
    } = payload;

    if (!checkIn || !checkOut || checkIn! > checkOut!)
      throw new ConflictException('mismatching checkin and checkout dates');
    const room = await this.prismaService.room.findFirst({
      where: { id: Number(entityId) },
      select: {
        isBooked: true,
        isOutOfOrder: true,
        outOfOrderTo: true,
        id: true,
      },
    });
    if (room?.isBooked) throw new ConflictException('Room is already booked');
    if (room?.isOutOfOrder)
      throw new ConflictException(
        `Room is out-of-order till '${room?.outOfOrderTo}'`,
      );

    // create booking
    const booked = await this.prismaService.roomBooking.create({
      data: {
        Membership_No: membershipNo,
        roomId: Number(room?.id),
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        totalPrice,
        paymentStatus: paymentStatus as unknown as PaymentStatus,
        pricingType,
        paidAmount,
        pendingAmount,
      },
    });

    if (!booked) throw HttpStatus.INTERNAL_SERVER_ERROR;

    // update status of room
    await this.prismaService.room.update({
      where: { id: room?.id },
      data: {
        isBooked: true,
      },
    });
    const memberUpdateData: any = {
      totalBookings: { increment: 1 },
      drAmount: { increment: Number(paidAmount) || 0 },
      crAmount: { increment: Number(pendingAmount) || 0 },
      lastBookingDate: new Date(),
    };

    await this.prismaService.member.update({
      where: { Membership_No: membershipNo },
      data: memberUpdateData,
    });

    // === CREATE PAYMENT VOUCHER (if payment made) ===
    if (Number(paidAmount) > 0) {
        let voucherType: VoucherType | null = null;
      if (paymentStatus as unknown as PaymentStatus === PaymentStatus.PAID) {
        voucherType = VoucherType.FULL_PAYMENT;
      } else if (paymentStatus as unknown as PaymentStatus === PaymentStatus.HALF_PAID) {
        voucherType = VoucherType.HALF_PAYMENT;
      }
      await this.prismaService.paymentVoucher.create({
        data: {
          booking_type: 'ROOM',
          booking_id: booked?.id,
          membership_no: membershipNo,
          amount: Number(paidAmount),
          payment_mode: paymentMode as unknown as PaymentMode,
          voucher_type: voucherType!,
          status: VoucherStatus.CONFIRMED,
          issued_by: 'admin',
          remarks: `Room #${room?.id} | ${new Date(checkIn).toLocaleDateString()} → ${new Date(checkOut).toLocaleDateString()}`,
        },
      });
    }
    return booked;
  }
  async uBookingRoom(payload: BookingDto) {
    console.log(payload);
  }
  async gBookingsRoom() {
    return await this.prismaService.roomBooking.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        room: {
          select: {
            roomNumber: true,
            roomType: {
              select: { type: true },
            },
          },
        },
      },
    });
  }
  async dBookingRoom(bookingId: number) {
    // delete booking
    const deleted = await this.prismaService.roomBooking.delete({
      where: { id: bookingId },
    });
    if (!deleted) throw HttpStatus.INTERNAL_SERVER_ERROR;
    // find room and activate
    await this.prismaService.room.update({
      where: { id: deleted?.roomId },
      data: {
        isBooked: false,
      },
    });
    return deleted;
  }

  // hall booking
  async cBookingHall(payload: BookingDto) {}
  async gBookingsHall() {}
  async uBookingHall(payload: BookingDto) {}
  async dBookingHall(bookingId) {}

  // lawn booking
  async cBookingLawn(payload: BookingDto) {}
  async uBookingLawn(payload: BookingDto) {}
  async gBookingsLawn() {}
  async dBookingLawn(bookingId) {}

  // photoshoot booking
  async cBookingPhotoshoot(payload: BookingDto) {}
  async uBookingPhotoshoot(payload: BookingDto) {}
  async gBookingPhotoshoot() {}
  async dBookingPhotoshoot(bookingId) {}
}
