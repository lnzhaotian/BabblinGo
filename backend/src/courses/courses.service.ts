import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Course, CourseDocument } from './schemas/course.schema';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { plainToInstance } from 'class-transformer';
import { CourseResponseDto } from './dto/course-response.dto';

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
}
