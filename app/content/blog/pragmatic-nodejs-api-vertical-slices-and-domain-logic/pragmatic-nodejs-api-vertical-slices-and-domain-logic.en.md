---
type: 'post'
title: 'Pragmatic Node.js API #3: Vertical Slices Architecture and Domain Logic'
description: 'Organize your Node.js API using Vertical Slices to encapsulate features and maintain a clear separation of concerns, enhancing maintainability and scalability.'
tags: ['Nodejs', 'TypeScript', 'Express', 'Backend', 'Vertical Slices', 'Software Architecture']
publishedAt: '2026-02-20'
repository: 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/vertical-slices-and-domain-logic'
---

This post introduces Vertical Slices Architecture and a proper Domain Layer. Instead of grouping code by technical role, we organize by feature. Each endpoint becomes a self-contained slice with its own handler, DTOs, mapper, and schema. Business rules move into a Domain Entity, and a Service layer manages the data.

This approach allows us to:

* Encapsulate each endpoint as a self-contained, navigable unit.

* Separate domain logic from HTTP and infrastructure concerns.

* Control the shape of API input and output through explicit DTOs and Mappers.

* Scale the codebase horizontally by adding new slices without modifying existing ones.

> **Code & Resources:**
>
> * **Starting Point:** Use the [`feature/validation-error-handling`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/validation-error-handling) branch.
> * **Final Implementation:** Find the complete code for this part in the [`feature/vertical-slices-and-domain-logic`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/vertical-slices-and-domain-logic) branch.

## Understanding Vertical Slices

In a traditional Layered Architecture, code is grouped by technical role: controllers in one folder, services in another, schemas in a third. This creates an implicit coupling — a single feature change often requires touching files scattered across the entire project tree.

Vertical Slices take the opposite approach. Each endpoint is a self-contained folder that owns its handler, DTOs (Request/Response), mapper, and validation schema. The boundaries are drawn around **what the application does**, not around the technical role of the code.

Here's our evolved project structure:

```
src/
├── app.ts
├── server.ts
├── routes.ts
│
├── config/
│   └── config.ts
│
├── domain/
│   └── product.entity.ts
│
├── exceptions/
│   ├── validation-error.ts
│   └── validation-exception.ts
│
├── middlewares/
│   └── exception-handler.middleware.ts
│
├── shared/
│   └── validations/
│       └── validate-request-with-schema.ts
│
└── features/
    └── products/
        ├── products.routes.ts
        ├── products.service.ts
        │
        ├── create-product/
        │   ├── create-product.endpoint.ts
        │   ├── create-product.mapper.ts
        │   ├── create-product.request.ts
        │   ├── create-product.response.ts
        │   └── create-products.schema.ts
        │
        └── get-products/
            ├── get-products.endpoint.ts
            ├── get-products.mapper.ts
            └── get-products.response.ts
```

Each endpoint under `features/products/` is its own vertical slice. The `create-product/` folder contains everything needed to handle a POST request: the endpoint handler, the input DTO, the output DTO, the mapper, and the validation schema. The `get-products/` folder does the same for GET. Nothing leaks between slices.

## The Domain Entity

The Domain Entity is the core of the architecture. It represents the business concept with its rules and invariants, independent of any framework or HTTP concern.

We create a `Product` class with a private constructor and a static `create()` factory. This pattern ensures that every `Product` instance is valid by construction — the factory enforces business rules before the object exists. The ID is generated internally, keeping identity management within the domain boundary.

**`./src/domain/product.entity.ts`**

```typescript
type CreateProductProps = {
  name: string;
  description: string;
  price: number;
};

export class Product {
  private constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
  ) {}

  public static create(props: CreateProductProps): Product {
    if (!props.name) {
      throw new Error("Product name is required");
    }

    if (!props.description) {
      throw new Error("Product description is required");
    }

    if (props.price <= 0) {
      throw new Error("Product price must be greater than zero");
    }

    // ID generation simulation
    const id = Math.floor(Math.random() * 1000);

    return new Product(id, props.name, props.description, props.price);
  }
}
```

