import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaModule } from 'src/prisma/prisma.module';
import { BookingModule } from 'src/booking/booking.module';

@Module({
  imports: [PrismaModule, BookingModule],
  controllers: [AdminController],
  providers: [AdminService]
})
export class AdminModule {}
