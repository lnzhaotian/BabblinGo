/* eslint-disable */
const { NestFactory } = require('@nestjs/core');
const { MongoMemoryServer } = require('mongodb-memory-server');
const request = require('supertest');
const AppModule = require('../dist/app.module').AppModule;

async function run() {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  // Require compiled JS from dist; ensure project is built first
  // If dist is not present, instruct the user to run `npm run build`.
  // Try to create the app via NestFactory using the compiled AppModule.
  const app = await NestFactory.create(AppModule);
  await app.init();

  try {
    const server = app.getHttpServer();

    const login = await request(server)
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'changeme' });
    console.log('LOGIN', login.status, login.body);

    const token = login.body?.access_token;

    // create with a unique slug to avoid duplicate key errors
    const uniqueSlug = `smoke-course-${Date.now()}`;
    const create = await request(server)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Smoke Course', slug: uniqueSlug, description: 'smoke test' });
    console.log('CREATE', create.status, create.body);

    const list = await request(server).get('/api/courses');
    console.log('LIST', list.status, list.body);

    const id = create.body && create.body.id;
    if (!id) {
      console.warn('Create failed, skipping GET and cleanup');
    } else {
      const get = await request(server).get(`/api/courses/${id}`);
      console.log('GET', get.status, get.body);

      // cleanup: delete the created course so smoke runs are idempotent
      try {
        const del = await request(server)
          .delete(`/api/courses/${id}`)
          .set('Authorization', `Bearer ${token}`);
        console.log('DELETE', del.status, del.body);
      } catch (e) {
        console.warn('Cleanup delete failed', e && e.message ? e.message : e);
      }
    }
  } finally {
    await app.close();
    await mongod.stop();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
