-- AlterTable
ALTER TABLE `hallholdings` ADD COLUMN `fromDate` DATETIME(3) NULL,
    ADD COLUMN `timeSlot` VARCHAR(20) NULL,
    ADD COLUMN `toDate` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `lawnholdings` ADD COLUMN `fromDate` DATETIME(3) NULL,
    ADD COLUMN `timeSlot` VARCHAR(20) NULL,
    ADD COLUMN `toDate` DATETIME(3) NULL;
