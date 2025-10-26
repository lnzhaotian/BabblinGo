import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CreateLevelDto } from './level.dto';

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
    type: [CreateLevelDto],
    description: 'List of levels (hierarchical content)',
  })
  @IsOptional()
  @IsArray()
  @Type(() => CreateLevelDto)
  levels?: CreateLevelDto[];

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
