import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateLevelDto {
  @ApiProperty({ example: 'Level 1', description: 'Level name' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 0, description: 'Order index' })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateLevelDto {
  @ApiPropertyOptional({ example: 'Level 1 - Updated' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
