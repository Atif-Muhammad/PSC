-- DropForeignKey
ALTER TABLE `roombooking` DROP FOREIGN KEY `RoomBooking_roomId_fkey`;

-- DropIndex
DROP INDEX `RoomBooking_roomId_fkey` ON `roombooking`;

-- AlterTable
ALTER TABLE `roombooking` MODIFY `roomId` INTEGER NULL;

-- CreateTable
CREATE TABLE `RoomOnBooking` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `bookingId` INTEGER NOT NULL,
    `roomId` INTEGER NOT NULL,
    `priceAtBooking` DECIMAL(30, 2) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `RoomOnBooking_bookingId_idx`(`bookingId`),
    INDEX `RoomOnBooking_roomId_idx`(`roomId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `RoomOnBooking` ADD CONSTRAINT `RoomOnBooking_bookingId_fkey` FOREIGN KEY (`bookingId`) REFERENCES `RoomBooking`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `RoomOnBooking` ADD CONSTRAINT `RoomOnBooking_roomId_fkey` FOREIGN KEY (`roomId`) REFERENCES `Room`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
