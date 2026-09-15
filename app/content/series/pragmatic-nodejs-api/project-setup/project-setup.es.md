---
type: 'post'
title: 'Configurar un proyecto Node.js, Express y TypeScript en 2026'
description: 'El punto de partida para tu próximo proyecto: Node.js, Express y TypeScript con un servidor basado en clases, configuración validada y una estructura organizada por features.'
tags: ['nodejs', 'typescript', 'express', 'backend']
publishedAt: '2025-12-25'
repository: 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/initial-project-setup'
---

Empezar un proyecto de Node.js desde cero puede ser más confuso de lo que parece. Entre la cantidad de paquetes disponibles y las formas de organizar las carpetas, es fácil sentirse abrumado antes de haber escrito la primera línea de código.

Escribí este post para simplificar ese proceso en 2026. Es un punto de partida práctico, pensado para que cualquiera arranque bien desde el primer día, y que a la vez me sirve de referencia cuando necesito levantar un proyecto propio con rapidez.

> **Código y recursos:** El código completo de este post está en GitHub, en la rama [`feature/initial-project-setup`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/initial-project-setup) del repositorio.

## Requisitos previos

Asegúrate de tener instalado Node.js v24 o superior. Verifica tu entorno:

```bash
node --version
```

Esta guía está basada en Node.js v24, pero debería funcionar en otras versiones recientes con ajustes mínimos.

## Paso 1: Inicialización y dependencias

Inicializa el proyecto e instala el stack principal.

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

- `tsx`: Ejecución moderna de TypeScript para desarrollo, con recarga en caliente.

- `@tsconfig/node24`: Una base estricta para entornos Node modernos.

- `Biome`: Herramienta unificada y de alto rendimiento para linting y formato.

## Paso 2: Configuración

Primero inicializamos los archivos de configuración por defecto:

```bash
npx tsc --init
npx @biomejs/biome init
```

Ahora usamos el enfoque moderno de `extends` para TypeScript y una configuración centralizada de Biome para mantener la calidad del código.

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

### Scripts de automatización

Estandarizamos el ciclo de build y de desarrollo dentro de `package.json`.

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

## Paso 3: Estructura de la aplicación

Uso una organización por features. Al agrupar el código dentro de `features/`, mantenemos la encapsulación y el proyecto sigue siendo navegable a medida que crece.

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

## Paso 4: Implementación

### Configuración validada

Primero define tu archivo `.env`, y no olvides incluirlo en el `.gitignore`.

**`.env`**

```
PORT=3000
NODE_ENV=development
DEBUG=true
```

Ahora centralizamos las variables de entorno para evitar fallos en tiempo de ejecución.

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

### La clase Server

Encapsular Express en una clase nos da un ciclo de vida predecible y mantiene protegida la instancia interna.

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

### La capa de features

Los controladores usan arrow functions para preservar el contexto de `this` sin tener que hacer bind manualmente.

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

## Paso 5: Arranque

Agrupamos las rutas de cada feature e inicializamos el servidor.

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

## Ejecutar la aplicación

Para levantar el servidor de desarrollo con recarga en caliente:

```bash
npm run dev
```

Verifica que todo quedó bien probando estos endpoints:

- `Health Check`: GET `http://localhost:3000/health`

- `Get Products`: GET `http://localhost:3000/api/products`

- `Add Product`: POST `http://localhost:3000/api/products`

## Conclusión

Construir un proyecto de Node.js en 2026 no debería sentirse como empezar de cero cada vez. Con un servidor basado en clases, una configuración tipada y una organización por features, la base queda lista para crecer.

La base está puesta. Ahora podemos avanzar con la validación de esquemas y el manejo centralizado de errores, para que la API se mantenga resistente y predecible.
