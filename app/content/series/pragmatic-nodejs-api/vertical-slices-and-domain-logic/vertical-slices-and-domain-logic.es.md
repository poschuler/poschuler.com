---
type: 'post'
title: 'Arquitectura de vertical slices y lógica de dominio'
description: 'Organiza tu API en Node.js con vertical slices: cada endpoint como una unidad autocontenida, y las reglas de negocio en una entidad de dominio.'
tags: ['nodejs', 'typescript', 'express', 'backend', 'vertical-slices', 'software-architecture']
publishedAt: '2026-02-20'
repository: 'https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/vertical-slices-and-domain-logic'
---

En este post introducimos la arquitectura de vertical slices y una capa de dominio propiamente dicha. En lugar de agrupar el código por su rol técnico, lo organizamos por feature. Cada endpoint pasa a ser un slice autocontenido, con su propio handler, sus DTOs, su mapper y su esquema. Las reglas de negocio se mueven a una entidad de dominio, y una capa de servicio administra los datos.

Con este enfoque conseguimos:

* Encapsular cada endpoint como una unidad autocontenida y fácil de navegar.

* Separar la lógica de dominio de lo que es HTTP y de la infraestructura.

* Controlar la forma de lo que entra y sale de la API mediante DTOs y mappers explícitos.

* Hacer crecer el proyecto en horizontal, agregando slices nuevos sin tocar los que ya existen.

> **Código y recursos:**
>
> * **Punto de partida:** Usa la rama [`feature/validation-error-handling`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/validation-error-handling).
> * **Implementación final:** El código completo de esta parte está en la rama [`feature/vertical-slices-and-domain-logic`](https://github.com/poschuler/pragmatic-nodejs-api/tree/feature/vertical-slices-and-domain-logic).

## Entendiendo los vertical slices

En una arquitectura por capas tradicional, el código se agrupa por su rol técnico: los controladores en una carpeta, los servicios en otra, los esquemas en una tercera. Eso crea un acoplamiento implícito, porque cambiar un solo feature suele obligar a tocar archivos repartidos por todo el árbol del proyecto.

Los vertical slices hacen lo contrario. Cada endpoint es una carpeta autocontenida que es dueña de su handler, sus DTOs de request y response, su mapper y su esquema de validación. Los límites se trazan alrededor de **lo que la aplicación hace**, no alrededor del rol técnico del código.

Así queda la estructura del proyecto:

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

Cada endpoint dentro de `features/products/` es su propio vertical slice. La carpeta `create-product/` tiene todo lo necesario para atender un POST: el handler, el DTO de entrada, el DTO de salida, el mapper y el esquema de validación. La carpeta `get-products/` hace lo mismo para el GET. Nada se filtra de un slice a otro.

## La entidad de dominio

La entidad de dominio es el núcleo de la arquitectura. Representa el concepto de negocio con sus reglas e invariantes, independiente de cualquier framework y de cualquier detalle de HTTP.

Creamos una clase `Product` con el constructor privado y un método de fábrica estático `create()`. Este patrón asegura que toda instancia de `Product` sea válida por construcción: la fábrica hace cumplir las reglas de negocio antes de que el objeto exista. El ID se genera internamente, así que la identidad se administra dentro del límite del dominio.

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

Dos cosas que vale la pena notar:

* **Validación de dominio**: el método `create()` hace cumplir invariantes como "el precio debe ser mayor que cero". Son reglas de negocio, distintas de la validación del esquema de Zod, que custodia el límite HTTP.

* **Generación del ID**: la fábrica genera el ID internamente. Quien llama entrega solo las propiedades de negocio; la identidad es responsabilidad del dominio.

## La capa de servicio

El servicio administra la colección de productos y coordina entre los handlers de los endpoints y el dominio. Guarda los datos en memoria y expone los casos de uso del feature.

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

Los datos iniciales también pasan por `Product.create()`, lo que significa que hasta la semilla respeta las reglas de validación del dominio. El método `createProduct` recibe un DTO `CreateProductRequest` tipado y delega la construcción a la fábrica del dominio. Si `Product.create()` lanza por una regla de negocio incumplida, el producto nunca llega a guardarse.

## El patrón DTO y mapper

Una parte clave del enfoque de vertical slices es controlar la forma de los datos en cada límite. En lugar de exponer directamente la entidad de dominio en las respuestas de la API, usamos **DTOs** para definir exactamente lo que el cliente ve, y **mappers** para hacer la conversión.

### El slice de get products

El slice `get-products/` define un DTO de respuesta y un mapper que convierte un `Product` del dominio en la forma de la respuesta.

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

El endpoint es una función de orden superior: recibe el servicio y devuelve el handler real de la petición. Este patrón nos ahorra la clase controlador y mantiene el servicio inyectable. El mapper convierte cada `Product` del dominio en un `GetProductsResponse`, con lo que la forma de la respuesta queda controlada de forma explícita.

### El slice de create product

El slice `create-product/` es más completo: incluye un DTO de request, un DTO de response, un mapper, el esquema de Zod y el handler del endpoint.

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

Fíjate en el recorrido: el endpoint primero valida la petición cruda con Zod, como vimos en la parte anterior, después convierte los datos validados en un DTO `CreateProductRequest` tipado, se lo pasa al servicio, y finalmente convierte la entidad de dominio devuelta en un `CreateProductResponse`. Cada paso tiene una responsabilidad clara.

## Conectando el vertical slice

El archivo de rutas se convierte en la raíz de composición del feature. Instancia el servicio y conecta cada handler.

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

El servicio se crea una sola vez y se inyecta en cada handler. Agregar un endpoint nuevo significa crear una carpeta de slice y añadir una línea a este archivo.

El archivo principal de rutas registra las rutas del feature y el manejador global de excepciones:

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

## Verificando la implementación

Levanta el servidor de desarrollo:

```bash
npm run dev
```

Prueba los dos endpoints para verificar que los slices completos funcionan:

**Listar los productos** — `GET http://localhost:3000/api/products`

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

**Crear un producto** — `POST http://localhost:3000/api/products`

```json
{
  "name": "Product 1",
  "description": "Description of Product 1",
  "price": 9.99
}
```

`Respuesta de la API`

```json
{
  "id": 731,
  "name": "Product 1",
  "description": "Description of Product 1",
  "price": 9.99
}
```

Los IDs los genera al azar la entidad de dominio, así que van a ser distintos en cada ejecución.

Enviar datos mal formados sigue devolviendo un `400 Bad Request` estructurado, gracias a la validación de Zod y al manejador global de excepciones de la parte anterior:

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
      "message": "Number must be greater than 0"
    }
  ]
}
```

## Conclusión

Al introducir los vertical slices y una entidad de dominio propiamente dicha, conseguimos tres mejoras:

* **Encapsulamiento del endpoint**: cada endpoint es un slice autocontenido con su handler, sus DTOs, su mapper y su esquema. Agregar un endpoint significa agregar una carpeta, no repartir archivos por todo el proyecto.

* **Límites explícitos de la API**: los DTOs de request y response nos dan control total sobre la forma de los datos que entran y salen, desacoplada del modelo de dominio.

* **Integridad del dominio**: la entidad `Product` hace cumplir sus invariantes de negocio a través del método de fábrica. Ningún producto inválido puede existir en el sistema, sin importar desde dónde se cree.
