import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CoursesService } from './courses.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  ApiBearerAuth,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { CourseResponseDto } from './dto/course-response.dto';
import { PaginatedCoursesDto } from './dto/paginated-courses.dto';

@ApiTags('courses')
@Controller('api/courses')
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new course' })
  @ApiCreatedResponse({
    description: 'The course has been created.',
    type: CourseResponseDto,
  })
  @ApiBody({ type: CreateCourseDto })
  @ApiBadRequestResponse({
    description: 'Invalid request data',
    schema: {
      example: {
        statusCode: 400,
        message: ['title must be a string'],
        error: 'Bad Request',
      },
    },
  })
  @ApiUnauthorizedResponse({
    description: 'Missing or invalid JWT',
    schema: { example: { statusCode: 401, message: 'Unauthorized' } },
  })
  @Post()
  create(@Body() dto: CreateCourseDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List courses with pagination and optional search' })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Page number',
    type: Number,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Items per page',
    type: Number,
  })
  @ApiQuery({
    name: 'q',
    required: false,
    description: 'Search query',
    type: String,
  })
  @ApiResponse({
    status: 200,
    description: 'Paginated list',
    type: PaginatedCoursesDto,
  })
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('q') q?: string,
  ) {
    return this.service.findAll({
      page: Number(page) || 1,
      limit: Number(limit) || 20,
      q,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a course by id' })
  @ApiParam({ name: 'id', description: 'Course Mongo ID' })
  @ApiResponse({
    status: 200,
    description: 'Course found.',
    type: CourseResponseDto,
  })
  @ApiNotFoundResponse({
    description: 'Course not found',
    schema: { example: { statusCode: 404, message: 'Course not found' } },
  })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a course' })
  @ApiParam({ name: 'id', description: 'Course Mongo ID' })
  @ApiBody({ type: UpdateCourseDto })
  @ApiResponse({
    status: 200,
    description: 'Course updated',
    type: CourseResponseDto,
  })
  @ApiBadRequestResponse({
    schema: {
      example: {
        statusCode: 400,
        message: ['slug must be a string'],
        error: 'Bad Request',
      },
    },
  })
  @ApiUnauthorizedResponse({
    schema: { example: { statusCode: 401, message: 'Unauthorized' } },
  })
  @ApiNotFoundResponse({
    schema: { example: { statusCode: 404, message: 'Course not found' } },
  })
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCourseDto) {
    return this.service.update(id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a course' })
  @ApiParam({ name: 'id', description: 'Course Mongo ID' })
  @ApiResponse({ status: 200, description: 'Course deleted' })
  @ApiUnauthorizedResponse({
    schema: { example: { statusCode: 401, message: 'Unauthorized' } },
  })
  @ApiNotFoundResponse({
    schema: { example: { statusCode: 404, message: 'Course not found' } },
  })
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
