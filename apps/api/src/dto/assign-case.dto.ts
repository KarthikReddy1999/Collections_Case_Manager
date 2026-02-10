import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Min } from 'class-validator';

export class AssignCaseDto {
  @ApiPropertyOptional({
    example: 3,
    description: 'Optional optimistic-lock version from the latest case read',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  expectedVersion?: number;
}
