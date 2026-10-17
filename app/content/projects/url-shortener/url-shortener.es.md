---
type: 'project'
title: 'URL Shortener'
summary: 'Códigos cortos que no se pueden adivinar, generados sin ir a la base de datos en cada escritura, y una lectura que escala por separado y sigue respondiendo si Redis se cae.'
description: 'Acortador de URLs en Node.js y TypeScript con Fastify, PostgreSQL y Redis: códigos que no se pueden adivinar, lectura y escritura separadas, decisiones en ADRs.'
tier: 'supporting'
status: 'active'
stack: ['TypeScript', 'Node.js', 'Fastify', 'PostgreSQL', 'Redis']
repoUrl: 'https://github.com/poschuler/url-shortener'
sortOrder: 4
updates:
  - date: '2026-10-16'
    note: 'Primera publicación.'
---

Un acortador de URLs en Node.js y TypeScript. Expone dos endpoints: uno de escritura, que recibe una URL de destino y devuelve un código corto, y uno de lectura, que recibe ese código como parámetro de la ruta y redirige a la URL de destino.

Es un monolito modular que corre como dos procesos, uno de lectura y otro de escritura. Se separaron porque las lecturas suelen superar por mucho a las escrituras, y con instancias separadas cada lado escala de forma independiente. La lectura, además, usa Redis como caché para mejorar el tiempo de respuesta.

Hay más detalles sobre las decisiones de diseño en [Diseñando un URL shortener](/es/blog/designing-a-url-shortener).

## Decisiones de diseño

- **Códigos que no se pueden adivinar.** Cada enlace recibe un ID secuencial que pasa por una red de Feistel con clave antes de convertirse en código, así que conocer un código no sirve para llegar a los demás (`short-code-permutation.ts`, ADR-0004).
- **IDs reservados por bloques.** Cada proceso reserva bloques de mil IDs de una secuencia de Postgres y los reparte desde memoria, así que crear un enlace no necesita una consulta para obtener su ID (`ranged-number-sequence.ts`, ADR-0010 y ADR-0011).
- **Una lectura que no depende de Redis.** Si Redis se cae, la lectura sigue respondiendo desde Postgres, más lenta pero sin errores (`redis-link-cache.ts`, ADR-0017).

## Alcance

- **Pensado para producción.** Arquitectura hexagonal con una capa mínima de DDD, límites entre capas verificados con dependency-cruiser, tests de contrato y una prueba de carga con k6 sobre la lectura. Cada pieza tiene un ADR que explica por qué está ahí.
- **Fuera del alcance.** No hay autenticación, los enlaces no se pueden editar ni borrar, y no se registran las visitas.

## Arquitectura

![Diagrama de contenedores del URL shortener](https://raw.githubusercontent.com/poschuler/url-shortener/refs/tags/v1.0.0/architecture/diagrams/dark/containers.svg)

El código, los ADR y los tres niveles del modelo C4 están en el [repositorio](https://github.com/poschuler/url-shortener), junto con los pasos para correrlo en local.
