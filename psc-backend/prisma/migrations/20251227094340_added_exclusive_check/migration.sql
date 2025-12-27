-- AlterTable
ALTER TABLE `hall` ADD COLUMN `isExclusive` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `hallreservation` ADD COLUMN `remarks` TEXT NULL;
