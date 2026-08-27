---
type: 'post'
title: 'Implementación de Value Objects en Node.js'
description: ''
tags: ['nodejs', 'typescript', 'domain-driven-design', 'software-architecture', 'value-object']
publishedAt: '2025-11-02'
repository: 'https://github.com/poschuler/nodejs-ddd-value-objects'
draft: true
---

## Obsesión por los tipos primitivos

Cuando comencé a explorar Domain-Driven Design en TypeScript, las entidades que construía tenían todas sus propiedades en tipos primitivos: `string`, `number`, `Date`. Una entidad usuario tenía un `email: string` y por mucho tiempo esto no parecía un problema.

El código se veía algo así:

```typescript
// controlador
await createUser(body.email);

// aplicación
async function createUser(email: string) {
  return userRepository.save(new User(email));
}

// dominio
class User {
  constructor(readonly email: string) {}
}
```

El mismo valor de email como `string` sale del controlador y cruza todas las capas hasta llegar al dominio, y en ninguna de ellas el tipo dice nada sobre él: no dice si ya fue validado, si se le hizo trim, o si se pasó a mayúsculas o minúsculas. Es un simple `string`, el mismo que puede llevar el nombre o incluso la contraseña, cuando las tres técnicamente no son lo mismo.

A esto se le llama "Primitive Obsession", obsesión por los tipos primitivos. El problema no es usar un `string` como tal, sino que el `string` es lo único que hay para representar un concepto que tiene reglas.

Otro problema, que con el tiempo puede resultar aún más caro, es que el tipo no garantiza nada: cada capa que toca el email debe asegurarse por cuenta propia de lo que este realmente es. El controlador valida el formato antes de aceptar el request. La aplicación lo vuelve a validar con una función suya, porque no puede dar por hecho de dónde vino la llamada. Y el dominio lo valida una tercera vez, porque no puede aceptar sin más un valor que vino del exterior.

Esto termina en tres validaciones independientes, tres implementaciones distintas que incluso pueden haber escrito desarrolladores diferentes, y nada obliga a que digan lo mismo. El desarrollador puede estar aplicando validaciones diferentes en cada capa, y no hay forma simple de detectarlo.

Un Value Object (VO) es una clase que representa un concepto del dominio: un email, un importe, un precio, y que por sí misma se hace cargo de su creación, su validación y las operaciones que tengan sentido sobre él. Con esto la validación pasa a ser centralizada y ocurre en un solo momento: cuando el VO se construye. Si se construyó, es válido. Y si no puede serlo, la creación falla ahí mismo, de modo que el sistema nunca llega a cargar un email inválido.

## Tres pilares de un Value Object

Un Value Object (VO) solo es un VO si cumple con tres reglas fundamentales. Estas reglas son un contrato que garantiza la integridad de la data dentro del dominio. Si un objeto no cumple con alguna de estas reglas, probablemente sea una entidad no un VO.

### 1. Inmutabilidad

Cuando un VO es creado **su valor no puede cambiar**. Para cambiar un VO necesitas destruir el anterior y crear una instancia nueva.

Por ejemplo:

- Un `EmailAddress` con el valor "user@domain.com", no debe haber forma de cambiar su valor a "new@domain.com" o cualquier otro valor.
- Si consideramos un VO like **Money** que tiene un valor de $10 y queremos agregarle $5, el método add(5) no modifica la instancia existente; en cambio retorna una nueva instancia de **Money** con el monto actualizado.

La inmutabilidad es importante ya que elimina los efectos secundarios. Por ejemplo, si pasas un VO a un servicio tienes la certeza de que el servicio no puede modificarlo y esto garantiza la consistencia.


### Igualdad por valor

A diferencia de las entidades (las cuales son definidas con un identificador único) un VO es definido por el valor de sus componentes; un VO no tiene un identificador único.

Dos VOs son iguales si todas sus propiedades so iguales.

- Un objeto Money A con {amount:10, currency: USD} y un objeto B con {amount:10, currency: USD}, son exactamente el mismo VO, incluso si si son dos instancias diferentes en memoria.
- Si pensamos en un ejemplo real: Un billete de $20 es igual a cualquier otro billete de $20. El valor de ambos es el mismo, el número de serie es irrelevante para su función.


### Siempre válido

Un VO tiene la responsabilidad de validar sus propias reglas de negocio y normalizacion de su data durante la creación del objeto.

- Validación: El `EmailAddress` cumple con el formato requerido? El DateRange tiene una fecha de inicio que precede a la fecha fin?

