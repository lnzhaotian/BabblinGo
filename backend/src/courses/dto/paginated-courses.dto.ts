import { ApiProperty } from '@nestjs/swagger';
import { CourseResponseDto } from './course-response.dto';

export class PaginatedCoursesDto {
  @ApiProperty({ type: [CourseResponseDto] })
  items: CourseResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 20 })
  limit: number;
}
