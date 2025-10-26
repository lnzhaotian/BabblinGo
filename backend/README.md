<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Development setup (MongoDB)

This project uses MongoDB via Mongoose. The quickest way to run a local MongoDB for development is with Docker. The steps below include recommended package installs, a Docker command (or docker-compose), environment variables, and a simple seed/run workflow.

1) Install recommended backend packages (if not already installed):

```bash
cd backend
# validation & serialization
npm install class-validator class-transformer

# auth & passport
npm install @nestjs/jwt passport passport-jwt @nestjs/passport

# config and swagger
npm install @nestjs/config @nestjs/swagger swagger-ui-express

# helper types (optional for dev)
npm install --save-dev @types/passport-jwt
```

2) Start MongoDB via Docker (quick):

```bash
# run a local mongo on default 27017
docker run --name babblingo-mongo -p 27017:27017 -d mongo:6
```

Or use docker-compose (create a small `docker-compose.yml` in the repo root):

```yaml
version: '3.8'
services:
  mongo:
    image: mongo:6
    ports:
      - '27017:27017'
    volumes:
      - mongo-data:/data/db
volumes:
  mongo-data:
```

Run it with:

```bash
docker compose up -d
```

3) Environment variables

Copy `.env.example` (if present) or create a `.env` at `backend/.env` with at least these values for local dev:

```
MONGODB_URI=mongodb://localhost:27017/babblingo
JWT_SECRET=dev_jwt_secret_change_me
JWT_EXPIRES_IN=3600s
```

4) Seed data (simple):

The backend currently includes a minimal `UsersService` that seeds a dev user when running in development. If you want to insert example courses, you can use a small Node script or call the API endpoints.

Example quick seeding script (create `backend/scripts/seed.js`):

```js
// simple example using mongoose
const mongoose = require('mongoose');
// adjust the path below if you compile TS before running the script
const CourseSchema = require('../dist/courses/schemas/course.schema').Course;

async function run() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/babblingo');
  const CourseModel = mongoose.model('Course');
  await CourseModel.create({ title: 'Hello', slug: 'hello', description: 'Demo', level: 'beginner', lessons: [] });
  console.log('seeded');
  process.exit(0);
}

run().catch((e) => { console.error(e); process.exit(1); });
```

Run the seed script (build first if using TypeScript output paths):

```bash
cd backend
# if using ts-node you can run directly (install ts-node first)
npx ts-node scripts/seed.ts
```

5) Run the backend in development

```bash
cd backend
npm run start:dev
```

6) Verify

- Visit Swagger UI at: http://localhost:3000/api/docs
- Use `/api/auth/login` to get a dev token (seed user exists for development). Then call protected endpoints.

Notes on migrations and schema changes

- MongoDB with Mongoose is schemaless on the server side; typical "migrations" are either:
  - writing idempotent scripts that update documents (preferred), or
  - using a migration tool like `migrate-mongo` for structured migration files.
- If you want migration files, add `migrate-mongo` to dev dependencies and create a `migrations/` folder. I can add an example migration if you'd like.

## Tests and smoke scripts

We include a small suite of developer-friendly tests and a smoke script to quickly verify the API.

- E2E tests (Jest + Supertest)
  - Location: `backend/test/*.spec.ts` (example: `test/courses.e2e-spec.ts`).
  - These tests use `mongodb-memory-server`, so they run an ephemeral in-memory MongoDB instance and do not require a running external MongoDB.
  - Run a single e2e test file:

  ```bash
  cd backend
  npm run test:e2e -- test/courses.e2e-spec.ts --runInBand
  ```

  - Run the full test suite (unit + e2e):

  ```bash
  npm test
  ```

- Smoke script (quick manual check)
  - Location: `backend/scripts/smoke.js`.
  - What it does: builds the backend, runs the compiled app against an in-memory MongoDB, performs login, create, list, get, and cleanup (delete) steps and prints responses.
  - NPM script: `npm run smoke` (builds and executes the script).
  - Run it:

  ```bash
  cd backend
  npm run smoke
  ```

- Notes
  - The smoke script requires the project to be buildable (`npm run build`); `npm run smoke` handles that automatically.
  - Tests and smoke runs are intended for development and CI. The e2e tests are self-contained and safe to run in CI because they use an in-memory MongoDB.
  - If you want me to add a GitHub Actions workflow to run the e2e test on push, I can add a small YAML file under `.github/workflows/`.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
