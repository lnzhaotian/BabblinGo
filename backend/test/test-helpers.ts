import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { AppModule } from '../src/app.module';

export async function setupTestApp(): Promise<{
  app: INestApplication;
  mongod: MongoMemoryServer;
}> {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleFixture.createNestApplication();
  await app.init();

  return { app, mongod };
}

export async function teardownTestApp(
  app?: INestApplication,
  mongod?: MongoMemoryServer,
): Promise<void> {
  if (app) {
    try {
      await app.close();
    } catch {
      // ignore
    }
  }

  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }

  if (mongod) {
    try {
      await mongod.stop();
    } catch {
      // ignore
    }
  }
}
