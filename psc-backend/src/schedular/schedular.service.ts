import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SchedularService {
    private readonly logger = new Logger(SchedularService.name);

    constructor(private prismaService: PrismaService){}

    @Cron('0 0 * * * *')
    async updateRoomActivity(){
        const updated = await this.prismaService.room.updateMany({
            where: {
                isOutOfOrder: true,
                outOfOrderTo: {lt: new Date()}
            },
            data:{
                isOutOfOrder: false,
                isActive: true,
                outOfOrderFrom: null,
                outOfOrderTo: null,
                outOfOrderReason: '',
            }
        })
        this.logger.log(`Reactivated ${updated.count} rooms.`)
    }

}
