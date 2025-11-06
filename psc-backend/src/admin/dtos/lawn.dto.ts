import { IsBoolean, IsNotEmpty, IsOptional } from "class-validator";


export class LawnDto{
    @IsOptional()
    id?:string;

    @IsNotEmpty({message: "description must be provided"})
    description: string;
    @IsNotEmpty({message: "lawn category must be selected"})
    lawnCategoryId: string;

    @IsNotEmpty({message: "Minimum Guests must be provided"})
    minGuests: string;
    @IsNotEmpty({message: "Maximum Guests must be provided"})
    maxGuests: string;

    @IsNotEmpty({message: "charges for members must be provided"})
    memberCharges: string;
    @IsNotEmpty({message: "charges for guests must be provided"})
    guestCharges: string;

    @IsBoolean()
    isBooked: boolean

    @IsNotEmpty({message: "lawn category should be provided"})
    lawnCategory: string


}