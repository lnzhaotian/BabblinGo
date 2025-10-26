/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { AppModule } from '../src/app.module';

jest.setTimeout(60_000);

describe('Courses e2e (smoke)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    // ensure mongoose connections are fully closed to let Jest exit cleanly
    try {
      await mongoose.disconnect();
    } catch {
      // ignore
    }
    if (mongod) await mongod.stop();
  });

  it('login, create, list and get course', async () => {
    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'changeme' })
      .expect(201);

    expect(loginRes.body).toHaveProperty('access_token');
    const token = loginRes.body.access_token;

    // Create course (use unique slug to avoid collisions across test runs)
    const uniqueSlug = `e2e-course-${Date.now()}`;
    const createRes = await request(app.getHttpServer())
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'E2E Course', slug: uniqueSlug, description: 'desc' })
      .expect(201);

    expect(createRes.body).toHaveProperty('id');
    expect(createRes.body).toHaveProperty('title', 'E2E Course');

    const courseId = createRes.body.id;

    // List
    const listRes = await request(app.getHttpServer())
      .get('/api/courses')
      .expect(200);

    expect(listRes.body).toHaveProperty('items');
    expect(Array.isArray(listRes.body.items)).toBe(true);

    // Get by id
    const getRes = await request(app.getHttpServer())
      .get(`/api/courses/${courseId}`)
      .expect(200);

    expect(getRes.body).toHaveProperty('id', courseId);
    expect(getRes.body).toHaveProperty('title', 'E2E Course');
  });
});
