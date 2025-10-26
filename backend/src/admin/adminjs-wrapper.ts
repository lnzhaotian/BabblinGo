import type { Model } from 'mongoose';
import type { JwtService } from '@nestjs/jwt';
import type { CourseDocument } from '../courses/schemas/course.schema';
import { mountAdminRuntime } from './adminjs-runtime';

export async function initAdmin(
  expressApp: unknown,
  courseModel: Model<CourseDocument>,
  jwtService: JwtService,
  rootPath = '/admin',
): Promise<void> {
  // delegate the runtime-only, dynamic ESM imports to the runtime shim which
  // contains the necessary unsafe operations in a focused file.
  await mountAdminRuntime(expressApp, courseModel, jwtService, rootPath);
}
