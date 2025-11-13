import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateMemberDto } from './dtos/create-member.dto';
import { RoomTypeDto } from './dtos/room-type.dto';
import { capitalizeWords } from 'src/utils/CapitalizeFirst';
import { RoomDto } from './dtos/room.dto';
import { HallDto } from './dtos/hall.dto';
import { LawnCategory } from './dtos/lawn-category.dto';
import { LawnDto } from './dtos/lawn.dto';
import { PhotoShootDto } from './dtos/photoshoot.dto';
import { CreateSportDto } from './dtos/sport.dto';
import { Prisma, MemberStatus as prismaMemberStatus } from '@prisma/client';

@Injectable()
export class AdminService {
  constructor(private prismaService: PrismaService) {}

  // ─────────────────────────── MEMBERS ───────────────────────────
  async createMember(payload: CreateMemberDto) {
    const { Name, Email, Membership_No, Contact_No, Balance, Other_Details } =
      payload;

    const existingMember = await this.prismaService.member.findFirst({
      where: { OR: [{ Email }, { Contact_No }] },
    });
    if (existingMember)
      throw new HttpException('Member already exists', HttpStatus.BAD_REQUEST);

    return this.prismaService.member.create({
      data: { Name, Email, Membership_No, Contact_No, Balance, Other_Details },
    });
  }

  async createBulk(payload: CreateMemberDto[]) {
    const operations = payload.map((row) =>
      this.prismaService.member.upsert({
        where: { Membership_No: row.Membership_No!.toString() },
        update: {
          Name: row.Name!,
          Email: row.Email!,
          Contact_No: row.Contact_No!.toString(),
          Status:
            prismaMemberStatus[row.Status as keyof typeof prismaMemberStatus],
          Balance: Number(row.Balance!),
          Other_Details: row.Other_Details!,
        },
        create: {
          Membership_No: row.Membership_No!.toString(),
          Name: row.Name!,
          Email: row.Email!,
          Contact_No: row.Contact_No!.toString(),
          Status:
            prismaMemberStatus[row.Status as keyof typeof prismaMemberStatus],
          Balance: Number(row.Balance!),
          Other_Details: row.Other_Details!,
        },
      }),
    );

    await this.prismaService.$transaction(operations);
  }

  async updateMember(memberID: string, payload: Partial<CreateMemberDto>) {
    const memberExists = await this.prismaService.member.findFirst({
      where: { Membership_No: memberID.toString() },
    });
    if (!memberExists)
      throw new HttpException('Member not found', HttpStatus.NOT_FOUND);
    // console.log(payload)
    return this.prismaService.member.update({
      where: { Membership_No: memberID },
      data: {
        // Sno: Number(payload.Sno),
        Membership_No: payload.Membership_No,
        Name: payload.Name,
        Email: payload.Email,
        Contact_No: payload.Contact_No,
        Status: payload.Status,
        Other_Details: payload.Other_Details,
      },
    });
  }

  async removeMember(memberID: string) {
    return 'member deleted';
  }

