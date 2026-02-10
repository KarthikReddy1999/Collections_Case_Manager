import { ApiProperty } from '@nestjs/swagger';
import { ActionOutcome, ActionType } from '@prisma/client';
import { IsEnum, IsString, MaxLength } from 'class-validator';

export class AddActionDto {
  @ApiProperty({ enum: ActionType, example: ActionType.CALL })
  @IsEnum(ActionType)
  type!: ActionType;

  @ApiProperty({ enum: ActionOutcome, example: ActionOutcome.PROMISE_TO_PAY })
  @IsEnum(ActionOutcome)
  outcome!: ActionOutcome;

  @ApiProperty({ example: 'Customer promised to pay on Friday' })
  @IsString()
  @MaxLength(1000)
  notes!: string;
}
