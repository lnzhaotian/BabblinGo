import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateModuleDto {
  @ApiProperty({ example: 'text', enum: ['text', 'image', 'audio', 'video'] })
  @IsIn(['text', 'image', 'audio', 'video'])
  type: 'text' | 'image' | 'audio' | 'video';

  @ApiPropertyOptional({ example: 'Dialogue A' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Hello, how are you?' })
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateModuleDto {
  @ApiPropertyOptional({ enum: ['text', 'image', 'audio', 'video'] })
  @IsOptional()
  @IsIn(['text', 'image', 'audio', 'video'])
  type?: 'text' | 'image' | 'audio' | 'video';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  textContent?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
