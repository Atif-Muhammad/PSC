import { Module } from '@nestjs/common';
import {ConfigModule} from "@nestjs/config"
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { MemberModule } from './member/member.module';
import { BookingModule } from './booking/booking.module';
import { NotificationModule } from './notification/notification.module';
import { PrismaModule } from './prisma/prisma.module';
import { MailerModule } from './mailer/mailer.module';
import { MailerService } from './mailer/mailer.service';
import { SchedularModule } from './schedular/schedular.module';
import { ScheduleModule } from '@nestjs/schedule';

@Module({
  imports: [AuthModule, AdminModule, MemberModule, BookingModule, NotificationModule, PrismaModule, ConfigModule.forRoot({
    isGlobal: true
  }), MailerModule, SchedularModule, ScheduleModule.forRoot()],
  controllers: [],
  providers: [MailerService],
})
export class AppModule {}