Two things to note:

* **Domain Validation**: The `create()` method enforces invariants like "price must be greater than zero". These are business rules, distinct from the Zod schema validation that guards the HTTP boundary.

* **ID Generation**: The factory generates the ID internally. The caller provides only the business properties; identity is the domain's responsibility.

## The Service Layer

The service manages the collection of products and coordinates between the endpoint handlers and the domain. It holds the in-memory data and exposes the use cases of the feature.

**`./src/features/products/products.service.ts`**

```typescript
import { Product } from "../../domain/product.entity";
import type { CreateProductRequest } from "./create-product/create-product.request";

export class ProductsService {
  private products: Product[] = [
    Product.create({
      name: "Laptop",
      description: "A high-performance laptop",
      price: 1200.0,
    }),
    Product.create({
      name: "Smartphone",
      description: "A feature-rich smartphone",
      price: 800.0,
    }),
  ];

  public getAllProducts(): Product[] {
    return this.products;
  }

  public createProduct(product: CreateProductRequest): Product {
    const newProduct = Product.create({
      name: product.name,
      description: product.description,
      price: product.price,
    });

    this.products.push(newProduct);
    return newProduct;
  }
}
```

The seed data flows through `Product.create()`, meaning even our initial data respects the domain's validation rules. The `createProduct` method receives a typed `CreateProductRequest` DTO and delegates construction to the domain factory. If `Product.create()` throws due to an invalid business rule, the product is never stored.

## The DTO and Mapper Pattern

A key part of the Vertical Slices approach is controlling the shape of data at each boundary. Instead of directly exposing the domain entity in API responses, we use **DTOs** (Data Transfer Objects) to define exactly what the client sees, and **Mappers** to handle the conversion.

### Get Products Slice

The `get-products/` slice defines a Response DTO and a Mapper that converts a domain `Product` into the response shape.

**`./src/features/products/get-products/get-products.response.ts`**

```typescript
export class GetProductsResponse {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
  ) {}
}
```

**`./src/features/products/get-products/get-products.mapper.ts`**

```typescript
import type { Product } from "../../../domain/product.entity";
import { GetProductsResponse } from "./get-products.response";

export class GetProductsMapper {
  public static toResponse(product: Product): GetProductsResponse {
    const { id, name, description, price } = product;
    return new GetProductsResponse(id, name, description, price);
  }
}
```

**`./src/features/products/get-products/get-products.endpoint.ts`**

```typescript
import type { Request, Response } from "express";
import type { ProductsService } from "../products.service";
import { GetProductsMapper } from "./get-products.mapper";

export const getProducts =
  (service: ProductsService) => (_: Request, res: Response) => {
    const products = service.getAllProducts();

    const response = products.map((p) => GetProductsMapper.toResponse(p));

    res.status(200).json(response);
  };
```

The endpoint is a higher-order function — it receives the service and returns the actual request handler. This pattern eliminates the need for a controller class while keeping the service injectable. The mapper converts each domain `Product` into a `GetProductsResponse`, ensuring the API response shape is explicitly controlled.

### Create Product Slice

The `create-product/` slice is richer — it includes a Request DTO, a Response DTO, a Mapper, the Zod schema, and the endpoint handler.

**`./src/features/products/create-product/create-product.request.ts`**

```typescript
export class CreateProductRequest {
  constructor(
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
  ) {}
}
```

**`./src/features/products/create-product/create-product.response.ts`**

```typescript
export class CreateProductResponse {
  constructor(
    public readonly id: number,
    public readonly name: string,
    public readonly description: string,
    public readonly price: number,
  ) {}
}
```

**`./src/features/products/create-product/create-products.schema.ts`**

```typescript
import z from "zod";

export const createProductSchema = z.object({
  body: z.object({
    name: z.string().min(3).max(100),
    description: z.string().min(10).max(500),
    price: z.number().gt(0),
  }),
});
```

