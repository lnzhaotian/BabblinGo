import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class CreateLessonDto {
  @ApiProperty({ example: 'Greetings', description: 'Lesson title' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Introduction to greetings' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}

export class UpdateLessonDto {
  @ApiPropertyOptional({ example: 'Greetings (Updated)' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'More details about greetings' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @IsInt()
  @Min(0)
  order?: number;
}