- Normalización: Si el input es "USER@DOMAIN.COM", el VO internamente convierte esto a su forma canónica: "user@domain.com".

Si la validación falla o la normalización no es posible, el VO no puede ser creado, o arroja una excepción o returna un objeto Result que contiene el error. Estp asegura que solo objetos válidos ingresen al dominio.

## La clase base `ValueObject`

El objetivo es crear una clase abstracta `ValueObject` que soporte la **igualdad por valor** y defina el contrato de inmutabilidad para todas las clases que la hereden.

```typescript
export type EqualityComponent =
  | string
  | number
  | boolean
  | Date
  | ValueObject
  | null
  | undefined;

export abstract class ValueObject {
  protected abstract equalityComponents(): readonly EqualityComponent[];

  public equals(other: unknown): boolean {
    if (!(other instanceof ValueObject)) {
      return false;
    }

    if (other.constructor !== this.constructor) {
      return false;
    }

    const left = this.equalityComponents();
    const right = other.equalityComponents();

    if (left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => equalsComponent(value, right[index]));
  }
}

function equalsComponent(
  left: EqualityComponent,
  right: EqualityComponent,
): boolean {
  if (left instanceof ValueObject && right instanceof ValueObject) {
    return left.equals(right);
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() === right.getTime();
  }

  return left === right;
}
```

```
emailA.equals(null): false
emailA.equals(a string): false
salary.equals(lookAlike): false
unitPrice.equals(listed): false
```

## Email: normalizar antes de validar

```typescript
export class Email extends ValueObject {
  public readonly value: string;

  private constructor(value: string) {
    super();
    this.value = value;
    Object.freeze(this);
  }

  public static create(input: string): Email {
    const normalizedEmail = input.trim().toLowerCase();

    if (!normalizedEmail) throw new Error("Email requires a value");

    if (!Email.isValid(normalizedEmail)) {
      throw new Error("Invalid email address");
    }

    return new Email(normalizedEmail);
  }

  protected equalityComponents(): readonly EqualityComponent[] {
    return [this.value];
  }

  private static isValid(email: string): boolean {
    const emailRegex = /^[^\s@.]+(?:\.[^\s@.]+)*@[^\s@.]+(?:\.[^\s@.]+)+$/;
    return emailRegex.test(email);
  }
}
```

```
emailA === emailB: false
emailA.equals(emailB): true
emailA.value: admin@company.com
emailB.value: admin@company.com
Blank email: Email requires a value
Missing TLD: Invalid email address
Double dot: Invalid email address
```

![Email Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/Email-Value-Object.svg)

## Amount: el decimal exacto, y una dependencia escondida

```
0.1 + 0.2 as numbers: 0.30000000000000004
0.1 + 0.2 as Amount: 0.3
```

```typescript
private constructor(props: AmountProps) {
  super();

  // Both guards live in the one gate every Amount passes through. The
  // finiteness one is reachable: times() can overflow two finite operands
  // into Infinity. The NaN one is not, today — create() rejects NaN before
  // this point, and plus, minus, times and dp never produce one from finite
  // operands. It stays because the first operator that can — a divide(),
  // where 0/0 is NaN — would otherwise mint an Amount whose value is NaN:
  // it prints as "NaN", serialises as "NaN", and compares equal to itself.
  if (props.value.isNaN()) {
    throw new Error(`Invalid amount: "${props.value}" is not a number`);
  }

  if (!props.value.isFinite()) {
    throw new Error(
      `Invalid amount: "${props.value}" is not a finite number`,
    );
  }

  this.#value = props.value;
  Object.freeze(this);
}

public static create(input: number | string): Amount {
  const bigValue = new BigNumber(input);

  if (bigValue.isNaN()) {
    throw new Error(`Invalid amount: "${input}" is not a number`);
  }

  return new Amount({ value: bigValue });
}
```

```
From number literal: 9007199254740992
From string literal: 9007199254740993
times(0.1 + 0.2): 0.30000000000000004
times("0.3"): 0.3
```

```typescript
public times(multiplier: number | string): Amount {
  // Routed through create() so a malformed factor is reported by its own
  // literal: BigNumber.times() would quietly turn it into NaN, and the
  // message would name "NaN" instead of what the caller actually wrote.
  const factor = Amount.create(multiplier);
  const newValue = this.#value.times(factor.#value);
  return new Amount({ value: newValue });
}
```

