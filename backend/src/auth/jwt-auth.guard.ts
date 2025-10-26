import { Injectable, Type } from '@nestjs/common';
import { AuthGuard, IAuthGuard } from '@nestjs/passport';

const JwtAuthGuardBase: Type<IAuthGuard> = AuthGuard('jwt');

@Injectable()
export class JwtAuthGuard extends JwtAuthGuardBase {}