  async getMembers({ page, limit, search, status }) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { Membership_No: { contains: search } },
        { Name: { contains: search } },
      ];
    }
    if (status && status !== 'all') {
      where.Status = { equals: status.toUpperCase() };
    }

    const [members, total] = await Promise.all([
      this.prismaService.member.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prismaService.member.count({ where }),
    ]);

    return {
      data: members,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
      },
    };
  }

  async searchMembers(searchFor: string) {
    // Trim and avoid empty or too short searches
    const query = searchFor.trim();
    if (!query) return [];

    return await this.prismaService.member.findMany({
      where: {
        OR: [
          {
            Membership_No: {
              startsWith: query,
            },
          },
          {
            Name: {
              startsWith: query,
            },
          },
        ],
      },
      select: {
        Name: true,
        Balance: true,
        Membership_No: true,
        Status: true,
        Sno: true,
      },
      orderBy: {
        Membership_No: 'asc',
      },
      take: 15,
    });
  }

  async getAdmins() {
    const admins = await this.prismaService.admin.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return admins.sort((a, b) => {
      if (a.role === 'SUPER_ADMIN' && b.role !== 'SUPER_ADMIN') return -1;
      if (b.role === 'SUPER_ADMIN' && a.role !== 'SUPER_ADMIN') return 1;
      return 0;
    });
  }

  // ─────────────────────────── ROOM TYPES ───────────────────────────
  async createRoomType(payload: RoomTypeDto) {
    return await this.prismaService.roomType.create({
      data: {
        type: capitalizeWords(payload.type),
        priceMember: Number(payload.priceMember),
        priceGuest: Number(payload.priceGuest),
      },
    });
  }
  async updateRoomType(id: number, payload: Partial<RoomTypeDto>) {
    // console.log(payload)
    return await this.prismaService.roomType.update({
      where: {id},
      data: {
        type: capitalizeWords(payload.type!),
        priceMember: Number(payload.priceMember),
        priceGuest: Number(payload.priceGuest),
      },
    });
  }

  async deleteRoomType(id: number) {
    return await this.prismaService.roomType.delete({
      where: {id}
    });
  }
  async getRoomTypes() {
    return await this.prismaService.roomType.findMany({
      orderBy: { priceGuest: 'asc' },
    });
  }

  // ─────────────────────────── ROOMS ───────────────────────────
  async getRooms() {
    return await this.prismaService.room.findMany({
      include: {
        roomType: {
          select: { type: true, priceMember: true, priceGuest: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
  async getRoomCategories() {
    return await this.prismaService.roomType.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
  async getAvailRooms(roomTypeId: number) {
    // console.log(roomTypeId);
    return await this.prismaService.room.findMany({
      where: { roomTypeId },
      include: {
        roomType: {
          select: { type: true, priceMember: true, priceGuest: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createRoom(payload: RoomDto) {
    return await this.prismaService.room.create({
      data: {
        roomNumber: payload.roomNumber,
        roomTypeId: Number(payload.roomTypeId),
        description: payload.description,
        isActive: Boolean(payload.isActive),
        isOutOfOrder: Boolean(payload.isOutOfOrder),
      },
    });
  }

  async updateRoom(payload: Partial<RoomDto>) {
    if (!payload.id)
      throw new HttpException('Room ID is required', HttpStatus.BAD_REQUEST);

    return await this.prismaService.room.update({
      where: { id: Number(payload.id) },
      data: {
        roomNumber: payload.roomNumber,
        roomTypeId: Number(payload.roomTypeId),
        description: payload.description,
        isActive: Boolean(payload.isActive),
        isOutOfOrder: Boolean(payload.isOutOfOrder),
        outOfOrderReason: payload.outOfOrderReason,
        outOfOrderTo: payload.outOfOrderTo && new Date(payload.outOfOrderTo),
        outOfOrderFrom:
          payload.outOfOrderFrom && new Date(payload.outOfOrderFrom),
      },
    });
  }

  // ─────────────────────────── HALLS ───────────────────────────
  async getHalls() {
    return await this.prismaService.hall.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
  async getAvailHalls() {
    return await this.prismaService.hall.findMany({
      where: { isActive: true, isBooked: false },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createHall(payload: HallDto) {
    return await this.prismaService.hall.create({
      data: {
        name: capitalizeWords(payload.name),
        description: payload.description,
        capacity: Number(payload.capacity),
        chargesGuests: Number(payload.chargesGuests),
        chargesMembers: Number(payload.chargesMembers),
        isActive: Boolean(payload.isActive),
        isOutOfService: Boolean(payload.isOutOfService),
      },
    });
  }

  async updateHall(payload: HallDto) {
    if (!payload.id)
      throw new HttpException('Hall ID is required', HttpStatus.BAD_REQUEST);

    return await this.prismaService.hall.update({
      where: { id: Number(payload.id) },
      data: {
        name: payload.name,
        description: payload.description,
        capacity: Number(payload.capacity),
        chargesMembers: Number(payload.chargesMembers),
        chargesGuests: Number(payload.chargesGuests),
        isActive: Boolean(payload.isActive),
        isOutOfService: Boolean(payload.isOutOfService),
        outOfServiceReason: payload.outOfServiceReason,
        outOfServiceFrom:
          payload.outOfServiceFrom && new Date(payload.outOfServiceFrom),
        outOfServiceTo:
          payload.outOfServiceTo && new Date(payload.outOfServiceTo),
      },
    });
  }

  // ─────────────────────────── LAWN CATEGORY ───────────────────────────
  async getLawnCategories() {
    return await this.prismaService.lawnCategory.findMany({});
  }
  async getLawnNames(id: number) {
    return await this.prismaService.lawn.findMany({
      where: { lawnCategoryId: id },
      orderBy: {memberCharges: "desc"}
    });
  }

  async createLawnCategory(payload: LawnCategory) {
    return await this.prismaService.lawnCategory.create({
      data: { category: payload.category },
    });
  }

  async updateLawnCategory(payload: LawnCategory) {
    if (!payload.id)
      throw new HttpException(
        'Lawn category ID is required',
        HttpStatus.BAD_REQUEST,
      );

    return await this.prismaService.lawnCategory.update({
      where: { id: Number(payload.id) },
      data: { category: payload.category },
    });
  }

  async deleteLawnCategory(catID: number) {
    return await this.prismaService.lawnCategory.delete({
      where: { id: catID },
    });
  }

  // ─────────────────────────── LAWNS ───────────────────────────
  async createLawn(payload: LawnDto) {
    return await this.prismaService.lawn.create({
      data: {
        description: payload.description,
        lawnCategoryId: Number(payload.lawnCategoryId),
        minGuests: Number(payload.minGuests),
        maxGuests: Number(payload.maxGuests),
        memberCharges: Number(payload.memberCharges),
        guestCharges: Number(payload.guestCharges),
      },
    });
  }

  async getLawns() {
    return this.prismaService.lawn.findMany({
      where: {isBooked: false},
      include: { lawnCategory: { select: { id: true, category: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateLawn(payload: Partial<LawnDto>) {
    if (!payload.id)
      throw new HttpException('Lawn ID is required', HttpStatus.BAD_REQUEST);

    return await this.prismaService.lawn.update({
      where: { id: Number(payload.id) },
      data: {
        description: payload.description,
        lawnCategoryId: Number(payload.lawnCategoryId),
        minGuests: Number(payload.minGuests),
        maxGuests: Number(payload.maxGuests),
        memberCharges: Number(payload.memberCharges),
        guestCharges: Number(payload.guestCharges),
      },
    });
  }

  async deleteLawn(lawnID: number) {
    console.log(lawnID);
  }

  // ─────────────────────────── PHOTOSHOOT ───────────────────────────
  async createPhotoShoot(payload: PhotoShootDto) {
    return await this.prismaService.photoshoot.create({
      data: {
        description: payload.description,
        memberCharges: Number(payload.memberCharges),
        guestCharges: Number(payload.guestCharges),
      },
    });
  }

  async getPhotoshoots() {
    return await this.prismaService.photoshoot.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async updatePhotoshoot(payload: Partial<PhotoShootDto>) {
    if (!payload.id)
      throw new HttpException(
        'Photoshoot ID is required',
        HttpStatus.BAD_REQUEST,
      );

    return await this.prismaService.photoshoot.update({
      where: { id: Number(payload.id) },
      data: {
        description: payload.description,
        memberCharges: Number(payload.memberCharges),
        guestCharges: Number(payload.guestCharges),
      },
    });
  }

  async deletePhotoshoot(pID: number) {
    console.log(pID);
  }

  // --------------------------- SPORTS ---------------------------------
  async getSports() {
    return await this.prismaService.sport.findMany({
      include: { sportCharge: true },
      orderBy: { createdAt: 'desc' },
    });
  }
  async createSport(payload: CreateSportDto) {
    return await this.prismaService.sport.create({
      data: {
        activity: payload.activity,
        description: payload.description,
        isActive: Boolean(payload.isActive),
        sportCharge: {
          create: payload.sportCharge.map((c) => ({
            chargeType: c.chargeType,
            memberCharges: c.memberCharges?.toString(),
            spouseCharges: c.spouseCharges?.toString(),
            childrenCharges: c.childrenCharges?.toString(),
            guestCharges: c.guestCharges?.toString(),
            affiliatedClubCharges: c.affiliatedClubCharges?.toString(),
          })),
        },
      },
      include: { sportCharge: true },
    });
  }
  async updateSport(payload: Partial<CreateSportDto>) {
    if (!payload.id)
      throw new HttpException(
        'Sport/Activity ID is required',
        HttpStatus.BAD_REQUEST,
      );
    return await this.prismaService.sport.update({
      where: { id: Number(payload.id) },
      data: {
        activity: payload.activity,
        description: payload.description,
        isActive: payload.isActive,
        sportCharge: {
          deleteMany: {},
          create: payload.sportCharge?.map((c) => ({
            chargeType: c.chargeType,
            memberCharges: c.memberCharges,
            spouseCharges: c.spouseCharges,
            childrenCharges: c.childrenCharges,
            guestCharges: c.guestCharges,
            affiliatedClubCharges: c.affiliatedClubCharges,
          })),
        },
      },
    });
  }
  async deleteSport(payload) {
    console.log(payload);
  }
}
