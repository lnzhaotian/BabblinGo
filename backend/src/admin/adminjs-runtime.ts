/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import type { Model } from 'mongoose';
import type { JwtService } from '@nestjs/jwt';
import type { CourseDocument } from '../courses/schemas/course.schema';

export async function mountAdminRuntime(
  expressApp: unknown,
  courseModel: Model<CourseDocument>,
  jwtService: JwtService,
  rootPath = '/admin',
): Promise<void> {
  try {
    const AdminJSModule = (await import('adminjs')) as any;
    const AdminJSMongooseModule = (await import('@adminjs/mongoose')) as any;
    const AdminJSExpressModule = (await import('@adminjs/express')) as any;

    const AdminJS = AdminJSModule.default ?? AdminJSModule;
    const AdminJSMongoose =
      AdminJSMongooseModule.default ?? AdminJSMongooseModule;
    const AdminJSExpress = AdminJSExpressModule.default ?? AdminJSExpressModule;

    AdminJS.registerAdapter(AdminJSMongoose);

    const admin = new AdminJS({ resource: courseModel, rootPath });
    const adminRouter = AdminJSExpress.buildRouter(admin);

    const adminAuth = (req: any, res: any, next: any) => {
      try {
        const header = req.headers.authorization as string | undefined;
        if (!header) return res.status(401).send('Unauthorized');
        const token = header.split(' ')[1];
        if (!token) return res.status(401).send('Unauthorized');

        const payload = jwtService.verify(token, {
          secret: process.env.JWT_SECRET ?? 'hard!to-guess_secret',
        });
        if (!payload || typeof payload !== 'object')
          return res.status(403).send('Forbidden');

        const roles = payload.roles;
        if (!Array.isArray(roles) || !roles.includes('admin'))
          return res.status(403).send('Forbidden');

        return next();
      } catch {
        return res.status(401).send('Unauthorized');
      }
    };

    const app = expressApp as any;
    app.use(rootPath, adminAuth, adminRouter);
  } catch (err) {
    console.warn(
      'AdminJS runtime mount failed:',
      err && err.message ? err.message : err,
    );
  }
}
