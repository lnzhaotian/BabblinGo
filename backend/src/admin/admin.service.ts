import { Injectable, OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ModuleRef } from '@nestjs/core';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import type { Request, Response } from 'express';
import { Course, CourseDocument } from '../courses/schemas/course.schema';
import { initAdmin } from './adminjs-wrapper';

@Injectable()
export class AdminService implements OnModuleInit {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly moduleRef: ModuleRef,
    @InjectModel(Course.name)
    private readonly courseModel: Model<CourseDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const jwtService = this.moduleRef.get(JwtService, { strict: false });

      // Mount AdminJS using the typed wrapper which encapsulates dynamic imports.
      // Avoid initializing AdminJS during tests where the Node test runner may not
      // support dynamic ESM imports in the environment. Also allow opting out via
      // SKIP_ADMINJS=true.
      if (
        process.env.NODE_ENV === 'test' ||
        process.env.SKIP_ADMINJS === 'true'
      ) {
        return;
      }

      await initAdmin(
        this.httpAdapterHost.httpAdapter.getInstance(),
        this.courseModel,
        jwtService,
        '/admin',
      );
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e
          ? (e as { message?: unknown }).message
          : String(e);

      console.warn('AdminJS failed to initialize in AdminService:', msg);
    }
  }
}
