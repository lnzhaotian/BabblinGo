import { Injectable } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import { compare } from 'bcrypt';
import { JwtService } from '@nestjs/jwt';

interface AuthenticatedUser {
  id: number | string;
  username: string;
  roles?: string[];
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(username: string, pass: string) {
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      return null;
    }

    const match = await compare(pass, user.passwordHash);
    if (!match) {
      return null;
    }

    const { passwordHash, ...result } = user;
    void passwordHash;
    return result;
  }

  login(user: AuthenticatedUser) {
    const payload: {
      username: string;
      sub: number | string;
      roles: string[];
    } = {
      username: user.username,
      sub: user.id,
      roles: user.roles ?? [],
    };
    return { access_token: this.jwtService.sign(payload) };
  }
}
