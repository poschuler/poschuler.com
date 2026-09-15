---
type: 'post'
title: 'Validación de esquemas y manejo centralizado de errores'
description: 'Validación con Zod y un middleware que concentra el manejo de errores, para que la API responda siempre de la misma forma cuando algo falla.'
tags: ['nodejs', 'typescript', 'express', 'backend', 'zod', 'error-handling']
publishedAt: '2025-12-27'
repository: 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/validation-error-handling'
---

Al construir una API, validar la entrada a mano suele terminar en un montón de `if` repartidos por el código y en respuestas de error que no se parecen entre sí. Un enfoque más limpio es usar Zod para declarar los esquemas y un middleware global que atrape las excepciones.

Con este enfoque conseguimos:

* Asegurar la integridad de los datos antes de que se ejecute la lógica de negocio.

* Estandarizar las respuestas de error en todo el proyecto.

* Sacar de los controladores el `try-catch` repetitivo.

> **Código y recursos:**
>
> * **Punto de partida:** Usa la rama [`feature/initial-project-setup`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/initial-project-setup).
> * **Implementación final:** El código completo de esta parte está en la rama [`feature/validation-error-handling`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/validation-error-handling).

## Instalando Zod

Usamos Zod para declarar y validar esquemas. Su inferencia de tipos en TypeScript es excelente, así que no necesitamos mantener interfaces aparte para los payloads de cada request.

```bash
npm install zod
```

## Definiendo el esquema de la excepción

Empezamos definiendo `ValidationError` y `ValidationException`. Esto nos permite distinguir entre un fallo rutinario en la validación de la entrada y una caída real del sistema.

**`./src/exceptions/validation-error.ts`**

```typescript
export interface ValidationError {
  code: string;
  property: string;
  message: string;
}
```

**`./src/exceptions/validation-exception.ts`**

```typescript
import type { ValidationError } from "./validation-error";

export class ValidationException extends Error {
  public readonly errors: ValidationError[];

  constructor(errors: ValidationError[]) {
    super("Validation failed");
    this.errors = errors;
    Object.setPrototypeOf(this, ValidationException.prototype);
  }
}
```

## Middleware global de excepciones

Este middleware es la última frontera de la aplicación. Atrapa cualquier excepción que se haya lanzado y le da una estructura JSON consistente.

**`./src/middlewares/exception-handler.middleware.ts`**

```typescript
import type { Request, Response, NextFunction } from "express";
import { ValidationException } from "../exceptions/validation-exception";

export class ExceptionHandlerMiddleware {
  public handle = (
    err: Error,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ) => {
    if (err instanceof ValidationException) {
      return res.status(400).json({
        code: "VALIDATION_ERROR",
        message: err.message,
        errors: err.errors,
      });
    }

    // For all other errors, we'll return a generic 500 response.
    return res.status(500).json({
      message: "Internal Server Error",
    });
  };
}
```

## La utilidad de validación

Para no repetir la lógica de validación en cada endpoint, usamos un helper compartido que sirve de puente entre Zod y nuestras excepciones. Si la validación pasa, los datos que devuelve vienen completamente tipados.

**`./src/shared/validations/validate-request-with-schema.ts`**

```typescript
import type { ZodType } from "zod";
import type { Request } from "express";
import { ValidationException } from "../../exceptions/validation-exception";

export const validateRequestWithSchema = <T>(
  schema: ZodType<T>,
  req: Request,
): T => {
  const result = schema.safeParse({
    query: req.query ?? {},
    body: req.body ?? {},
    params: req.params ?? {},
  });

  if (!result.success) {
    const errors = result.error.issues.map((e) => ({
      code: e.code,
      property: e.path.join(".") || "unknown",
      message: e.message,
    }));
    throw new ValidationException(errors);
  }

  return result.data;
};
```

## Refactorizando hacia la validación

Ahora pasamos de los métodos simulados del inicio a una implementación validada. El esquema se define cerca del feature, y el controlador se actualiza para usar nuestra utilidad, que hace de portero.

**`./src/features/products/schemas/create-products.schema.ts`**

```typescript
import z from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(100),
    description: z.string().min(10).max(500),
    price: z.number().min(0),
  }),
});
```

### Actualizando el controlador

Refactorizamos el `addProduct` anterior a `createProduct`. Fíjate en que la lógica se concentra solo en el camino feliz, porque los fallos se manejan de forma global.

