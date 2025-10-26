import { Express } from 'express';

export function mountAdminRuntime(
  app: Express,
  courseModel: any,
  jwtService: any,
  usersService: any,
  rootPath?: string,
): Promise<void>;

declare module './adminjs-runtime.runtime.js' {
  import { Express } from 'express';
  export function mountAdminRuntime(
    app: Express,
    courseModel: any,
    jwtService: any,
    usersService: any,
    rootPath?: string,
  ): Promise<void>;
}
