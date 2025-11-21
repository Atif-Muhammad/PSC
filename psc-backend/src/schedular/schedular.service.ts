import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SchedularService {
  private readonly logger = new Logger(SchedularService.name);

  constructor(private prismaService: PrismaService) {}

  @Cron(CronExpression.EVERY_10_SECONDS)
  async checkScheduledOutOfOrder() {
    // Get current date in local time (same timezone as your database)
    const now = new Date();
    const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const localDateString = localDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const localDateTime = new Date(localDateString + 'T00:00:00.000Z');

    // Set rooms to out-of-order when their scheduled date arrives
    const setToOutOfOrder = await this.prismaService.room.updateMany({
      where: {
        isOutOfOrder: false,
        outOfOrderFrom: { lte: localDateTime },
        outOfOrderTo: { gte: localDateTime },
      },
      data: {
        isOutOfOrder: true,
        isActive: false,
      },
    });

    if (setToOutOfOrder.count > 0) {
      this.logger.log(
        `Set ${setToOutOfOrder.count} rooms to out-of-order based on schedule.`,
      );
    }

    // Also reset rooms that are past their out-of-order period
    const resetFromOutOfOrder = await this.prismaService.room.updateMany({
      where: {
        isOutOfOrder: true,
        outOfOrderTo: { lt: localDateTime },
      },
      data: {
        isOutOfOrder: false,
        isActive: true,
        outOfOrderReason: null,
        outOfOrderFrom: null,
        outOfOrderTo: null,
      },
    });

    if (resetFromOutOfOrder.count > 0) {
      this.logger.log(
        `Reset ${resetFromOutOfOrder.count} rooms from out-of-order status.`,
      );
    }
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async updateRoomReservationStatus() {
    this.logger.log(`Updating Room Reservation Status`);

    try {
      // Get current date at start of day for fair comparison
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Find all active reservations (reservations that include today)
      // A reservation is active if: reservedFrom <= today AND reservedTo >= today
      const activeReservations =
        await this.prismaService.roomReservation.findMany({
          where: {
            reservedFrom: { lt: tomorrow }, // Starts before tomorrow (includes today)
            reservedTo: { gte: today }, // Ends on or after today
          },
          select: {
            roomId: true,
          },
        });

      const activeRoomIds = [
        ...new Set(activeReservations.map((r) => r.roomId)),
      ];

      // Update all rooms in one go
      await this.prismaService.$transaction([
        // Set isReserved = true for rooms with active reservations
        this.prismaService.room.updateMany({
          where: { id: { in: activeRoomIds } },
          data: { isReserved: true },
        }),
        // Set isReserved = false for rooms without active reservations
        this.prismaService.room.updateMany({
          where: { id: { notIn: activeRoomIds }, isReserved: true },
          data: { isReserved: false },
        }),
      ]);

      this.logger.log(`Updated ${activeRoomIds.length} rooms as reserved`);
    } catch (error) {
      this.logger.error('Error updating room reservation status:', error);
    }
  }
}
