declare module 'adminjs' {
  type AdminJSOptions = { resources?: any[]; rootPath?: string };

  export class AdminJS {
    constructor(opts?: AdminJSOptions);
    options: { rootPath: string };
    static registerAdapter(adapter: unknown): void;
  }

  export default AdminJS;
}

declare module '@adminjs/express' {
  import AdminJS from 'adminjs';
  export function buildRouter(admin: AdminJS): import('express').Router;
  export default { buildRouter };
}

declare module '@adminjs/mongoose' {
  const adapter: any;
  export default adapter;
}
