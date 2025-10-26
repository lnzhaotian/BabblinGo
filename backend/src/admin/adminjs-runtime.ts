/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */

// Thin TypeScript wrapper that delegates to the runtime JS shim.
export async function mountAdminRuntime(
  expressApp: import('express').Express,
  courseModel: import('mongoose').Model<any>,
  jwtService: import('@nestjs/jwt').JwtService,
  usersService: import('../users/users.service').UsersService,
  rootPath = '/admin',
): Promise<void> {
  // dynamic import of the JS runtime (keeps runtime-only unsafe code out of TS)
  // Attempt to resolve the runtime shim from the compiled `dist` folder first
  // (used in production builds), and fall back to the `src` copy when running
  // under ts-node / nest's watch mode.
  const { pathToFileURL } = await import('url');
  const path = await import('path');

  const candidates = [
    path.join(__dirname, 'adminjs-runtime.runtime.js'), // dist/admin/adminjs-runtime.runtime.js
    path.join(process.cwd(), 'src', 'admin', 'adminjs-runtime.runtime.js'), // src/admin/adminjs-runtime.runtime.js
  ];

  let mod: unknown = null;
  let lastErr: unknown = null;
  for (const candidate of candidates) {
    try {
      const url = pathToFileURL(candidate).href;

      mod = await import(url);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
    }
  }
  if (!mod) {
    // Re-throw the last error (if it's an Error) so startup continues to show
    // the underlying cause. Convert non-Error values into an Error instance.
    if (lastErr instanceof Error) throw lastErr;
    let msg: string;
    if (lastErr === null || lastErr === undefined) {
      msg = 'Could not load adminjs runtime shim';
    } else if (typeof lastErr === 'object') {
      try {
        msg = JSON.stringify(lastErr);
      } catch {
        msg = 'Could not load adminjs runtime shim';
      }
    } else if (
      typeof lastErr === 'string' ||
      typeof lastErr === 'number' ||
      typeof lastErr === 'boolean'
    ) {
      msg = `${lastErr}`;
    } else {
      // fallback for symbol/function/bigint etc.
      try {
        msg = JSON.stringify(lastErr);
      } catch {
        msg = 'Could not load adminjs runtime shim';
      }
    }
    throw new Error(msg);
  }
  return (mod as any).mountAdminRuntime(
    expressApp,
    courseModel,
    jwtService,
    usersService,
    rootPath,
  );
}
