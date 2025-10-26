import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ApiTags, ApiBody, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

class LoginDto {
  @ApiProperty({ example: 'admin' })
  @IsString()
  username: string;

  @ApiProperty({ example: 'changeme' })
  @IsString()
  password: string;
}

interface User {
  id: string;
  username: string;
  // Add other user properties as needed
}

@ApiTags('auth')
@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @ApiOperation({ summary: 'Login and receive a JWT access token' })
  @ApiBody({ type: LoginDto })
  @ApiResponse({ status: 201, description: 'JWT token returned' })
  @Post('login')
  async login(@Body() dto: LoginDto) {
    // login DTO received (ValidationPipe will ensure properties exist)
    const user: User | null = await this.authService.validateUser(
      dto.username,
      dto.password,
    );
    if (!user) throw new UnauthorizedException('Invalid credentials');
    return this.authService.login(user);
  }
}
