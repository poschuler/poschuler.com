---
type: 'post'
title: 'The Node.js Blueprint: Setup Node.js, Express & TypeScript Project in 2026'
description: 'The definitive starting point for your next project. Learn to setup Node.js, Express, and TypeScript using a professional, class-based architecture designed for long-term maintainability and scale.'
tags: ['Nodejs', 'TypeScript', 'Express', 'Backend']
publishedAt: '2025-12-25'
repository: 'https://github.com/poschuler/nodejs-blueprint/tree/initial-project-setup'
---

Starting a new Node.js project from scratch can be surprisingly confusing. With so many choices for packages and folder structures, it’s easy to feel overwhelmed before you've even written a line of code.

I wrote this post to simplify that process for 2026. It's a practical starting point designed to help others get it right from day one, while serving as a reliable reference for whenever I need to bootstrap my own projects quickly.

## Prerequisites: Your Development Environment

Before getting started, ensure that Node.js is installed on your system. You can verify your installation by running the following command in your terminal:

```bash
node --version
```

This guide is based on Node.js v24, but it should be compatible with other recent versions with minimal adjustments. If you need to install Node.js, you can find the official packages at the [Node.js website](https://nodejs.org/en/download/).

## Step 1: Project Initialization

Start by creating a dedicated directory for your project and initializing it with npm. Open your terminal and run:

```bash
mkdir nodejs-blueprint
cd nodejs-blueprint
npm init -y
```

This sequence creates your project folder, navigates into it, and generates a default `package.json` file. This file will manage your project's dependencies and scripts.

## Step 2: Installing Dependencies

Now, we’ll install the packages that form the backbone of the project. I’ve split these into development tools and application runtime dependencies to keep the production environment lean.

### A. TypeScript and Core Tooling

First, we need the tools that help us write and compile our code. Run the following:

```bash
npm install -D typescript @types/node @tsconfig/node24 tsx rimraf
```

Here is a breakdown of each package:

- `typescript` & `@types/node`: The essentials for type safety in a Node.js environment.
- `@tsconfig/node24`: Instead of manual configuration, I use this base config for Node 24. It’s a strict, modern baseline that saves a lot of setup time.
- `tsx`: This is my go-to for development. It lets you run TypeScript files directly without a manual build step.
- `rimraf`: A small but essential utility. It ensures our build scripts work across Windows, macOS, and Linux by providing a consistent way to clear the dist folder.

The `-D` flag designates these as development dependencies, which are not required for the production environment.

### B. Express and Environment Management

Now, we’ll install the runtime dependencies. These are the packages that actually run our application. Note that for TypeScript projects, we also need to install the matching type definitions as development tools.

```bash
# Runtime dependencies
npm install express dotenv

# Type definitions for development
npm install -D @types/express
```

- `express`: Still the industry standard for building predictable, scalable APIs.
- `dotenv`: Essential for managing environment variables securely.
- `@types/express`: Strictly for development, so we get full IntelliSense and type checking while coding.

## Step 3: Project Configuration

Now that the tools are installed, we need to tell them how to behave. We want a setup that is strict enough to catch errors but flexible enough to keep us moving fast.

### A. TypeScript Configuration (`tsconfig.json`)

To get started, initialize a default `tsconfig.json file` in your project root:

```bash
npx tsc --init
```

The generated file is usually massive and filled with comments you'll likely never read. To keep things clean, I prefer the modern `extends` approach. Replace the entire content of that file with the configuration below:

```json
{
  "extends": "@tsconfig/node24/tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "includes": [
    "src/**/*.js",
    "src/**/*.json",
    "src/**/*.ts",
  ],
  "exclude": [
    "dist",
    "node_modules",
  ]
}
```

By extending the `@tsconfig/node24` base we installed earlier, we inherit sensible defaults for a modern Node environment. We only need to explicitly define where our source code lives (src) and where the compiled JavaScript should go (dist).

### B. Biome for Code Quality (`biome.json`)

For code quality, I’ve moved away from the traditional ESLint and Prettier combination in favor of Biome. It’s a single, high-performance tool that handles both linting and formatting instantly.

To get started, install it and initialize your configuration:

```bash
npm install --save-dev --save-exact @biomejs/biome
npx @biomejs/biome init
```

This creates a biome.json file. I recommend replacing its content with this base configuration to ensure a clean, consistent coding style:

```json
{
 "$schema": "https://biomejs.dev/schemas/2.3.10/schema.json",
 "vcs": {
  "enabled": false,
  "clientKind": "git",
  "useIgnoreFile": false
 },
 "files": {
  "ignoreUnknown": false,
  "includes": [
   "src/**/*.js",
   "src/**/*.json",
   "src/**/*.ts",
   "./test/**/*.ts"
  ]
 },
 "formatter": {
  "enabled": true,
  "indentStyle": "space",
  "indentWidth": 2
 },
 "linter": {
  "enabled": true,
  "rules": {
   "recommended": true
  }
 },
 "javascript": {
  "formatter": {
   "quoteStyle": "double"
  }
 },
 "json": {
  "formatter": {
   "enabled": true
  }
 },
 "assist": {
  "enabled": true,
  "actions": {
   "source": {
    "organizeImports": "on"
   }
  }
 }
}
```

### C. NPM Scripts

To keep the development process consistent, add the following scripts to your package.json. This ensures that anyone (or any automated pipeline) knows exactly how to build and run the project.

```json
"scripts": {
    "dev": "tsx --watch src/app.ts",
    "build": "rimraf ./dist && tsc",
    "start": "npm run build && node dist/app.js",
    "biome:lint": "biome lint ./src",
    "biome:lint:fix": "biome lint --write ./src",
    "biome:format": "biome format ./src",
    "biome:format:fix": "biome format --write ./src"
  }
```

- `dev`: This is your daily driver. It uses tsx to run your TypeScript code directly with hot-reloading, so you don't have to restart the server every time you save a file.

- `build`: A two-step process. First, it uses rimraf to wipe any old files in ./dist, then it runs tsc to generate a fresh production build.

- `start`: This is what you'll run in production. It simply runs the compiled JavaScript from your dist folder.

- `biome:lint`: Use these to check for code quality issues. The `:fix` versions are the real time-savers—they automatically repair common linting errors for you.

- `biome:format`: Ensures your code follows a consistent style. Again, using the `:fix` version will automatically reformat your files (indentation, quotes, etc.) based on your biome.json rules.

### D. Environment Variables (`.env`)

In a real-world project, you should never hardcode configuration like port numbers or API keys. Instead, create a .env file in your project root to manage environment-specific settings:

```
# .env
PORT=3000
NODE_ENV=development
DEBUG=true
```

⚠️ Important: To avoid accidentally leaking sensitive information, make sure to add `.env` to your `.gitignore` file immediately. I’ve seen many projects compromised simply because a secret was committed to source control by mistake.

## Step 4: Application Structure

A clean, modular folder structure is the difference between a project that's easy to maintain and one that becomes a nightmare. For this blueprint, I use a feature-based layout.

```
src/
├── app.ts               # Application entry point
├── server.ts            # Core Express server implementation
├── routes.ts            # Main application router
│
├── config/
│   └── config.ts         # Environment variable configuration
│
└── features/
    └── products/        # An example feature module
        ├── products-controller.ts
        └── products-routes.ts
```

Why this specific layout?

- **Features over Folders:** By grouping code into features/, we keep everything related to a single business capability (like "products") in one place. It makes the project much easier to navigate as you add more functionality.

- **Separation of Concerns:** server.ts handles the "plumbing" of Express, while app.ts is just the "on switch." This makes testing significantly easier.

- **Centralized Config:** We don't want process.env scattered all over the code. The config/ folder acts as our single source of truth.

## Step 5: Building the Application

With our configuration set, it's time to write the code. We’ll start by building a reusable server class.

### A. The Server Class (`src/server.ts`)

Instead of writing a few lines of Express code in a flat file, I encapsulate the logic in a Server class.

I prefer this approach because it provides a clear lifecycle for the server, making the setup much more predictable for the team. A class offers a more discoverable structure that keeps the Express instance private and protected. It’s a pragmatic choice: it gives us cleaner syntax for dependency injection, ensuring the codebase is easy to test and scale from day one.

```typescript
// src/server.ts
import express, { type Router } from "express";

// A type defining the properties required to initialize the server.
type ServerProps = {
  port: number;
  routes: Router;
};

export class Server {
  private app = express();
  private readonly port: number;
  private readonly routes: Router;

  constructor(options: ServerProps) {
    const { port, routes } = options;
    this.port = port;
    this.routes = routes;
    this.configure();
  }

  getApp() {
    return this.app;
  }

  // Configures the Express application with necessary middleware.
  private configure() {
    // Middleware to parse incoming JSON requests.
    this.app.use(express.json());
    // Middleware to parse URL-encoded data.
    this.app.use(express.urlencoded({ extended: true }));
    // Mount the application routes.
    this.app.use(this.routes);
  }

  // Starts the server.
  public start() {
    return this.app.listen(this.port, () => {
      console.log(`Server running on port ${this.port}`);
    });
  }
}
```

### B. Environment Configuration (`src/config/config.ts`)

One of the most common points of failure in production is a missing or malformed environment variable. Instead of scattering `process.env` throughout the codebase, I prefer to centralize and validate everything in a single configuration object.

```typescript
import * as dotenv from "dotenv";
dotenv.config();

type Parser<T> = (val: string) => T;

function parseString(val: string): string {
  if (!val || val.trim() === "") {
    throw new Error("Expected non-empty string");
  }
  return val;
}

function parseNumber(val: string): number {
  if (!val || Number.isNaN(Number(val))) {
    throw new Error(`Expected valid number, got "${val}"`);
  }
  return Number(val);
}

function parseBoolean(val: string): boolean {
  if (val !== "true" && val !== "false") {
    throw new Error(`Expected "true" or "false", got "${val}"`);
  }
  return val === "true";
}

function getEnv<T>(name: string, parser: Parser<T>, defaultValue?: T): T {
  const raw = process.env[name];
  if (raw === undefined) {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return parser(raw);
}

export const config = {
  app: {
    port: getEnv("PORT", parseNumber, 3000),
    env: getEnv("NODE_ENV", parseString, "development"),
    debug: getEnv("DEBUG", parseBoolean, false),
  }
};
```

This structure ensures the application fails fast; if a critical variable is missing in the .env file, the service won't even start, preventing silent failures deep in your business logic. By using generic helpers, we gain full type safety and IntelliSense, transforming raw strings into reliable numbers and booleans.

### C. The Products Feature

To show how the "features" structure works in practice, let’s implement a simple module for managing products. Instead of global folders for all controllers and routes, we keep everything related to "Products" in its own directory.

**Controller (`src/features/products/products-controller.ts`)**

The controller is where our request handling logic lives. I prefer using class-based controllers with arrow functions to ensure the `this` context is always preserved without manual binding.

```typescript
import type { Request, Response } from "express";

const products = [
  {
    id: 1,
    name: 'Laptop',
    description: 'A high-performance laptop',
    price: 1200.00
  },
  {
    id: 2,
    name: 'Smartphone',
    description: 'A feature-rich smartphone',
    price: 800.00
  },
];


export class ProductsController {

  public getProducts = async (_: Request, res: Response) => {

    res.status(200).json(products);
  };

  public addProduct = async (_: Request, __: Response) => {
    throw new Error("Not implemented");
  };
}
```

**Routes (`src/features/products/products-routes.ts`)**

The routes file acts as the entry point for this specific feature. We encapsulate it in a function that returns an Express Router.

```typescript
import { Router } from "express";
import { ProductsController } from "./products-controller";

export const productsRoutes = (): Router => {
  const router = Router();

  const controller = new ProductsController();

  router.get(
    "/",
    controller.getProducts,
  );

  router.post(
    "/",
    controller.addProduct,
  );

  return router;
};
```

Why this is practical:

- Self-Contained Features: If you ever need to delete or move the "Products" functionality, you only have to touch one folder. This is an time-saver in large projects.

- Encapsulation: By initializing the controller inside the routes function, we keep the internal implementation details hidden from the rest of the app.

- Clear Responsibility: The routes file defines where the request goes, and the controller defines what happens when it gets there.

### D. Main Router (`src/routes.ts`)

The main router aggregates all feature-specific routes into a single entry point. This centralized approach keeps the API structure predictable and allows us to implement global endpoints that are critical for the server's lifecycle.

```typescript
import { Router, type Request, type Response } from "express";
import { productsRoutes } from "./features/products/products-routes";

export const appRoutes = (): Router => {
  const router = Router();

  router.use("/api/products", productsRoutes());

  router.get('/health',
    (_: Request, res: Response) => {
      res.json({
        status: 'up',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
      });
    });

  return router;
};
```

Including a health check is a practical requirement for any professional deployment. It moves beyond "hoping" the app is live by giving platforms like Azure/AWS/GCP a clear signal to verify the server's availability. It’s an essential detail that ensures the system is ready to be monitored and managed effectively in a production environment.

### E. Application Entry Point (`src/app.ts`)

This is the "on switch" for our entire system. Its only responsibility is to pull in our configuration and routes, and use them to initialize the `Server` class we built earlier.

```typescript
import { config } from "./config/config";
import { appRoutes } from "./routes";
import { Server } from "./server";

async function main() {

  const server = new Server({
    port: config.app.port,
    routes: appRoutes(),
  });

  server.start();
}

main();
```

This structure ensures a clean separation of concerns; the entry point doesn't contain business logic or server configuration. By using a main() function, we create a perfect spot to handle asynchronous tasks—like database connections or cache warming—before the server starts. It is a short, readable approach that provides total clarity on how the process initializes, making it easy to scale as the system grows.

## Running Your Application

To start the development server with hot-reloading, run:

```bash
npm run dev
```

The server should initialize and display: Server is running on `http://localhost:3000`. You can now verify the setup by testing these endpoints:

- `Health Check`: GET `http://localhost:3000/health`

- `Get Products`: GET `http://localhost:3000/api/products`

- `Add Product`: POST `http://localhost:3000/api/products`

## Next Steps

This is just the foundation. I will be covering the following topics in next posts:

- Adding Schema Validation and Error Handling: Ensuring our business logic only processes high-quality data and that the API provides consistent, predictable responses when things go wrong.

- Adding Persistence with Docker & PostgreSQL: Moving beyond in-memory mocks to a professional data layer. We’ll use Docker to spin up a local PostgreSQL instance and integrate it into our architecture.

- Implementing CRUD: Building out the core business logic for our features, ensuring the flow from the router to the database is clean and maintainable.

- Quality & Testing: Implementing a testing strategy that validates our logic from the start. As an architect, I believe quality isn't optional—it's the bedrock of a reliable system.

- Authentication & Security: Hardening the API by implementing identity management to ensure only authorized users can access our resources.

## Conclusion

Building a Node.js project in 2026 shouldn't feel like starting from scratch every time. By using a class-based server, type-safe config, and a feature-first layout, you’re not just writing code—you’re setting up the foundational layer of what will become a complete, professional repository.

This is the exact starting point I use to skip the over-engineering phase and get straight to what matters: delivering value. I hope this helps you jump into your next project with the confidence that your base is solid and ready for the real-world features we'll be adding next.
