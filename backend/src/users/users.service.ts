import { Injectable } from '@nestjs/common';
import bcrypt from 'bcrypt';

export type User = {
  id: string;
  username: string;
  passwordHash: string;
  roles?: string[];
};

@Injectable()
export class UsersService {
  private users: User[] = [];

  constructor() {
    // Seed a single admin user for development. Password: 'changeme'
    const hash: string = bcrypt.hashSync('changeme', 10);
    const admin: User = {
      id: '1',
      username: 'admin',
      passwordHash: hash,
      roles: ['admin'],
    };
    this.users.push(admin);
  }

  findByUsername(username: string): Promise<User | undefined> {
    return Promise.resolve(this.users.find((u) => u.username === username));
  }

  findById(id: string): Promise<User | undefined> {
    return Promise.resolve(this.users.find((u) => u.id === id));
  }
}
