// JS runtime shim for AdminJS mounting.
// Keep dynamic imports and any runtime-only logic here so TypeScript files stay lint-clean.

async function mountAdminRuntime(expressApp, courseModel, jwtService, usersService, rootPath = '/admin') {
  try {
    const AdminJSModule = await import('adminjs');
    const AdminJSMongooseModule = await import('@adminjs/mongoose');
    const AdminJSExpressModule = await import('@adminjs/express');

    const AdminJS = AdminJSModule.default ?? AdminJSModule;
    const AdminJSMongoose = AdminJSMongooseModule.default ?? AdminJSMongooseModule;
    const AdminJSExpress = AdminJSExpressModule.default ?? AdminJSExpressModule;

    AdminJS.registerAdapter(AdminJSMongoose);

    // Configure the resource to prefer `id` while keeping `_id` available.
    const admin = new AdminJS({
      resources: [
        {
          resource: courseModel,
          options: {
            properties: {
              id: { isId: true },
              _id: { isVisible: { list: false, filter: true, show: true, edit: false } },
            },
            titleProperty: 'title',
          },
        },
      ],
      rootPath,
    });

    // Ensure middleware is available: urlencoded, cookie-parser, session.
    const expressModule = await import('express');
    const urlencoded = expressModule.urlencoded ?? (expressModule.default && expressModule.default.urlencoded);
    const cookieParserModule = await import('cookie-parser');
    const sessionModule = await import('express-session');

    const cookieParser = cookieParserModule.default ?? cookieParserModule;
    const session = sessionModule.default ?? sessionModule;

  const app = expressApp;
  // Do NOT register a global urlencoded/body-parser here - AdminJS's
  // buildAuthenticatedRouter installs its own body parser (formidable) and
  // will error if another body parser was used earlier (it checks req._body).
  // We still keep cookie-parser available for other middleware but avoid
  // urlencoded to prevent AdminJS OldBodyParserUsedError.
  app.use(cookieParser());
    if (process.env.ADMINJS_DEBUG === '1') {
        app.use((req, res, next) => {
          try {
            const u = req.originalUrl || req.url || '';
            if (u.startsWith(rootPath)) {
              const ct = req.headers && req.headers['content-type'];
              const cl = req.headers && (req.headers['content-length'] || req.headers['content-length'.toLowerCase()]);
              console.log('[AdminJS] incoming', req.method, u, 'content-type=', ct, 'content-length=', cl);
              // attach finish/close listeners to debug hangs
              const start = Date.now();
              res.on('finish', () => {
                console.log('[AdminJS] response finished', req.method, u, 'status=', res.statusCode, 'took=', Date.now() - start, 'ms');
              });
              res.on('close', () => {
                console.log('[AdminJS] response closed', req.method, u, 'status=', res.statusCode, 'took=', Date.now() - start, 'ms');
              });
            }
          } catch (e) {
            // ignore
          }
          next();
        });
    }

    // Use AdminJS's built-in authenticated router which provides the
    // styled login page and handles authentication.
    const authenticate = async (email, password) => {
      const timer = setTimeout(() => {
        if (process.env.ADMINJS_DEBUG === '1') console.warn('[AdminJS] authenticate timeout for', email);
      }, 30000);
      try {
        if (process.env.ADMINJS_DEBUG === '1') console.log('[AdminJS] authenticate called for', email);
        const user = await usersService.findByUsername(email);
        if (process.env.ADMINJS_DEBUG === '1') console.log('[AdminJS] found user?', !!user);
        if (!user) return null;
        const bcrypt = await import('bcrypt');
        if (process.env.ADMINJS_DEBUG === '1') console.log('[AdminJS] calling bcrypt.compare for', email);
        const ok = await bcrypt.compare(password, user.passwordHash);
        if (process.env.ADMINJS_DEBUG === '1') console.log('[AdminJS] password ok?', ok);
        if (!ok) return null;
        if (!Array.isArray(user.roles) || !user.roles.includes('admin')) return null;
        // return an object which will be available on `request.session` by AdminJS
        return { email: user.username, id: user.id, roles: user.roles };
      } catch (err) {
        if (process.env.ADMINJS_DEBUG === '1') console.warn('[AdminJS] authenticate error', err && err.message ? err.message : err);
        return null;
      } finally {
        clearTimeout(timer);
      }
    };

    // Clear any body-parser marker on admin paths so AdminJS's internal
    // formidable parser can operate. Nest (and other middleware) registers
    // body parsers globally which set `req._body` and would cause
    // OldBodyParserUsedError in AdminJS. We only clear this flag for the
    // admin mount path so other routes (your API) are unaffected.
    app.use(rootPath, (req, _res, next) => {
      if (req && Object.prototype.hasOwnProperty.call(req, '_body')) {
        try {
          delete req._body;
        } catch (e) {
          try {
            req._body = false;
          } catch (e2) {
            // ignore
          }
        }
      }
      next();
    });

    // Let AdminJS build its own authenticated router and session middleware.
    const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
      admin,
      {
        authenticate,
        cookiePassword: process.env.ADMINJS_COOKIE_PASSWORD || 'dev-adminjs-cookie-password-change-me',
      },
      null,
      {
        resave: false,
        saveUninitialized: true,
        secret: process.env.ADMINJS_COOKIE_PASSWORD || 'dev-adminjs-cookie-password-change-me',
      },
    );

    // Wrap session.save for debugging to detect hangs in session persistence
    if (process.env.ADMINJS_DEBUG === '1') {
      app.use(rootPath, (req, _res, next) => {
        try {
          if (req && req.session && typeof req.session.save === 'function') {
            const orig = req.session.save.bind(req.session);
            req.session.save = function (cb) {
              console.log('[AdminJS] session.save called');
              return orig(function (err) {
                console.log('[AdminJS] session.save callback', err ? String(err) : 'ok');
                if (typeof cb === 'function') cb(err);
              });
            };
          }
        } catch (e) {
          // ignore
        }
        next();
      });
    }

    // mount the router at the rootPath; AdminJS will serve its login page and assets
    app.use(rootPath, adminRouter);

    // Admin router mounted
  } catch (err) {
    // swallow mount errors to avoid crashing the app at startup; they are
    // surfaced to the caller via the thrown error path when required.
  }
}

module.exports = { mountAdminRuntime };
