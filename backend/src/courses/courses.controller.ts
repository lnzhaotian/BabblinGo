/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
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
  UseInterceptors,
  UploadedFile,
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
import { CreateLevelDto, UpdateLevelDto } from './dto/level.dto';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';
import { FileInterceptor } from '@nestjs/platform-express';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { diskStorage } from 'multer';
import type { StorageEngine } from 'multer';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

@ApiTags('courses')
@Controller('api/courses')
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  private static ensureUploadDir(dir: string) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  }

  private static multerStorage(): StorageEngine {
    const dest = join(process.cwd(), 'uploads', 'media');
    CoursesController.ensureUploadDir(dest);
    return diskStorage({
      destination: (_req, _file, cb) => cb(null, dest),
      filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const original = file.originalname || '';
        const ext = extname(original);
        cb(null, `${unique}${ext}`);
      },
    });
  }

  // Shared Multer options for media uploads
  private static readonly uploadOptions: MulterOptions = {
    storage: CoursesController.multerStorage(),
    limits: { fileSize: 50 * 1024 * 1024 },
  };

  private static mapFile(file: any) {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access */
    if (!file) return null;
    return {
      filename: file.filename as string,
      mimetype: file.mimetype as string,
      size: file.size as number,
    };
    /* eslint-enable @typescript-eslint/no-unsafe-member-access */
  }

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

  // Levels
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/levels')
  @ApiOperation({ summary: 'Add a level to a course' })
  @ApiBody({ type: CreateLevelDto })
  addLevel(@Param('id') courseId: string, @Body() dto: CreateLevelDto) {
    return this.service.addLevel(courseId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id/levels/:levelId')
  @ApiOperation({ summary: 'Update a level' })
  @ApiBody({ type: UpdateLevelDto })
  updateLevel(
    @Param('id') courseId: string,
    @Param('levelId') levelId: string,
    @Body() dto: UpdateLevelDto,
  ) {
    return this.service.updateLevel(courseId, levelId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id/levels/:levelId')
  @ApiOperation({ summary: 'Remove a level' })
  deleteLevel(
    @Param('id') courseId: string,
    @Param('levelId') levelId: string,
  ) {
    return this.service.removeLevel(courseId, levelId);
  }

  // Lessons
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/levels/:levelId/lessons')
  @ApiOperation({ summary: 'Add a lesson to a level' })
  @ApiBody({ type: CreateLessonDto })
  addLesson(
    @Param('id') courseId: string,
    @Param('levelId') levelId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.service.addLesson(courseId, levelId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id/levels/:levelId/lessons/:lessonId')
  @ApiOperation({ summary: 'Update a lesson' })
  @ApiBody({ type: UpdateLessonDto })
  updateLesson(
    @Param('id') courseId: string,
    @Param('levelId') levelId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.service.updateLesson(courseId, levelId, lessonId, dto);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id/levels/:levelId/lessons/:lessonId')
  @ApiOperation({ summary: 'Remove a lesson' })
  deleteLesson(
    @Param('id') courseId: string,
    @Param('levelId') levelId: string,
    @Param('lessonId') lessonId: string,
  ) {
    return this.service.removeLesson(courseId, levelId, lessonId);
  }

  // Modules
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Post(':id/levels/:levelId/lessons/:lessonId/modules')
  @UseInterceptors(FileInterceptor('file', CoursesController.uploadOptions))
  @ApiOperation({ summary: 'Add a module (text or media) to a lesson' })
  @ApiBody({
    description: 'Multipart form; include file for media modules',
    type: CreateModuleDto,
  })
  addModule(
    @Param('id') courseId: string,
    @Param('levelId') levelId: string,
    @Param('lessonId') lessonId: string,
    @Body() dto: CreateModuleDto,
    @UploadedFile() file?: any,
  ) {
    const f = CoursesController.mapFile(file);
    return this.service.addModule(courseId, levelId, lessonId, dto, f);
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Patch(':id/levels/:levelId/lessons/:lessonId/modules/:moduleId')
  @UseInterceptors(FileInterceptor('file', CoursesController.uploadOptions))
  @ApiOperation({ summary: 'Update a module (metadata and/or replace media)' })
  @ApiBody({
    description: 'Multipart form; include file to replace media',
    type: UpdateModuleDto,
  })
  updateModule(
    @Param('id') courseId: string,
    @Param('levelId') levelId: string,
    @Param('lessonId') lessonId: string,
    @Param('moduleId') moduleId: string,
    @Body() dto: UpdateModuleDto,
    @UploadedFile() file?: any,
  ) {
    const f = CoursesController.mapFile(file);
    return this.service.updateModule(
      courseId,
      levelId,
      lessonId,
      moduleId,
      dto,
      f,
    );
  }

  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Delete(':id/levels/:levelId/lessons/:lessonId/modules/:moduleId')
  @ApiOperation({ summary: 'Remove a module' })
  deleteModule(
    @Param('id') courseId: string,
    @Param('levelId') levelId: string,
    @Param('lessonId') lessonId: string,
    @Param('moduleId') moduleId: string,
  ) {
    return this.service.removeModule(courseId, levelId, lessonId, moduleId);
  }
}
