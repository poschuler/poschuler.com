---
type: 'post'
title: 'Pragmatic Node.js API #2: Schema Validation and Global Error Handling'
description: 'Standardize your API integrity by implementing Zod for type-safe validation and a centralized error-handling middleware.'
tags: ['Nodejs', 'TypeScript', 'Express', 'Backend', 'Zod', 'Error Handling']
publishedAt: '2025-12-27'
repository: 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/validation-error-handling'
---

When building an API, manual input validation often results in a mess of `if` statements and inconsistent error responses. A cleaner approach is to use Zod for schema enforcement and a Global Middleware to catch exceptions.

This approach allows us to:

* Ensure data integrity before business logic executes.

* Standardize API error responses across the entire project.

* Remove repetitive `try-catch` boilerplate from controllers.

> **Code & Resources:**
>
> * **Starting Point:** Use the [`feature/initial-project-setup`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/initial-project-setup) branch.
> * **Final Implementation:** Find the complete code for this part in the [`feature/validation-error-handling`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/validation-error-handling) branch.

## Installing Zod

We use Zod for schema declaration and validation. It provides excellent TypeScript inference, removing the need to maintain separate interfaces for our request payloads.

```bash
npm install zod
```

## Defining the Exception Schema

We start by defining the `ValidationError` and `ValidationException`. This allows us to distinguish between routine validation input failure and critical system crash.

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

## Global Exception Middleware

This middleware acts as the final boundary of the application. It catches any thrown exceptions and formats them into a consistent JSON structure.

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

## The Validation Utility

To avoid repeating validation logic, we use a shared helper that acts as a bridge between Zod and our custom exceptions. This ensures that if validation passes, the returned data is fully typed.

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

## Refactoring for Validation

We now move from our initial mock methods to a validated implementation. The schema is defined close to the feature, and the controller is updated to use our "gatekeeper" utility.

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

### Updating the Controller

We refactor the previous `addProduct` into `createProduct`. Notice how the logic focuses purely on the "happy path" because failures are handled globally.

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

By the time the code reaches newProduct, the data is guaranteed to be clean and correctly typed.

### Finalizing the Routes

We update the `products-routes.ts` changing the `addProduct` method to `createProduct`.

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

Finally, we update our routes to reflect the new controller method and register the `ExceptionHandlerMiddleware`. The exception handler must be the last middleware registered to ensure it catches exceptions bubbling up from the routes.

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

## Verifying the Implementation

By intentionally sending malformed data to `POST /api/products`, we verify that the gatekeeper and global handler are in sync. Instead of a crashed process, the API responds with an actionable `400 Bad Request`.

`POST /api/products`

```json
{
  "name": "A",
  "description": "Short",
  "price": -10
}
```

`API Response`

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

## Conclusion

By offloading validation to Zod and centralizing failure management, we've achieved three architectural goals:

* **Clean Logic**: Controllers focus on the "happy path."

* **Predictability**: The client receives consistent, structured errors.

* **Type Safety**: Runtime data and TypeScript types stay in sync.

While the input is now secure, our controller is still directly managing an in-memory array. This creates a tight coupling between our business logic and our data storage.

The next step is implement the Repository Pattern. We'll move our data management logic behind a clean interface, allowing us to swap our in-memory storage for a persistent database without modifying the controller.
