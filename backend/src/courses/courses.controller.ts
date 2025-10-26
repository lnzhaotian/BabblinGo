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
} from '@nestjs/swagger';

@ApiTags('courses')
@Controller('api/courses')
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a new course' })
  @ApiCreatedResponse({
    description: 'The course has been created.',
    type: CreateCourseDto,
  })
  @ApiBody({ type: CreateCourseDto })
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
    type: CreateCourseDto,
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
    type: CreateCourseDto,
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
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