```
Not a number: Invalid amount: "abc" is not a number
Not finite: Invalid amount: "Infinity" is not a finite number
Bad factor: Invalid amount: "abc" is not a number
```

```typescript
public round(decimals: number): Amount {
  assertDecimals(decimals);
  const newValue = this.#value.dp(decimals, BigNumber.ROUND_HALF_UP);
  return new Amount({ value: newValue });
}
```

```
raw.round(2): 2.35
raw is unchanged: 2.345
(-5).isNegative(): true
```

```typescript
// BigNumber takes a scale of up to 1e9 decimal places, far enough to exhaust the
// heap while formatting before it reports anything. Capping it at 20 keeps every
// monetary scale reachable and that failure mode out — out of the scale, at least.
// Nothing here bounds the magnitude: "1e10000000" is still a finite BigNumber, and
// every toString() has to materialise all ten million digits.
const MAX_DECIMALS = 20;

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new Error(
      `Invalid decimals: "${decimals}" must be an integer between 0 and ${MAX_DECIMALS}`,
    );
  }
}
```

```
Bad decimals: Invalid decimals: "1000000000" must be an integer between 0 and 20
```

## Currency: un conjunto cerrado

```typescript
export const currencyDecimals = {
  PEN: 2,
  USD: 2,
  EUR: 2,
  JPY: 0,
} as const;

export type CurrencyCode = keyof typeof currencyDecimals;
```

```typescript
public static readonly All: readonly Currency[] = Object.freeze(
  (Object.keys(currencyDecimals) as CurrencyCode[]).map(
    (c) => new Currency(c),
  ),
);

public static fromCode(code: string): Currency {
  const currency = Currency.All.find((c) => c.code === code);

  if (!currency) throw new Error(`Unsupported currency code: ${code}`);
  return currency;
}
```

```
Supported: PEN/2, USD/2, EUR/2, JPY/0
usd === usdAgain: true
Unknown code: Unsupported currency code: XYZ
```

## Money: composición, y una invariante que cruza dos objetos

```typescript
private constructor(props: MoneyProps) {
  super();
  this.currency = props.currency;
  this.amount = props.amount.round(props.currency.decimals);
  Object.freeze(this);
}
```

```
Salary: 1000.00 USD
Bonus: 250.50 USD
Yen has no cents: 1235 JPY
1000.005 USD: 1000.01 USD
0.004 USD is zero: true
```

```typescript
public add(other: Money): Money {
  if (!this.currency.equals(other.currency)) {
    throw new Error("Cannot add money with different currencies");
  }

  const newAmount = this.amount.add(other.amount);

  return new Money({
    amount: newAmount,
    currency: this.currency,
  });
}
```

```
Total Payout (USD): 1250.00 USD
Original salary amount: 1000.00 USD
Adding different currencies: Cannot add money with different currencies
Subtracting different currencies: Cannot subtract money with different currencies
```

![Money Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/Money-Value-Object.svg)

## Price: añadir una invariante sin duplicar nada

```typescript
export class Price extends ValueObject {
  public readonly money: Money;

  private constructor(props: PriceProps) {
    super();
    this.money = props.money;
    Object.freeze(this);
  }

  public static create(money: Money): Price {
    if (money.amount.isNegative()) {
      throw new Error(`Invalid price: ${money.toString()} cannot be negative`);
    }
    return new Price({ money });
  }
```

```
Unit price: 19.99 USD
Free is a price: 0.00 USD
Negative price: Invalid price: -1.00 USD cannot be negative
unitPrice.equals(samePrice): true
unitPrice.equals(listed): false
```

![Price Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/Price-Value-Object.svg)

## toString() es para leer; toJSON() es para volver

```typescript
// #value is not an own property, so without this hook JSON.stringify would
// emit {} and drop the amount without raising anything.
public toJSON(): string {
  return this.toString();
}
```

```typescript
public toString(): string {
  return `${this.amount.toFixed(this.currency.decimals)} ${this.currency.code}`;
}

public toJSON(): MoneyJSON {
  return {
    amount: this.amount.toFixed(this.currency.decimals),
    currency: this.currency.code,
  };
}
```

```
toString(): 1250.00 USD
JSON.stringify(): {"amount":"1250.00","currency":"USD"}
Nested: {"total":{"amount":"1250.00","currency":"USD"},"unitPrice":{"amount":"19.99","currency":"USD"}}
Round-trips back: true
```

```
Set size for two equal amounts: 2
Lookup with another instance: ten fifty
```

## Cierre