**`./src/features/products/products-controller.ts`**

```typescript
import type { Request, Response } from "express";
import { validateRequestWithSchema } from "../../shared/validations/validate-request-with-schema";
import { createProductSchema } from "./schemas/create-products.schema";

type Product = {
  id: number;
  name: string;
  description: string;
  price: number;
};

const products: Product[] = [
  {
    id: 1,
    name: "Laptop",
    description: "A high-performance laptop",
    price: 1200.0,
  },
  {
    id: 2,
    name: "Smartphone",
    description: "A feature-rich smartphone",
    price: 800.0,
  },
];

export class ProductsController {
  public getProducts = async (_: Request, res: Response) => {
    res.status(200).json(products);
  };

  // Refactored from addProduct
  public createProduct = async (req: Request, res: Response) => {
    const validatedData = validateRequestWithSchema(createProductSchema, req);

    const newProduct: Product = {
      id: products.length + 1,
      name: validatedData.body.name,
      description: validatedData.body.description,
      price: validatedData.body.price,
    };

    products.push(newProduct);

    res.status(201).json(newProduct);
  };
}
```

Para cuando el código llega a `newProduct`, los datos ya están garantizados como limpios y con el tipo correcto.

### Cerrando las rutas

Actualizamos `products-routes.ts` cambiando el método `addProduct` por `createProduct`.

**`./src/features/products/products-routes.ts`**

```typescript
import { Router } from "express";
import { ProductsController } from "./products-controller";

export const productsRoutes = (): Router => {
  const router = Router();
  const controller = new ProductsController();

  router.get("/", controller.getProducts);
  router.post("/", controller.createProduct); // Refactored from addProduct

  return router;
};
```

Por último actualizamos las rutas de la aplicación para reflejar el nuevo método del controlador y registramos el `ExceptionHandlerMiddleware`. El manejador de excepciones tiene que ser el último middleware registrado, para que pueda atrapar las excepciones que suben desde las rutas.

**`./src/routes.ts`**

```typescript
import { Router, type Request, type Response } from "express";
import { productsRoutes } from "./features/products/products-routes";
import { ExceptionHandlerMiddleware } from "./middlewares/exception-handler.middleware";

export const appRoutes = (): Router => {
  const router = Router();
  const exceptionHandlerMiddleware = new ExceptionHandlerMiddleware();

  router.use("/api/products", productsRoutes());

  router.get("/health", (_: Request, res: Response) => {
    res.json({
      status: "up",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // The exception handler must be the last middleware to be registered.
  router.use(exceptionHandlerMiddleware.handle);

  return router;
};
```

## Verificando la implementación

Enviando datos mal formados a propósito a `POST /api/products` comprobamos que el portero y el manejador global están sincronizados. En lugar de un proceso caído, la API responde con un `400 Bad Request` que dice exactamente qué está mal.

`POST /api/products`

```json
{
  "name": "A",
  "description": "Short",
  "price": -10
}
```

`Respuesta de la API`

```json
{
  "code": "VALIDATION_ERROR",
  "message": "Validation failed",
  "errors": [
    {
      "code": "too_small",
      "property": "body.name",
      "message": "String must contain at least 3 character(s)"
    },
    {
      "code": "too_small",
      "property": "body.description",
      "message": "String must contain at least 10 character(s)"
    },
    {
      "code": "too_small",
      "property": "body.price",
      "message": "Number must be greater than or equal to 0"
    }
  ]
}
```

## Conclusión

Al delegar la validación en Zod y concentrar el manejo de fallos en un solo lugar, conseguimos tres cosas:

* **Lógica limpia**: los controladores se ocupan únicamente del camino feliz.

* **Predecibilidad**: el cliente recibe siempre errores con la misma estructura.

* **Seguridad de tipos**: los datos en tiempo de ejecución y los tipos de TypeScript no se desincronizan.

La entrada ya está protegida, pero el controlador sigue administrando directamente un arreglo en memoria. Eso acopla la lógica de negocio con el almacenamiento de los datos.

El siguiente paso es reorganizar el proyecto en vertical slices y mover las reglas de negocio a una entidad de dominio, para que cada endpoint sea una unidad autocontenida y la lógica de negocio deje de vivir dentro del controlador.
