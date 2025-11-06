import { IsNotEmpty, IsOptional } from 'class-validator';

export class RoomDto {
    @IsOptional()
    id?: string | number
    @IsNotEmpty({message: "Room Number must be provied"})
    roomNumber: string;
    @IsNotEmpty({message: "Room type must be provided"})
    roomTypeId: string;
    @IsNotEmpty({message: "Description must be provided"})
    description: string;
    
    @IsNotEmpty({message: "Activity must be provided"})
    isActive: Boolean;
    @IsNotEmpty({message: "OutofOrder must be provided"})
    isOutOfOrder: Boolean;

    @IsOptional()
    outOfOrderFrom?: string

    @IsOptional()
    outOfOrderTo?: string;

    @IsOptional()
    outOfOrderReason?: string;
}
