import {
  IsString,
  IsOptional,
  IsArray,
  IsBoolean,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class LessonDto {
  @ApiProperty({ example: 'Lesson 1', description: 'Lesson title' })
  @IsString()
  title: string;

  @ApiProperty({ example: 'https://...', description: 'URL to lesson content' })
  @IsString()
  url: string;

  @ApiPropertyOptional({
    example: 120,
    description: 'Duration in seconds (optional)',
  })
  @IsOptional()
  duration?: number;
}

export class CreateCourseDto {
  @ApiProperty({
    example: 'Beginner Conversations',
    description: 'Course title',
  })
  @IsString()
  title: string;

  @ApiProperty({
    example: 'beginner-convos',
    description: 'URL-friendly unique slug',
  })
  @IsString()
  slug: string;

  @ApiPropertyOptional({
    example: 'A short description',
    description: 'Course description',
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'beginner',
    description: 'Course difficulty level',
  })
  @IsOptional()
  @IsString()
  level?: string;

  @ApiPropertyOptional({ type: [LessonDto], description: 'List of lessons' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LessonDto)
  lessons?: LessonDto[];

  @ApiPropertyOptional({ type: [String], example: ['l0', 'conversation'] })
  @IsOptional()
  @IsArray()
  tags?: string[];

  @ApiPropertyOptional({
    example: false,
    description: 'Is the course published?',
  })
  @IsOptional()
  @IsBoolean()
  published?: boolean;
}
