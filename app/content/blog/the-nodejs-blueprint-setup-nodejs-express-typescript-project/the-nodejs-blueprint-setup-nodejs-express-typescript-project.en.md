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

## Prerequisites

Ensure Node.js v24+ is installed. Verify your environment:

```bash
node --version
```

This guide is based on Node.js v24, but it should be compatible with other recent versions with minimal adjustments.

## Step 1: Initialization and Dependencies

Initialize the project and install the core stack.

```bash
mkdir nodejs-blueprint && cd nodejs-blueprint
npm init -y

# Tooling & Types
npm install -D typescript @types/node @types/express @tsconfig/node24 tsx rimraf 

# Lint and Format, we install a exact version as Biome documentations recommends
npm install -D -E @biomejs/biome

# Core Stack
npm install express dotenv

```

- `tsx`: Modern TypeScript execution for development with hot-reloading.

- `@tsconfig/node24`: A strict baseline for modern Node environments.

- `Biome`: High-performance unified tool for linting and formatting.

## Step 2: Configuration

First, let's initialize the default configuration files:

```bash
npx tsc --init
npx @biomejs/biome init
```

Now, we use a modern `extends` approach for TypeScript and a centralized Biome configuration to enforce code quality.

**`tsconfig.json`**

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

**`biome.json`**

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

### Automation Scripts

Standardize the build and development lifecycle within package.json.

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

## Step 3: Application Structure

I use a Feature-Based Layout. By grouping code into features/, we maintain encapsulation and ensure the project remains navigable as it scales.

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

## Step 4: Implementation

### Validated Configuration

First, define your `.env` file (and don't forget to include it in your `.gitignore`).

**`.env`**

```
PORT=3000
NODE_ENV=development
DEBUG=true
```

Now, we centralize environment variables to prevent runtime failures.

**`src/config/config.ts`**

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

### The Server Class

Encapsulating Express in a class provides a predictable lifecycle and keeps the internal instance protected.

**`src/server.ts`**

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

### Feature Layer

Controllers use arrow functions to preserve `this` context without manual binding.

**`src/features/products/products-controller.ts`**

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

**`src/features/products/products-routes.ts`**

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

## Step 5. Bootstrapping

Aggregate feature routes and initialize the server.

**`src/routes.ts`**

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

**`src/app.ts`**

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

## Running Your Application

Start the development server with hot-reloading, run:

```bash
npm run dev
```

Verify the setup by testing these endpoints:

- `Health Check`: GET `http://localhost:3000/health`

- `Get Products`: GET `http://localhost:3000/api/products`

- `Add Product`: POST `http://localhost:3000/api/products`

## Conclusion

Building a Node.js project in 2026 shouldn't feel like starting from scratch every time. By using a class-based server, type-safe config, and a feature-first layout, you’re setting up a foundation designed for professional scale.

The foundation is solid. Now we can move forward with the implementation of Schema Validation and Global Error Handling to ensure our API remains resilient and predictable.
