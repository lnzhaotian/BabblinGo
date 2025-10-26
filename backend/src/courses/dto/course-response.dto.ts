import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ModuleResponseDto {
  @Expose()
  @ApiProperty({ enum: ['text', 'image', 'audio', 'video'] })
  type: 'text' | 'image' | 'audio' | 'video';

  @Expose()
  @ApiPropertyOptional()
  title?: string;

  @Expose()
  @ApiPropertyOptional()
  textContent?: string;

  @Expose()
  @ApiPropertyOptional({ example: '/uploads/media/file.png' })
  mediaUrl?: string;

  @Expose()
  @ApiPropertyOptional({ example: 'image/png' })
  mediaMimeType?: string;

  @Expose()
  @ApiPropertyOptional({ example: 102400 })
  mediaSize?: number;

  @Expose()
  @ApiPropertyOptional({ example: 0 })
  order?: number;
}

export class LessonResponseDto {
  @Expose()
  @ApiProperty({ example: 'Lesson 1' })
  title: string;

  @Expose()
  @ApiPropertyOptional({ example: 'Intro to greetings' })
  description?: string;

  @Expose()
  @ApiPropertyOptional({ example: 0 })
  order?: number;

  @Expose()
  @ApiPropertyOptional({ type: [ModuleResponseDto] })
  modules?: ModuleResponseDto[];
}

export class LevelResponseDto {
  @Expose()
  @ApiProperty({ example: 'Level 1' })
  name: string;

  @Expose()
  @ApiPropertyOptional({ example: 0 })
  order?: number;

  @Expose()
  @ApiPropertyOptional({ type: [LessonResponseDto] })
  lessons?: LessonResponseDto[];
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
  @ApiPropertyOptional({ type: [LevelResponseDto] })
  levels?: LevelResponseDto[];

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
