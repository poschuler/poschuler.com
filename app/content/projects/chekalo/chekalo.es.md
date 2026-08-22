---
type: 'project'
title: 'Chekalo'
summary: 'Plataforma de inteligencia de precios para el retail peruano: ingesta diaria de nueve retailers, identifica un mismo producto entre todos ellos bajo una identidad canónica y usa OpenSearch como motor de búsqueda y comparación.'
description: 'Chekalo procesa a diario los catálogos de nueve retailers peruanos y los resuelve en un único catálogo canónico — un problema de normalización, no de similitud.'
tier: 'flagship'
status: 'active'
stack: ['TypeScript', 'Node.js', 'PostgreSQL', 'OpenSearch', 'Redis', 'BullMQ', 'React Router']
liveUrl: 'https://chekalo.pe'
sortOrder: 1
updates:
  - date: '2026-08-14'
    note: 'First published.'
---

Cuando buscas un producto entre los diferentes catálogos web de los retailers, te encuentras con que una misma lavadora es `Samsung WA13CG5745BV` en el primero, una *Lavadora Samsung 13kg Carga Superior Negro* en el segundo, y el tercero utiliza un nombre distinto. Los productos rara vez comparten un identificador que permita emparejarlos, y tampoco existe un lugar donde consultarlos de forma consolidada. Si quieres saber que las tres fichas pertenecen al mismo producto, alguien tiene que emparejarlas manualmente.

Una herramienta de comparación de precios depende de un correcto emparejamiento de productos. Si esto falla, el usuario no ve una oferta: ve el precio de dos productos distintos. No es un error de precio, es un error de producto. Este es el problema que Chekalo resuelve. Todos los días recoge los catálogos de los principales retailers del país y consolida sus fichas en una identidad canónica, para que el usuario pueda ver el precio de cada tienda en una misma página.

Los retailers suelen subir el precio de un producto para bajarlo al día siguiente y presentarlo como oferta, pero con el número de un solo día el usuario no tiene cómo identificar una oferta real. Chekalo sabe algo que los retailers no dicen. Conoce el precio a través del tiempo y presenta el historial en cada producto: lo que costó cada día que fue observado, cuánto se movió la última vez y cuándo. Con eso el usuario puede decidir si es o no un buen momento para comprar.

## Chekalo por dentro

Un monolito modular con tres módulos claramente definidos. Cada módulo persiste su información en esquemas de datos propios, manteniendo los límites entre ellos.

**Retail Ingestion** recoge todos los días el catálogo de cada tienda y guarda lo leido, sin interpretarlo. Cada retailer es una integración distinta, con su propio adaptador y su propio rate limit gestionado por BullMQ.

**Catalog** es donde se concentra la parte difícil. Toma las fichas y decide qué significan: qué productos son el mismo, qué ofrece cada tienda por él y cómo se movió el precio.

**Search Projection** lleva el catálogo ya resuelto a un índice de búsqueda, proyectando solo lo que cambió, y lo reconstruye sin que la búsqueda deje de responder.

El sitio lee el índice de OpenSearch directamente: no tiene base de datos propia ni una API detrás.

## La identidad de un producto no es un problema de similitud

Chekalo empareja productos de las categorías tecnología, electro y línea blanca. La primera versión, sin embargo, era más ambiciosa que esta: intentaba emparejar todas las categorías, incluidos los alimentos, donde los mismos cinco kilos de arroz son *Arroz Extra 5Kg* en un catálogo y *Arroz Superior Bolsa 5 Kilos* en el siguiente, y donde medio pasillo es marca propia del retailer, así que las marcas tampoco coinciden. Y más allá de los productos empaquetados están los que se venden a granel. Un kilo de *palta* no tiene marca, no tiene modelo y no tiene código de barras: un retailer lo lista como *Palta Fuerte* y el otro como *Palta*, y nada más. Si esa segunda es, por ejemplo, una palta *Hass*, la diferencia entre esos dos precios no es un ahorro que le estoy mostrando al usuario, es una fruta diferente. Si en electro la identidad de un producto es ambigua, en alimentos muchas veces no hay nada que identificar.

