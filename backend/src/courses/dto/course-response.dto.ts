import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class LessonResponseDto {
  @Expose()
  @ApiProperty({ example: 'Lesson 1' })
  title: string;

  @Expose()
  @ApiProperty({ example: 'https://...' })
  url: string;

  @Expose()
  @ApiPropertyOptional({ example: 120 })
  duration?: number;
}

export class CourseResponseDto {
  @Expose()
  @ApiProperty({
    example: '64a1f2c9b3e4f1a2b3c4d5e6',
    description: 'MongoDB ObjectId',
  })
  id: string;

  @Expose()
  @ApiProperty({ example: 'Beginner Conversations' })
  title: string;

  @Expose()
  @ApiProperty({ example: 'beginner-convos' })
  slug: string;

  @Expose()
  @ApiPropertyOptional({ example: 'A short description' })
  description?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'beginner' })
  level?: string;

  @Expose()
  @ApiPropertyOptional({ type: [LessonResponseDto] })
  lessons?: LessonResponseDto[];

  @Expose()
  @ApiPropertyOptional({ type: [String] })
  tags?: string[];

  @Expose()
  @ApiPropertyOptional({ example: false })
  published?: boolean;

  @Expose()
  @ApiProperty({ example: '2025-10-26T10:00:00.000Z' })
  createdAt: string;

  @Expose()
  @ApiProperty({ example: '2025-10-26T10:00:00.000Z' })
  updatedAt: string;
}
