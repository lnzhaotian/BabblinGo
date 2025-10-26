import { Controller, Get, Post, Body } from '@nestjs/common';
import { AppService } from './app.service';
import { UsersService } from './users/users.service';

type Creds = { email: string; password: string };

@Controller('api')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHello(): string {
    // return this.appService.getHello();
    return 'BabblinGo API is running!';
  }

  // Debug helper: verify that UsersService + bcrypt work as expected.
  @Post('admin-debug-login')
  async debugAdminLogin(@Body() body: Creds) {
    const users = new UsersService();
    const user = await users.findByUsername(body.email);
    if (!user) return { ok: false, reason: 'no-user' };
    const bcrypt = await import('bcrypt');
    const ok = await bcrypt.compare(body.password, user.passwordHash);
    if (!ok) return { ok: false, reason: 'bad-password' };
    if (!Array.isArray(user.roles) || !user.roles.includes('admin'))
      return { ok: false, reason: 'not-admin' };
    return { ok: true, id: user.id, username: user.username };
  }
}