**`./src/features/products/create-product/create-product.mapper.ts`**

```typescript
import type { Product } from "../../../domain/product.entity";
import { CreateProductResponse } from "./create-product.response";

export class CreateProductMapper {
  public static toResponse(product: Product): CreateProductResponse {
    const { id, name, description, price } = product;
    return new CreateProductResponse(id, name, description, price);
  }
}
```

**`./src/features/products/create-product/create-product.endpoint.ts`**

```typescript
import type { Request, Response } from "express";
import { validateRequestWithSchema } from "../../../shared/validations/validate-request-with-schema";
import { createProductSchema } from "./create-products.schema";
import { CreateProductRequest } from "./create-product.request";
import type { ProductsService } from "../products.service";
import { CreateProductMapper } from "./create-product.mapper";

export const createProduct =
  (service: ProductsService) => (req: Request, res: Response) => {
    const validateResult = validateRequestWithSchema(
      createProductSchema,
      req,
    );

    const createProductRequest = new CreateProductRequest(
      validateResult.body.name,
      validateResult.body.description,
      validateResult.body.price,
    );

    const newProduct = service.createProduct(createProductRequest);

    const response = CreateProductMapper.toResponse(newProduct);

    res.status(201).json(response);
  };
```

Notice the flow: the endpoint first validates the raw request using Zod (from the previous part), then maps the validated data into a typed `CreateProductRequest` DTO, passes it to the service, and finally maps the returned domain entity into a `CreateProductResponse`. Each step has a clear responsibility.

## Wiring the Vertical Slice

The routes file becomes the composition root of the feature. It instantiates the service and wires each endpoint handler.

**`./src/features/products/products.routes.ts`**

```typescript
import { Router } from "express";
import { ProductsService } from "./products.service";
import { getProducts } from "./get-products/get-products.endpoint";
import { createProduct } from "./create-product/create-product.endpoint";

export const productsRoutes = (): Router => {
  const router = Router();

  const productService = new ProductsService();

  router.get("/", getProducts(productService));
  router.post("/", createProduct(productService));

  return router;
};
```

The service is created once and injected into each endpoint handler. Adding a new endpoint means creating a new slice folder and adding one line to this file.

The main application routes file registers the feature routes and the global exception handler:

**`./src/routes.ts`**

```typescript
import { Router, type Request, type Response } from "express";
import { productsRoutes } from "./features/products/products.routes";
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

Start the development server:

```bash
npm run dev
```

Test the two endpoints to verify the full slices are working:

**GET all products** — `GET http://localhost:3000/api/products`

```json
[
  {
    "id": 198,
    "name": "Laptop",
    "description": "A high-performance laptop",
    "price": 1200
  },
  {
    "id": 472,
    "name": "Smartphone",
    "description": "A feature-rich smartphone",
    "price": 800
  }
]
```

**Create a product** — `POST http://localhost:3000/api/products`

```json
{
  "name": "Product 1",
  "description": "Description of Product 1",
  "price": 9.99
}
```

`API Response`

```json
{
  "id": 731,
  "name": "Product 1",
  "description": "Description of Product 1",
  "price": 9.99
}
```

The IDs are randomly generated by the domain entity, so they will differ on each run.

Sending malformed data still returns a structured `400 Bad Request` thanks to the Zod validation and global exception handler from the previous part:

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
      "message": "Number must be greater than 0"
    }
  ]
}
```

## Conclusion

By introducing Vertical Slices and a proper Domain Entity, we've achieved three key architectural improvements:

* **Endpoint Encapsulation**: Each endpoint is a self-contained slice with its own handler, DTOs, mapper, and schema. Adding a new endpoint means adding a new folder, not scattering files across the project.

* **Explicit API Boundaries**: Request and Response DTOs give us full control over the shape of data entering and leaving the API, decoupled from the domain model.

* **Domain Integrity**: The `Product` entity enforces business invariants through its factory method. No invalid product can exist in the system, regardless of how it's created.
