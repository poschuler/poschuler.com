---
type: 'series'
title: 'Pragmatic Node.js API'
description: 'Construye una API monolítica en Node.js: estructura, validación, persistencia, pruebas, control de acceso y un despliegue.'
status: 'ongoing'
startingPoint: 'Sabes construir un endpoint CRUD con Express y TypeScript, pero no sabes cómo estructurar el proyecto a medida que crece.'
destination: 'Una API monolítica con persistencia real, pruebas, control de acceso y observabilidad básica, desplegada: una que puedas sostener en producción.'
outOfScope:
  - 'Microservices'
  - 'Event sourcing'
  - 'CQRS'
  - 'Modular monolith'
audience: 'Quieres construir una API monolítica en Node.js que puedas desplegar en producción y evolucionar en el tiempo.'
sections:
  - slug: 'fundamentals'
    title: 'Fundamentos'
    summary: 'Cómo se arma el proyecto, validación de los inputs y cómo se manejan los errores de forma centralizada, un feature básico para entender cómo se estructura la solución.'
    parts:
      - 'project-setup'
      - 'schema-validation-and-error-handling'
      - 'vertical-slices-and-domain-logic'
  - slug: 'persistence'
    title: 'Persistencia'
    summary: 'Postgres como motor de base de datos: migraciones, repositorios, transacciones, y listados que se pueden paginar, filtrar y ordenar.'
  - slug: 'correctness'
    title: 'Pruebas'
    summary: 'Pruebas: unitarias contra el dominio, y de integración contra un Postgres real levantado en un test container.'
  - slug: 'access-control'
    title: 'Control de acceso'
    summary: 'Quien puede ingresar y que puede hacer en la API: autenticación y una autorización por roles, sin un sistema de permisos detrás.'
  - slug: 'operations'
    title: 'Operación'
    summary: 'Logs estructurados y observabilidad básica.'
---

Construir una API en Node.js puede parecer sencillo al principio, pero a medida que el proyecto crece, la estructura del código se vuelve difícil de mantener. Esta serie busca servir de guia para poder construir y desplegar un API por ti mismo, con una estructura sencilla y mantenible, que puedas sostener en producción y evolucionar en el tiempo.

Cada sección tiene una rama inicio y una rama final, para poder seguir la serie con facilidad.