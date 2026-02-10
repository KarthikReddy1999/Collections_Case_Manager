import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsPositive } from 'class-validator';

export class CreateCaseDto {
  @ApiProperty({ example: 12 })
  @IsInt()
  @IsPositive()
  customerId!: number;

  @ApiProperty({ example: 77 })
  @IsInt()
  @IsPositive()
  loanId!: number;
}
