import {
  Body,
  Controller,
  Delete,
  Get,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CreateMemberDto } from './dtos/create-member.dto';
import { JwtAccGuard } from 'src/common/guards/jwt-access.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { RolesEnum } from 'src/common/constants/roles.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AdminService } from './admin.service';
import { RoomTypeDto } from './dtos/room-type.dto';
import { RoomDto } from './dtos/room.dto';
import { HallDto } from './dtos/hall.dto';
import { LawnCategory } from './dtos/lawn-category.dto';
import { LawnDto } from './dtos/lawn.dto';
import { PhotoShootDto } from './dtos/photoshoot.dto';
import { CreateSportDto } from './dtos/sport.dto';
import { BookingService } from 'src/booking/booking.service';
import { BookingDto } from './dtos/booking.dto';
import { PaymentMode } from '@prisma/client';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly bookingService: BookingService,
  ) {}

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
  @Post('create/member')
  async createMember(@Body() payload: CreateMemberDto) {
    return this.adminService.createMember(payload);
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
  @Post('create/bulk/members')
  async createBulkMembers(@Body() payload: CreateMemberDto[]) {
    return this.adminService.createBulk(payload);
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
  @Patch('update/member')
  async updateMember(
    @Query('memberID') memberID: string,
    @Body() payload: Partial<CreateMemberDto>,
  ) {
    return this.adminService.updateMember(memberID, payload);
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN, RolesEnum.ADMIN)
  @Delete('remove/member')
  async(@Query('memberID') memberID: string) {
    return this.adminService.removeMember(memberID);
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/admins')
  async getAdmins() {
    return this.adminService.getAdmins();
  }

  @Get('search/members')
  async searchMembers(@Query() searchFor: { searchFor: string }) {
    return await this.adminService.searchMembers(searchFor.searchFor);
  }

  @Get('get/members')
  async getMembers(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
    @Query('search') search?: string,
    @Query('status') status?: string,
  ) {
    return this.adminService.getMembers({
      page,
      limit,
      search,
      status,
    });
  }

  // room types //
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Post('create/roomType')
  async createRoomType(@Body() payload: RoomTypeDto) {
    return this.adminService.createRoomType(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/roomTypes')
  async getRoomTypes() {
    return this.adminService.getRoomTypes();
  }

  // rooms //
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/rooms')
  async getRooms() {
    return this.adminService.getRooms();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/rooms/categories')
  async getRoomCategories() {
    return this.adminService.getRoomCategories();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/rooms/available')
  async getAvailRooms(@Query() roomTypeId: { roomTypeId: string }) {
    return this.adminService.getAvailRooms(Number(roomTypeId.roomTypeId));
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Post('create/room')
  async createRoom(
    @Body() payload: RoomDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { isActive, isOutOfOrder } = payload;
    if (isActive === isOutOfOrder)
      return res.status(400).send({
        cause: 'room activity and out-of-order cannot be at the same time',
      });
    return this.adminService.createRoom(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Patch('update/room')
  async updateRoom(
    @Body() payload: RoomDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { isActive, isOutOfOrder } = payload;
    if (isActive === isOutOfOrder)
      return res.status(400).send({
        cause: 'room activity and out-of-order cannot be at the same time',
      });
    return this.adminService.updateRoom(payload);
  }

  // halls

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/halls')
  async getHalls() {
    return this.adminService.getHalls();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/halls/available')
  async getAvailHalls() {
    return this.adminService.getAvailHalls();
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Post('create/hall')
  async createHall(
    @Body() payload: HallDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { isActive, isOutOfService } = payload;
    if (isActive === isOutOfService)
      return res.status(400).send({
        cause: 'hall activity and out-of-order cannot be at the same time',
      });
    return this.adminService.createHall(payload);
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Patch('update/hall')
  async updateHall(
    @Body() payload: HallDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { isActive, isOutOfService } = payload;
    if (isActive === isOutOfService)
      return res.status(400).send({
        cause: 'room activity and out-of-order cannot be at the same time',
      });
    return this.adminService.updateHall(payload);
  }

  // lawn cateogry
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/lawn/categories')
  async getLawnCategories() {
    return this.adminService.getLawnCategories();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/lawn/categories/names')
  async getLawnNames(@Query() catId: { catId: string }) {
    return this.adminService.getLawnNames(Number(catId.catId));
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Post('create/lawn/category')
  async createLawnCategory(@Body() payload: LawnCategory) {
    return this.adminService.createLawnCategory(payload);
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Patch('update/lawn/category')
  async updateLawnCategory(@Body() payload: LawnCategory) {
    return this.adminService.updateLawnCategory(payload);
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Delete('delete/lawn/category')
  async deleteLawnCategory(@Query() catID: { catID: string }) {
    return this.adminService.deleteLawnCategory(Number(catID.catID));
  }

  // lawns
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Post('create/lawn')
  async createLawn(@Body() payload: LawnDto) {
    return this.adminService.createLawn(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Patch('update/lawn')
  async updateLawn(@Body() payload: Partial<LawnDto>) {
    return this.adminService.updateLawn(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/lawns')
  async getLawns() {
    return this.adminService.getLawns();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/lawns/available')
  async getAvailLawns() {
    console.log('avail lawns');
    return this.adminService.getLawns();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Delete('delete/lawn')
  async deleteLawn(@Query() lawnID: { lawnID: string }) {
    return this.adminService.deleteLawn(Number(lawnID));
  }

  // photoshoot

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Post('create/photoShoot')
  async createPhotoShoot(@Body() payload: PhotoShootDto) {
    return this.adminService.createPhotoShoot(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Patch('update/photoShoot')
  async updatePhotoShoot(@Body() payload: Partial<PhotoShootDto>) {
    return this.adminService.updatePhotoshoot(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/photoShoots')
  async getPhotoShoots() {
    return this.adminService.getPhotoshoots();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/photoShoots/available')
  async getAvailPhotoShoots() {
    console.log('avail photoshoots');
    return this.adminService.getPhotoshoots();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Delete('delete/photoShoot')
  async deletePhotoShoot(@Query() photoID: { photoID: string }) {
    return this.adminService.deletePhotoshoot(Number(photoID));
  }

  // sports
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Post('create/sport')
  async createSport(@Body() payload: CreateSportDto) {
    return this.adminService.createSport(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Patch('update/sport')
  async updateSport(@Body() payload: Partial<PhotoShootDto>) {
    return this.adminService.updateSport(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/sports')
  async getSports() {
    return this.adminService.getSports();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/sport')
  async getSport() {
    return this.adminService.getSports();
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Delete('delete/sport')
  async deleteSport(@Query() sportID: { sportID: string }) {
    return this.adminService.deleteSport(Number(sportID.sportID));
  }

  // booking //

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Post('create/booking')
  async createBooking(@Body() payload: BookingDto) {
    if (payload.category === 'Room')
      return await this.bookingService.cBookingRoom({...payload, paymentMode: PaymentMode.CASH});
    else if (payload.category === 'Hall')
      return await this.bookingService.cBookingHall({...payload, paymentMode: PaymentMode.CASH});
    else if (payload.category === 'Lawn')
      return await this.bookingService.cBookingLawn({...payload, paymentMode: PaymentMode.CASH});
    else if (payload.category === 'Photoshoot')
      return await this.bookingService.cBookingPhotoshoot({...payload, paymentMode: PaymentMode.CASH});
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Patch('update/booking')
  async updateBooking(@Body() payload: Partial<PhotoShootDto>) {
    return this.adminService.updatePhotoshoot(payload);
  }
  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Get('get/bookings/all')
  async getBookings() {
    return this.bookingService.gBookingsRoom();
  }

  @UseGuards(JwtAccGuard, RolesGuard)
  @Roles(RolesEnum.SUPER_ADMIN)
  @Delete('delete/booking')
  async deleteBooking(@Query() bookID: { bookID: string }) {
    return this.bookingService.dBookingRoom(Number(bookID.bookID));
  }
}
