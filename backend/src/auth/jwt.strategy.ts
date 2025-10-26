import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

interface JwtPayload {
  sub: string;
  username: string;
  roles: string[];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(configService: ConfigService) {
    const secret =
      configService.get<string>('JWT_SECRET') ?? 'hard!to-guess_secret';

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      // Read secret from ConfigService with fallback
      secretOrKey: secret,
    });
  }

  validate(payload: JwtPayload) {
    // payload: { sub: userId, username, roles }
    return {
      userId: payload.sub,
      username: payload.username,
      roles: payload.roles,
    };
  }
}
