---
type: 'post'
title: 'Diseñando un URL shortener'
description: 'System design de un acortador de URLs: cómo generar códigos únicos que no se puedan adivinar, cuántos caracteres usar y cómo escalar la lectura.'
tags: ['system-design', 'software-architecture', 'backend']
publishedAt: '2026-10-16'
repository: 'https://github.com/poschuler/url-shortener/tree/v1.0.0'
draft: true
---

Diseñamos un URL shortener y revisamos las decisiones relevantes: cómo generar el código, cuántos y qué caracteres usar, y cómo manejar el escalamiento. Obtén el código de una implementación en Node.js y TypeScript, con arquitectura hexagonal, en el [repositorio](https://github.com/poschuler/url-shortener/tree/v1.0.0).

## 1. Requisitos y estimaciones

### Requisitos funcionales

- Un usuario no autenticado puede crear un link corto a partir de una URL destino.
- Un visitante puede usar el link corto y ser redirigido a la URL destino.

### Requisitos no funcionales

- **Ratio lectura:escritura de al menos 100:1.** Por cada link creado se esperan ~100 redirecciones. Por eso el path de lectura es el crítico.
- **Disponibilidad sobre consistencia.** Es aceptable que un link recién creado no esté disponible durante unos segundos, por ejemplo si se lee desde una réplica atrasada. No es aceptable que las redirecciones fallen.
- **Latencia de redirección < 200 ms, medida en el servidor.** La latencia percibida por el visitante depende además de la red.
- **Códigos no predecibles.** Conocer un link no permite deducir otros.
- **Soportar al menos 1.000 millones de URLs.**

### Estimaciones

**Escrituras por segundo.** El requisito pide 1.000 millones de URLs, pero no dice en cuánto tiempo. Suponemos 5 años, que son unos 158 millones de segundos (5 × 365 × 86.400):

```text
1.000 millones de URLs ÷ 158 millones de segundos ≈ 6,3 escrituras/s
```

Eso es el promedio, pero el tráfico no llega parejo durante el día. Suponemos que en el pico llega 10 veces el promedio: ~63 escrituras/s.

**Lecturas por segundo.** Con el ratio 100:1, basta multiplicar por 100: ~630 lecturas/s en promedio y ~6.300/s en pico. Es poco para una base de datos: el promedio lo atiende Postgres solo. Por eso la cache no se justifica por el volumen, sino por la latencia de 200 ms y por el pico.

**Almacenamiento.** Cada registro guarda el código de 7 caracteres, la URL destino y la fecha de creación. La URL puede llegar a 2.048 caracteres, pero la mayoría es mucho más corta. Sumando lo que la base de datos agrega por fila y por índice, redondeamos a ~500 bytes por registro:

```text
1.000 millones × 500 bytes = 500 GB
```

**Cache.** No hace falta tener los 500 GB en memoria. La regla del 80/20 sugiere cachear el 20% de los links, pero eso ya serían 100 GB. Hay una forma mejor de medirlo: cachear solo lo que se visitó en el día, con un TTL de 24 horas. En un día hay ~54 millones de redirecciones (630 × 86.400). En el peor caso, cada una iría a un link distinto:

```text
54 millones × 500 bytes ≈ 27 GB
```

Ese es un techo, no la cifra real. Un link popular se visita miles de veces, pero ocupa un solo lugar en la cache.

### Fuera de alcance

- Autenticación y dueños de links.
- Edición, borrado y expiración de links: un link es permanente.
- Deduplicación: acortar la misma URL dos veces genera dos códigos distintos.
- Validación de la URL destino contra abuso (phishing, malware).
- Analytics de clicks.
- Códigos personalizados.

## 2. Modelo de datos y API

### Entidades

- **Link:** código corto y URL destino.

### Tabla `link`

| Columna      | Tipo      | Notas                             |
| ------------ | --------- | --------------------------------- |
| `short_code` | texto     | PK, 7 caracteres de `[0-9a-zA-Z]` |
| `target_url` | texto     | URL destino                       |
| `created_at` | timestamp |                                   |

### API

**`POST /links` → `201 Created`**

- Request: `{ "targetUrl": string }`
- Response: `{ "shortCode", "shortUrl", "targetUrl", "createdAt" }`
- `400` si la URL no es válida, `429` si se supera el rate limit.

**`GET /{shortCode}` → `302 Found`**, con el header `Location: <targetUrl>`.

- `404` si el código no existe, `400` si no tiene el formato de un código y `429` si se supera el rate limit.

## 3. Deep dives

### 3.1 301 vs 302

- **301 (Moved Permanently):** el navegador cachea la redirección sin expiración y las visitas siguientes ya no llegan al servidor. Hay menos carga, pero se pierde para siempre la posibilidad de deshabilitar un link abusivo (phishing, malware) o de contar clicks.
- **302 (Found):** cada visita pasa por el servidor. Deshabilitar links y contar clicks están fuera de alcance, pero con un 302 se pueden agregar después sin problema.
- **Decisión:** 302, porque es la opción que se puede revertir. Cambiar a 301 más adelante es fácil, pero volver a 302 no sirve para los navegadores que ya guardaron el 301. El costo extra de carga lo absorben la cache y, opcionalmente, una CDN.

### 3.2 Generación de IDs: por qué token range

Alternativas descartadas:

- **Hash de la URL:** truncado a 7 caracteres genera colisiones, adicionalmente le da el mismo código a la misma URL, que es justo la deduplicación que dejamos fuera.
- **UUID o Snowflake:** únicos sin coordinación, pero 128 o 64 bits no caben en 7 caracteres base62 (~41 bits).
- **Códigos aleatorios:** requieren verificar colisiones contra la BD en cada escritura, y la probabilidad de colisión crece con la cantidad de registros.
- **Un ID por escritura desde la BD:** lo más simple, pero agrega un viaje a la base de datos en cada creación de link.

Decisión: **token range**.

- Una secuencia de Postgres entrega bloques de 1.000 IDs: cada `nextval()` reserva un bloque entero, y es atómico entre todas las instancias.
- Cada instancia consume su bloque en memoria. Cuando le queda el 20%, pide el siguiente en background, así que ninguna escritura espera a la base de datos: la secuencia se consulta una vez cada 1.000 links.
- **Por qué no Redis `INCRBY`:** es atómico y rápido, pero en este diseño Redis es solo cache y no persiste nada. Si se reinicia, el contador vuelve a cero y entrega IDs que ya existen. El contador necesita la misma durabilidad que los links, y Postgres ya la tiene.
- **Trade-off:** cuando una instancia se reinicia, se pierden los IDs que quedaban en su bloque. Es aceptable porque nunca se repite un ID y el espacio es enorme.
- El ID numérico nunca se expone tal cual: pasa por una permutación y luego por un encoding.

```text
secuencia (bloques de 1.000) → ID numérico → permutación Feistel → base62 → código de 7 caracteres
```

### 3.3 Alfabeto: por qué base62

- **Base62:** `[0-9a-zA-Z]`, 62 caracteres que se pueden usar en una URL sin encoding. Con los 7 caracteres que justificamos en 3.4, da ~3.500.000 millones de combinaciones: con 1.000 millones de links, 1 de cada 3.500 códigos al azar existe.
- **Base64:** agrega `+` y `/`. La `/` es el separador de la ruta y el `+` en algunos contextos se lee como espacio. La variante URL-safe los cambia por `-` y `_`, que funcionan, pero se leen peor: en un link subrayado, el `_` desaparece.
- **Base58:** elimina los caracteres que se confunden a la vista (`0/O`, `I/l`), útil si el código se transcribe a mano. Con 7 caracteres da ~2.200.000 millones de combinaciones, que también alcanzaría. Se descarta porque los links se copian y pegan, y base62 da más espacio con el mismo largo.
- **Base36:** solo minúsculas y números, así que se puede dictar sin aclarar mayúsculas. Con 7 caracteres da ~78.000 millones de combinaciones: con 1.000 millones de links, 1 de cada 78 códigos al azar existe. Se descarta porque necesitaría 8 caracteres para tener la dispersión de base62.
- **Decisión:** base62, el alfabeto más grande que una URL acepta sin encoding.

### 3.4 Longitud: por qué 7 caracteres

- **6 caracteres:** 62⁶ ≈ 56.800 millones de combinaciones. Alcanza para 1.000 millones de URLs, pero ocuparía el 1,8% del espacio: 1 de cada 57 códigos al azar existe.
- **7 caracteres:** como vimos en 3.3, 1 de cada 3.500.
- **Decisión:** 7 caracteres. El motivo no es la capacidad, sino la **dispersión**: un carácter más hace que adivinar un código sea 60 veces más costoso (ver 3.5).

### 3.5 Predictibilidad: permutación con Feistel

- **Problema:** si los códigos son secuenciales (`0000001`, `0000002`…), cualquiera puede recorrer todos los links existentes, incluidos los que nadie compartió con él, y de paso saber cuántos links tiene el servicio.
- **Primera idea, descartada:** multiplicar el ID por un número grande P, módulo 62⁷. Los códigos parecen aleatorios, pero dos códigos consecutivos difieren exactamente en P. Con acortar dos URLs seguidas, un atacante obtiene P y puede recorrerlo todo.
- **Solución:** antes del encoding, el ID pasa por una red de Feistel con una clave secreta.

**Cómo funciona una red de Feistel.** Es una forma de construir una permutación reversible a partir de una función que no lo es. El ID se parte en dos mitades, izquierda y derecha; en este caso, 42 bits en dos mitades de 21. Después se repite varias veces la misma operación, llamada ronda:

```text
izquierda' = derecha
derecha'   = izquierda XOR f(derecha, clave de la ronda)
```

`f` es una función de mezcla: toma una mitad y la clave de la ronda, y devuelve un valor que parece aleatorio. XOR compara dos números bit a bit: da 1 donde los bits son distintos y 0 donde son iguales. Por ejemplo, 5 XOR 6 es `0101 XOR 0110 = 0011`, es decir, 3. Tiene una propiedad clave: aplicar dos veces el mismo XOR deja todo como estaba.

**Un ejemplo con números chicos.** Supongamos IDs de 8 bits en vez de 42, partidos en dos mitades de 4 bits (de 0 a 15). Usamos dos rondas, con las claves 3 y 6, y una función de mezcla simple:

```text
f(x, k) = (x² + k) mod 16
```

Ciframos el ID **5**. En 8 bits es `0000 0101`, así que izquierda = 0 y derecha = 5:

```text
               izquierda   derecha
inicio             0          5
ronda 1 (k=3)      5          0 XOR f(5, 3)  = 0 XOR 12 = 12
ronda 2 (k=6)     12          5 XOR f(12, 6) = 5 XOR 6  = 3
```

Las dos mitades se vuelven a pegar en un solo número. La izquierda son los 4 bits altos, así que cada unidad vale 16: 12 × 16 + 3 = **195**.

Haciendo lo mismo con los IDs siguientes:

```text
ID 5  →  195
ID 6  →  113
ID 7  →   65
```

Los IDs avanzan de a uno, pero los resultados saltan sin un patrón visible. Con la multiplicación de la primera idea, avanzaban siempre en P.

**Volver atrás.** Partimos de 195 (12, 3) y recorremos las rondas al revés. La izquierda de cada paso es la derecha del anterior, así que sabemos con qué valor se llamó a `f`:

```text
               izquierda                           derecha
fin               12                                  3
ronda 2 (k=6)      3 XOR f(12, 6) = 3 XOR 6   = 5    12
ronda 1 (k=3)     12 XOR f(5, 3)  = 12 XOR 12 = 0     5
```

Volvemos a (0, 5), es decir, al **5**. Esto muestra por qué funciona: `f` no es reversible, porque `f(0, 3)` y `f(4, 3)` dan lo mismo, 3. Aun así, la red sí lo es, porque nunca necesita invertir `f`, solo volver a calcularla. Por eso dos IDs distintos nunca dan el mismo código, y no hace falta consultar la BD para verificar unicidad.

**Dónde entra la clave.** Sin conocer las claves 3 y 6, no se puede calcular `f`, y sin `f` no hay forma de ir de un código a otro. En el diseño real, la clave secreta es de 128 bits y se divide en cuatro claves de ronda, una por vuelta. Se usan cuatro rondas porque es el mínimo habitual para que no queden patrones visibles entre el ID y el código. Con una sola, por ejemplo, la mitad derecha pasaría a la izquierda sin cambios. Ver dos códigos consecutivos no revela nada: a diferencia de la multiplicación, no hay una diferencia fija que descubrir.

- **Permutación más dispersión:** permutar no basta si el espacio está casi lleno. Con la ocupación de 3.4, un atacante necesita ~3.500 intentos por acierto, y el rate limit de lectura (300 por minuto por IP) lo deja en un link cada ~12 minutos por IP. Es ofuscación, no control de acceso: quien tiene un link, lo puede abrir.
- **Detalle de implementación:** 62⁷ no es potencia de 2 (≈ 2^41,7). Feistel opera sobre 42 bits, así que un resultado puede caer fuera del rango. Se usa *cycle walking*: se vuelve a aplicar la permutación hasta que el resultado sea menor que 62⁷, en promedio ~1,25 veces.
- **Trade-off:** la clave, la función de mezcla, el número de rondas y el orden del alfabeto no pueden cambiar una vez que existen links. Cambiar cualquiera reasigna todos los IDs y puede producir códigos que choquen con los ya guardados. Además, `f` no es criptográfica: se descartó HMAC-SHA256 porque protege contra un atacante que este proyecto no espera.

## 4. Escalabilidad

- **Cache (Redis)** [en el repo]: cache-aside en el path de lectura. Como los links no cambian, no hace falta invalidar. Si Redis se cae, la lectura va a Postgres: más lenta, pero no falla.
- **Lectura y escritura separadas** [en el repo]: dos procesos del mismo código que escalan por separado.
- **Réplicas de lectura** [evolución]: los misses de cache van a réplicas, coherente con disponibilidad sobre consistencia.
- **Autoescalado** [evolución]: los procesos no guardan estado, así que se multiplican por reglas de carga. Escala los procesos, no la base de datos.
- **CDN** [evolución]: cachear los 302 en el edge baja la latencia percibida, a cambio de que esas visitas ya no pasen por el servidor.
- **Sharding** [evolución]: con ~500 GB no hace falta. Si llegara, la clave de partición sería `short_code`, que gracias a la permutación se reparte de forma uniforme.

## 5. Diseño final

![Diagrama de contenedores del URL shortener](https://raw.githubusercontent.com/poschuler/url-shortener/refs/tags/v1.0.0/architecture/diagrams/dark/containers.svg)

El diagrama muestra lo que está implementado en el repositorio. La CDN, las réplicas y el sharding de la sección 4 no aparecen porque son evolución. Los [tres niveles del modelo C4](https://github.com/poschuler/url-shortener/blob/v1.0.0/docs/architecture.md) están en el repositorio.
