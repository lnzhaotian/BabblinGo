/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  Course,
  CourseDocument,
  LevelItem,
  LessonItem,
  ModuleItem,
} from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { plainToInstance } from 'class-transformer';
import { CourseResponseDto } from './dto/course-response.dto';
import { CreateLevelDto, UpdateLevelDto } from './dto/level.dto';
import { CreateLessonDto, UpdateLessonDto } from './dto/lesson.dto';
import { CreateModuleDto, UpdateModuleDto } from './dto/module.dto';

@Injectable()
export class CoursesService {
  constructor(
    @InjectModel(Course.name) private courseModel: Model<CourseDocument>,
  ) {}

  async create(dto: CreateCourseDto) {
    const created = new this.courseModel(dto as any);
    const saved = await created.save();
    return plainToInstance(CourseResponseDto, saved.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  async findAll({
    page = 1,
    limit = 20,
    q,
  }: {
    page?: number;
    limit?: number;
    q?: string;
  }) {
    const filter: Record<string, any> = {};
    if (q) {
      filter.$or = [
        { title: { $regex: q, $options: 'i' } },
        { description: { $regex: q, $options: 'i' } },
      ];
    }
    const skip = (page - 1) * limit;
    const [docs, total] = await Promise.all([
      this.courseModel.find(filter).skip(skip).limit(limit),
      this.courseModel.countDocuments(filter),
    ]);
    const items = docs.map((d) =>
      plainToInstance(CourseResponseDto, d.toObject(), {
        excludeExtraneousValues: true,
      }),
    );
    return { items, total, page, limit };
  }

  async findOne(id: string) {
    const doc = await this.courseModel.findById(id);
    if (!doc) throw new NotFoundException('Course not found');
    return plainToInstance(CourseResponseDto, doc.toObject(), {
      excludeExtraneousValues: true,
    });
  }

  async update(id: string, dto: UpdateCourseDto) {
    const updated = await this.courseModel.findByIdAndUpdate(id, dto, {
      new: true,
    });
    if (!updated) throw new NotFoundException('Course not found');
    return plainToInstance(CourseResponseDto, updated.toObject(), {
      excludeExtraneousValues: true,
    });
  }
  async remove(id: string) {
    const res = await this.courseModel.findByIdAndDelete(id);
    if (!res) throw new NotFoundException('Course not found');
    return { success: true };
  }

  // Levels
  async addLevel(courseId: string, dto: CreateLevelDto) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const level: LevelItem = {
      name: dto.name,
      order: dto.order ?? 0,
      lessons: [],
    } as LevelItem;
    course.levels = course.levels || [];
    course.levels.push(level);
    await course.save();
    return this.findOne(courseId);
  }

  async updateLevel(courseId: string, levelId: string, dto: UpdateLevelDto) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const level = (course.levels || []).find(
      (l: any) => String(l._id) === String(levelId),
    ) as any as LevelItem | undefined;
    if (!level) throw new NotFoundException('Level not found');
    if (dto.name !== undefined) (level as any).name = dto.name;
    if (dto.order !== undefined) (level as any).order = dto.order;
    await course.save();
    return this.findOne(courseId);
  }