Después de probar distintos enfoques terminé usando una base de datos vectorial. La identidad no era confiable, así que la similitud era lo único que quedaba: las fichas se volvían embeddings, los pares candidatos salían de la distancia coseno y un LLM resolvía los que caían cerca del umbral. No era perfecto, pero funcionaba, y revisando los pares estaba de acuerdo con la mayoría. El problema nunca fue la precisión. Fue todo lo que estaba alrededor de ella: conforme pasaba el tiempo, este enfoque se fue haciendo más difícil de justificar:

**No era reproducible.** El mismo catálogo, procesado dos veces contra los mismos modelos, podía producir emparejamientos distintos: salían otros candidatos, y el juez que decide entre ellos no da siempre el mismo veredicto. Para un sistema cuyo valor entero es la premisa *estos dos precios son del mismo producto*, "casi siempre" no alcanza.

**Y no se podía mejorar.** El incremento diario era manejable. Pero cambiar el modelo de embeddings, o el modelo que toma la decisión, significa que cada emparejamiento que ya está en el catálogo fue decidido por una versión que ya no existe, así que hay que reprocesar el catálogo entero desde cero. Esto no calza en la ventana que tengo para poner un precio delante del usuario mientras la oferta sigue siendo real.

**No se podía auditar.** Cuando emparejaba dos productos que no eran el mismo, la respuesta a *por qué* era un número. No había nada que arreglar, solo un umbral que mover, y moverlo para rescatar un par rompía otro en alguna otra parte del catálogo.

**Costaba dinero cada vez que corría.** Cada producto nuevo, cada cambio en el catálogo y cada cambio de modelo se traducían en nuevos embeddings que generar y nuevos prompts que pagar, de uno en uno o de forma masiva. Un costo recurrente que crecía con el catálogo y que el proyecto no podía sostener.

Todo esto se traducía en un sistema que no era auditable ni sostenible, lo cual le quitaba sentido. Pero el problema de fondo no estaba en el método de emparejamiento, estaba en las categorías donde la identidad era ilegible o inexistente. Un puntaje de similitud empareja *Palta* con *Palta Hass* con alto índice de confianza, porque a efectos de similitud son casi la misma cosa y no existe umbral que resuelva el problema. Así que decidí cambiar el alcance de Chekalo a las categorías donde encontramos una mejor *identidad*.

Lo que reemplazó al emparejamiento probabilístico es una resolución de identidad determinista: marca, modelo y una firma de variante normalizada, sea capacidad, color o dimensiones, lo que distinga a esa línea de producto, corroborada con el código de barras cuando el retailer lo publica. Reglas que escribí yo, que puedo leer, con las que alguien más puede estar en desacuerdo, y que dan la misma respuesta el martes que el lunes. Corre en una fracción del tiempo, ninguna decisión cuesta dinero, y cuando se equivoca se equivoca de una forma que puedo identificar y resolver.

No creo que el primer enfoque haya sido malo, y tampoco fue un fracaso. Respondió bien la pregunta que planteé, que era si dos fichas eran similares. Sin embargo, la pregunta que el producto necesitaba era otra: saber si son realmente el mismo producto. La identidad en retail no es un problema de similitud, es uno de normalización disfrazado de problema de similitud.

## Lo que Chekalo no es

No son microservicios. Los límites están en el código, no en las unidades de despliegue.

No es una tienda. Chekalo no vende nada: cada precio es una referencia tomada del catálogo de los retailers y cada oferta lleva al usuario al retailer que la publica.

No es *real time*. Los precios se refrescan una vez al día, así que siempre existe el riesgo de que uno haya cambiado, de que el producto se haya agotado o de que el retailer haya dejado de ofrecerlo.