  async removeLevel(courseId: string, levelId: string) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const before = course.levels?.length || 0;
    course.levels = (course.levels || []).filter(
      (l: any) => String(l._id) !== String(levelId),
    );
    if ((course.levels?.length || 0) === before)
      throw new NotFoundException('Level not found');
    await course.save();
    return this.findOne(courseId);
  }

  // Lessons
  async addLesson(courseId: string, levelId: string, dto: CreateLessonDto) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const level = (course.levels || []).find(
      (l: any) => String(l._id) === String(levelId),
    ) as any as LevelItem | undefined;
    if (!level) throw new NotFoundException('Level not found');
    const lesson: LessonItem = {
      title: dto.title,
      description: dto.description,
      order: dto.order ?? 0,
      modules: [],
    } as LessonItem;
    (level as any).lessons = (level as any).lessons || [];
    (level as any).lessons.push(lesson);
    await course.save();
    return this.findOne(courseId);
  }

  async updateLesson(
    courseId: string,
    levelId: string,
    lessonId: string,
    dto: UpdateLessonDto,
  ) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const level = (course.levels || []).find(
      (l: any) => String(l._id) === String(levelId),
    ) as any as LevelItem | undefined;
    if (!level) throw new NotFoundException('Level not found');
    const lesson = ((level as any).lessons || []).find(
      (ls: any) => String(ls._id) === String(lessonId),
    );
    if (!lesson) throw new NotFoundException('Lesson not found');
    if (dto.title !== undefined) lesson.title = dto.title as any;
    if (dto.description !== undefined)
      lesson.description = dto.description as any;
    if (dto.order !== undefined) lesson.order = dto.order as any;
    await course.save();
    return this.findOne(courseId);
  }

  async removeLesson(courseId: string, levelId: string, lessonId: string) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const level = (course.levels || []).find(
      (l: any) => String(l._id) === String(levelId),
    ) as any as LevelItem | undefined;
    if (!level) throw new NotFoundException('Level not found');
    const before = (level as any).lessons?.length || 0;
    (level as any).lessons = ((level as any).lessons || []).filter(
      (ls: any) => String(ls._id) !== String(lessonId),
    );
    if (((level as any).lessons?.length || 0) === before)
      throw new NotFoundException('Lesson not found');
    await course.save();
    return this.findOne(courseId);
  }

  // Modules
  async addModule(
    courseId: string,
    levelId: string,
    lessonId: string,
    dto: CreateModuleDto,
    file?: { filename: string; mimetype: string; size: number } | null,
  ) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const level = (course.levels || []).find(
      (l: any) => String(l._id) === String(levelId),
    ) as any as LevelItem | undefined;
    if (!level) throw new NotFoundException('Level not found');
    const lesson = ((level as any).lessons || []).find(
      (ls: any) => String(ls._id) === String(lessonId),
    );
    if (!lesson) throw new NotFoundException('Lesson not found');
    const moduleItem: ModuleItem = {
      type: dto.type,
      title: dto.title,
      textContent: dto.textContent,
      order: dto.order ?? 0,
    } as ModuleItem;
    if (file && dto.type !== 'text') {
      (moduleItem as any).mediaUrl = `/uploads/media/${file.filename}`;
      (moduleItem as any).mediaMimeType = file.mimetype;
      (moduleItem as any).mediaSize = file.size;
    }
    lesson.modules = lesson.modules || [];
    lesson.modules.push(moduleItem);
    await course.save();
    return this.findOne(courseId);
  }

  async updateModule(
    courseId: string,
    levelId: string,
    lessonId: string,
    moduleId: string,
    dto: UpdateModuleDto,
    file?: { filename: string; mimetype: string; size: number } | null,
  ) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const level = (course.levels || []).find(
      (l: any) => String(l._id) === String(levelId),
    ) as any as LevelItem | undefined;
    if (!level) throw new NotFoundException('Level not found');
    const lesson = ((level as any).lessons || []).find(
      (ls: any) => String(ls._id) === String(lessonId),
    );
    if (!lesson) throw new NotFoundException('Lesson not found');
    const moduleItem = (lesson.modules || []).find(
      (m: any) => String(m._id) === String(moduleId),
    );
    if (!moduleItem) throw new NotFoundException('Module not found');
    if (dto.type !== undefined) moduleItem.type = dto.type as any;
    if (dto.title !== undefined) moduleItem.title = dto.title as any;
    if (dto.textContent !== undefined)
      moduleItem.textContent = dto.textContent as any;
    if (dto.order !== undefined) moduleItem.order = dto.order as any;
    const effectiveType = dto.type ?? moduleItem.type;
    if (file && effectiveType !== 'text') {
      moduleItem.mediaUrl = `/uploads/media/${file.filename}`;
      moduleItem.mediaMimeType = file.mimetype as any;
      moduleItem.mediaSize = file.size as any;
    }
    await course.save();
    return this.findOne(courseId);
  }

  async removeModule(
    courseId: string,
    levelId: string,
    lessonId: string,
    moduleId: string,
  ) {
    const course = await this.courseModel.findById(courseId);
    if (!course) throw new NotFoundException('Course not found');
    const level = (course.levels || []).find(
      (l: any) => String(l._id) === String(levelId),
    ) as any as LevelItem | undefined;
    if (!level) throw new NotFoundException('Level not found');
    const lesson = ((level as any).lessons || []).find(
      (ls: any) => String(ls._id) === String(lessonId),
    );
    if (!lesson) throw new NotFoundException('Lesson not found');
    const before = (lesson.modules?.length || 0) as number;
    lesson.modules = (lesson.modules || []).filter(
      (m: any) => String(m._id) !== String(moduleId),
    );
    if (((lesson.modules?.length || 0) as number) === before)
      throw new NotFoundException('Module not found');
    await course.save();
    return this.findOne(courseId);
  }
}
