---
type: 'post'
title: 'Implementación de Value Objects en Node.js'
description: 'Implementación de Value Objects en TypeScript y Node.js, construyendo cinco casos reales, de un email a un precio, donde cada regla del dominio vive en un solo lugar.'
tags: ['nodejs', 'typescript', 'domain-driven-design', 'software-architecture', 'value-object']
publishedAt: '2026-09-07'
repository: 'https://github.com/poschuler/nodejs-ddd-value-objects'
draft: false
---

## Obsesión por los tipos primitivos

Al comenzar a trabajar con Domain Driven Design (DDD) y definir las primeras entidades, es usual definir todas las propiedades con tipos primitivos de TypeScript, como `string`, `number` o `Date`. Si bien esto no es un error por sí mismo, depender únicamente de tipos primitivos nos lleva a un problema llamado "La obsesión por los primitivos".

Imagina que tienes una entidad usuario con una propiedad `email`:

```typescript
export class User {
  public readonly email: string;

  constructor(email: string) {
    this.email = email;
  }
}
```

Aquí el `email` no expresa nada, ya que es simplemente un `string` que puede, técnicamente, cargar valores de casi cualquier tipo: podría traer consigo un nombre o incluso una contraseña. La propiedad de por sí debería expresar un concepto, pero cae en un lenguaje ubicuo pobre, sin expresar su naturaleza.

Otro problema que con el tiempo se va volviendo más caro, es el hecho de que el tipo no garantiza nada: cada capa que toca el email debe asegurarse por cuenta propia de lo que realmente es, aplicar sus propias validaciones, normalizaciones o cualquier regla que "en teoría" este deba cumplir.

Esto puede desencadenar validaciones distintas e incongruentes en cada capa o implementaciones distintas escritas por un desarrollador diferente encargado de la implementación. No existe un mecanismo que obligue a todos a que un email siempre cumpla sus reglas definidas.

Para resolver esto en DDD se utiliza un `Value Object` (VO), que no es más que una clase que representa un concepto del dominio: un email, un importe, un precio, y que por sí misma se hace cargo de su creación, validación y todas las operaciones que sean necesarias sobre él. Con esto la lógica de validación, normalización y/o cualquier regla necesaria queda centralizada y aplicada en el momento de creación del objeto. Y si el objeto no es válido, pues este no logra crearse y falla en ese momento, sin permitir que un objeto inválido viaje por el sistema.

## La clase base `ValueObject`

Un `ValueObject` debe seguir tres reglas fundamentales: igualdad por valor, inmutabilidad y ser siempre válido. Las dos primeras las vemos aquí, la tercera al construir el primer VO.

La primera es la **igualdad por valor**. A diferencia de una entidad, que se define por un identificador único, un VO se define por el valor de sus componentes: dos `Money` de `{10, USD}` son el mismo VO aunque sean instancias distintas en memoria. Un billete de $20 es igual a cualquier otro billete de $20; el número de serie es irrelevante para su función.

La segunda es la **inmutabilidad**. Una vez creado un VO, su valor no cambia; para cambiarlo es necesario construir otro. Un `Money` de $10 al que se le suman $5 no se modifica: `add` devuelve una instancia nueva. Eso elimina los efectos secundarios: si pasas un VO a un servicio tienes la certeza de que el servicio no puede modificarlo.

La clase abstracta implementa la igualdad por valor, mientras que la inmutabilidad la aplica cada VO en su propio constructor con Object.freeze.

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

Cada VO debe declarar en `equalityComponents()` qué lo define, y `equals` compara esa lista posición por posición.

Necesitamos `equalsComponent` porque no todo componente se compara con `===`. Un `Date` se compara por su tiempo, y un componente que a su vez es un VO delega a su propio `equals`, que es lo que permite anidarlos.

## Email

La tercera regla es que un VO **siempre es válido**: un VO tiene la responsabilidad de validar sus propias reglas de dominio y normalizar su valor durante la creación. Si alguna de ellas falla o no es posible, el VO no puede ser creado y arroja una excepción o retorna un error. Esto asegura que solo objetos válidos ingresen al dominio.

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

Con esta implementación, aseguramos que cualquier instancia de `Email` sea siempre válida. Todas las validaciones pasan por el método `create` que es la única puerta de entrada, así que no hay forma de tener un email que no haya pasado por la validación.

Y siguiendo con la regla de la **igualdad por valor**, dos instancias con el mismo valor no son la misma referencia, pero sí son iguales.

```typescript
// 1. Creating two different instances in memory
const emailA = Email.create("ADMIN@company.com");
const emailB = Email.create("  admin@company.com  ");

// 2. Comparing memory references (should be false)
console.log(`emailA === emailB: ${emailA === emailB}`); // -> false

// 3. Comparing by Value (should be true)
console.log(`emailA.equals(emailB): ${emailA.equals(emailB)}`); // -> true

// 4. A case of inequality
const emailC = Email.create("anotherAdmin@company.com");
console.log(`emailA.equals(emailC): ${emailA.equals(emailC)}`); // -> false

// 5. Casing and surrounding blanks never reach the field
console.log(`emailA.value: ${emailA.value}`); // -> admin@company.com
console.log(`emailB.value: ${emailB.value}`); // -> admin@company.com

// 6. A missing value is reported apart from a malformed one
try {
  Email.create("   ");
} catch (error) {
  console.log(`Blank email: ${(error as Error).message}`); // -> Email requires a value
}

// 7. A domain with no dot is not an address
try {
  Email.create("admin@company");
} catch (error) {
  console.log(`Missing TLD: ${(error as Error).message}`); // -> Invalid email address
}

// 8. Neither are consecutive dots
try {
  Email.create("admin..user@company.com");
} catch (error) {
  console.log(`Double dot: ${(error as Error).message}`); // -> Invalid email address
}
```

![Email Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/dark/Email-Value-Object.svg)

## Amount

`Amount` representa una cantidad decimal exacta y por ello no podemos utilizar `number` como tipo de dato, ya que un `number` es un flotante binario y hay decimales que no puede representar. Debido a esto utilizamos `BigNumber` para almacenar internamente el valor de `Amount`, lo que nos permite trabajar con cantidades decimales sin perder precisión.

Al introducir una librería externa como `BigNumber`, es importante no exponerla en la API pública de la clase `Amount`. Por eso, el campo que almacena el valor está definido como un privado real en JavaScript `readonly #value: BigNumber;`, no con el private de TypeScript, que solo existe en tiempo de compilación. Los métodos públicos como `create` y los operadores reciben `number | string` como entrada. Esto permite cambiar la implementación interna sin afectar a las capas que la consumen.

En este caso las validaciones viven en el constructor privado, ya que existen otros puntos de entrada como los métodos `times`, `round`, `add` y `subtract` que también construyen instancias de `Amount` a partir de otra, y no queremos que se pueda crear un `Amount` inválido desde esos métodos.

```typescript
export class Amount extends ValueObject {
  readonly #value: BigNumber;

  private constructor(props: AmountProps) {
    super();

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

  ...

}
```

La validación repetitiva que vemos en el método `create` la mantenemos ahí no como invariante, que ya lo cubre el constructor, sino porque es necesaria para tener un mensaje de error correcto.

```text
sin el guard de create():  Invalid amount: "NaN" is not a number
con el guard de create():  Invalid amount: "abc" is not a number
```

Los métodos que sirven como operadores nunca modifican la instancia sobre la que se llaman: devuelven una nueva. Es la regla de **inmutabilidad** puesta en práctica. Adicionalmente `round` utiliza `assertDecimals` para validar que el argumento es un entero entre 0 y 20, que es el rango de decimales configurado. Y `times` utiliza `Amount.create` para asegurarse de que el factor sea un valor válido, e instancia un nuevo VO a través del constructor `new Amount({ value: newValue })`.

```typescript
public times(multiplier: number | string): Amount {
  const factor = Amount.create(multiplier);
  const newValue = this.#value.times(factor.#value);
  return new Amount({ value: newValue });
}

public round(decimals: number): Amount {
  assertDecimals(decimals);
  const newValue = this.#value.dp(decimals, BigNumber.ROUND_HALF_UP);
  return new Amount({ value: newValue });
}
```

```typescript
const MAX_DECIMALS = 20;

function assertDecimals(decimals: number): void {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > MAX_DECIMALS) {
    throw new Error(
      `Invalid decimals: "${decimals}" must be an integer between 0 and ${MAX_DECIMALS}`,
    );
  }
}
```

Por último `equalityComponents()` no devuelve el `BigNumber`, devuelve su forma canónica en texto. Esto asegura que dos `Amount` con representaciones distintas pero que representan el mismo valor decimal sean considerados iguales.

```typescript
protected equalityComponents(): readonly EqualityComponent[] {
  return [this.#value.toFixed()];
}
```

Validaciones como que el valor sea un número finito positivo o negativo, que la cantidad de decimales sea válida, que la igualdad sea por valor y no por representación, y que los operadores devuelvan nuevas instancias y no modifiquen la actual, son todas reglas que el VO se encarga de garantizar.

```typescript
// 1. Exact decimals, which a number cannot hold
const sum = Amount.create("0.1").add(Amount.create("0.2"));
console.log(`0.1 + 0.2 as Amount: ${sum}`); // -> 0.3

// 2. The VO is only as exact as its input: a number literal arrives already rounded
console.log(`From a number: ${Amount.create(9007199254740993)}`); // -> 9007199254740992
console.log(`From a string: ${Amount.create("9007199254740993")}`); // -> 9007199254740993

// 3. Equality is by value, never by representation
const oneAndAHalf = Amount.create("1.5");
const oneAndAHalfPadded = Amount.create("1.50");
console.log(`"1.50" equals "1.5": ${oneAndAHalfPadded.equals(oneAndAHalf)}`); // -> true

// 4. An operator returns a new instance and leaves the current one untouched
const raw = Amount.create("2.345");
console.log(`raw.round(2): ${raw.round(2)}`); // -> 2.35
console.log(`raw is unchanged: ${raw}`); // -> 2.345

// 5. Negatives are Amount's business; non-negativity belongs to Price
console.log(`(-5).isNegative(): ${Amount.create(-5).isNegative()}`); // -> true

// 6. An invalid value never becomes an Amount
try {
  Amount.create("abc");
} catch (error) {
  console.log(`Not a number: ${(error as Error).message}`); // -> Invalid amount: "abc" is not a number
}

try {
  Amount.create(Number.POSITIVE_INFINITY);
} catch (error) {
  console.log(`Not finite: ${(error as Error).message}`); // -> Invalid amount: "Infinity" is not a finite number
}

// 7. Neither does an operator's argument get in unchecked
try {
  Amount.create(1).times("abc");
} catch (error) {
  console.log(`Bad factor: ${(error as Error).message}`); // -> Invalid amount: "abc" is not a number
}

try {
  Amount.create(1).round(1e9);
} catch (error) {
  console.log(`Bad decimals: ${(error as Error).message}`); // -> Invalid decimals: "1000000000" must be an integer between 0 and 20
}
```

![Amount Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/dark/Amount-Value-Object.svg)

## Currency

`Currency` representa una moneda soportada por el sistema por lo que no podemos utilizar `string` como tipo de dato, ya que un texto libre deja la puerta abierta a cualquier valor. Las monedas soportadas son un conjunto cerrado de códigos, y además cada código carga su propia cantidad de decimales.

El conjunto de monedas soportadas declara ambas cosas, el código y sus decimales, y el tipo de códigos válidos se deriva de ese mismo conjunto, con esto agregar una nueva moneda solo implica cambios en esta definición.

```typescript
export const currencyDecimals = {
  PEN: 2,
  USD: 2,
  EUR: 2,
  JPY: 0,
} as const;

export type CurrencyCode = keyof typeof currencyDecimals;
```

A diferencia de los otros VO que construimos, aquí la regla es de pertenencia: el código debe existir en el conjunto de monedas soportadas. Y esto se resuelve buscando: `fromCode` solo busca el código en la lista y devuelve la instancia correspondiente, o falla si no existe. Asimismo, recibe un `string` y no un `CurrencyCode`, porque es la puerta de entrada al dominio. Además, como el constructor es privado y `All` es la única fuente de instancias, una moneda fuera del conjunto nunca llega a construirse.

```typescript
export class Currency extends ValueObject {
  public readonly code: CurrencyCode;
  public readonly decimals: number;

  private constructor(code: CurrencyCode) {
    super();
    this.code = code;
    this.decimals = currencyDecimals[code];
    Object.freeze(this);
  }

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

  protected equalityComponents(): readonly EqualityComponent[] {
    return [this.code];
  }
}
```

En el constructor privado los `decimals` no se reciben como argumento, simplemente se derivan del código, con esto nos aseguramos de que una moneda solo tenga los decimales previamente declarados. `CurrencyCode` solo existe en tiempo de compilación, por eso la propiedad `All` necesita extraer los códigos de `currencyDecimals`.

Como `All` se construye una sola vez al cargar la clase y `fromCode` siempre devuelve un elemento de esa lista, dos búsquedas del mismo código no solo son iguales por valor: son idénticas por referencia. Esto ocurre porque el conjunto es cerrado, no porque sea algo que puedas dar por hecho en un VO.

Por último `equalityComponents()` devuelve únicamente el código y no los decimales, ya que al derivarse estos del código, incluirlos sería redundante. Dos monedas con el mismo código nunca pueden tener decimales distintos.

```typescript
protected equalityComponents(): readonly EqualityComponent[] {
  return [this.code];
}
```

Que el código pertenezca al conjunto soportado, que los decimales correspondan siempre a su moneda y que la igualdad sea por valor, son todas reglas que el VO se encarga de garantizar.

```typescript
// 1. Setup currencies
const usd = Currency.fromCode("USD");
const eur = Currency.fromCode("EUR");
const jpy = Currency.fromCode("JPY");

// 2. A closed set, each code carrying its decimal places
const supported = Currency.All.map((c) => `${c.code}/${c.decimals}`);
console.log(`Supported: ${supported.join(", ")}`); // -> PEN/2, USD/2, EUR/2, JPY/0

// 3. Currencies are interned: unlike Email, one code is one instance
const usdAgain = Currency.fromCode("USD");
console.log(`usd === usdAgain: ${usd === usdAgain}`); // -> true

// 4. Equality still answers by value, as in every other value object
console.log(`usd.equals(usdAgain): ${usd.equals(usdAgain)}`); // -> true
console.log(`usd.equals(eur): ${usd.equals(eur)}`); // -> false

// 5. A code outside the set has no instance to return
try {
  Currency.fromCode("XYZ");
} catch (error) {
  console.log(`Unknown code: ${(error as Error).message}`); // -> Unsupported currency code: XYZ
}
```

![Currency Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/dark/Currency-Value-Object.svg)

## Money

`Money` representa un importe en una moneda concreta, y es el primer VO que no se construye sobre un primitivo sino sobre otros dos VO. `Amount` garantiza precisión y `Currency` garantiza que la moneda exista y cuántos decimales admite, pero ninguno de los dos puede garantizar por sí solo que un importe sea representable en su moneda: 1000.005 USD no existe. Es una invariante que solo aparece cuando ambos trabajan juntos, y por eso es necesario un VO que los componga.

El constructor simplemente redondea el importe a los decimales que declara su moneda, ya que es la moneda la que gobierna la escala. Con esto un `Money` con más precisión de la que su moneda admite no puede existir. Por ejemplo: no puede existir un `Money` en yenes que tenga centavos ya que su moneda declara cero decimales. Y por lo mismo, un importe por debajo del último decimal de su moneda no queda como una fracción invisible, queda en cero.

```typescript
export class Money extends ValueObject {
  public readonly amount: Amount;

  public readonly currency: Currency;

  private constructor(props: MoneyProps) {
    super();
    this.currency = props.currency;
    this.amount = props.amount.round(props.currency.decimals);
    Object.freeze(this);
  }

  ...

}
```

Lo que `Money` no valida, y es intencional, es el signo, porque un importe negativo sigue siendo dinero, un reembolso por ejemplo.

La segunda invariante es la aritmética. Sumar dos monedas distintas no tiene ningún resultado correcto posible, así que la operación falla en vez de inventar una conversión. Las operaciones son cerradas sobre el propio tipo, reciben un `Money` y devuelven un `Money` nuevo, y la comparación entre monedas se hace con `equals` porque `Money` depende de la igualdad de `Currency`.

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

Por último `equalityComponents()` devuelve los dos VO que lo componen y no sus valores internos. Es el anidamiento que la clase base ya contemplaba: `equals` delega en el de cada componente, así `Amount` decide qué significa que dos importes sean iguales y `Currency` qué significa que dos monedas lo sean, y `Money` no vuelve a comparar nada por su cuenta.

```typescript
protected equalityComponents(): readonly EqualityComponent[] {
  return [this.amount, this.currency];
}
```

Que el importe sea siempre representable en su moneda, que no se pueda operar entre monedas distintas y que la igualdad se resuelva componiendo la de sus partes, son todas reglas que el VO se encarga de garantizar.

```typescript
// 1. Create Money instances
const salary = Money.create({ amount: 1000, currency: usd });
const bonus = Money.create({ amount: "250.5", currency: usd });
const salaryInEUR = Money.create({ amount: 1000, currency: eur });

// 2. Composition: the currency decides the scale the amount is stored at
console.log(`Salary: ${salary}`); // -> 1000.00 USD
console.log(`Bonus: ${bonus}`); // -> 250.50 USD

const inYen = Money.create({ amount: "1234.56", currency: jpy });
console.log(`Yen has no cents: ${inYen}`); // -> 1235 JPY

// 3. Rounding happens at construction, half up
const halfCent = Money.create({ amount: "1000.005", currency: usd });
console.log(`1000.005 USD: ${halfCent}`); // -> 1000.01 USD

// 4. Which means an amount can round its way down to zero
const dust = Money.create({ amount: "0.004", currency: usd });
console.log(`0.004 USD is zero: ${dust.isZero()}`); // -> true

// 5. Equality is composed: each part answers for itself
const sameSalary = Money.create({ amount: "1000.00", currency: usd });
console.log(`salary.equals(sameSalary): ${salary.equals(sameSalary)}`); // -> true
console.log(`salary.equals(bonus): ${salary.equals(bonus)}`); // -> false
console.log(`salary.equals(salaryInEUR): ${salary.equals(salaryInEUR)}`); // -> false

// 6. Operators return a new instance and leave the operands untouched
const fee = Money.create({ amount: "0.5", currency: usd });
const totalPayout = salary.add(bonus).subtract(fee);
console.log(`Total Payout (USD): ${totalPayout}`); // -> 1250.00 USD
console.log(`Original salary: ${salary}`); // -> 1000.00 USD

// 7. Two currencies have no common arithmetic
try {
  salary.add(salaryInEUR);
} catch (error) {
  console.log(`Adding different currencies: ${(error as Error).message}`); // -> Cannot add money with different currencies
}

try {
  salary.subtract(salaryInEUR);
} catch (error) {
  console.log(`Subtracting different currencies: ${(error as Error).message}`); // -> Cannot subtract money with different currencies
}

// 8. Using the Zero factory
const zeroUSD = Money.zero(usd);
console.log(`Is zero? ${zeroUSD.isZero()}`); // -> true
console.log(`Is zero in USD? ${zeroUSD.equals(Money.zero(usd))}`); // -> true
console.log(`Is zero in EUR? ${zeroUSD.equals(Money.zero(eur))}`); // -> false
```

![Money Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/dark/Money-Value-Object.svg)

## Price

Un precio es un `Money` con una regla más: no puede ser negativo. Y esa es la única regla que `Price` se encarga de validar, porque la precisión, los decimales de la moneda y la aritmética ya están garantizados por el `Money` que recibe.

A diferencia de `Amount`, aquí la validación vive en `create` y no en el constructor. `Amount` tuvo que bajarla al constructor porque sus operadores construyen instancias nuevas y son otra puerta de entrada; `Price` no tiene operadores, así que `create` es el único camino.

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

  protected equalityComponents(): readonly EqualityComponent[] {
    return [this.money];
  }
}
```

`Price` no expone operadores, y es una decisión de diseño. Sumar dos precios ciertamente da un precio, pero restarlos podría terminar en un precio negativo, que es justamente lo que `Price` prohíbe. Por eso los operadores se quedan en `Money`, y para volver a tener un `Price` hay que pasar de nuevo por `create`.

Cero es un precio válido; un negativo falla en `create` y nunca llega a construirse. Por último `equalityComponents()` devuelve el `Money` que envuelve, así dos precios se comparan por el `Money` que contienen. Sin embargo, un `Price` nunca es igual a ese `Money`, porque `equals` compara los constructores antes que los componentes.

Que un precio nunca sea negativo, que todo lo demás lo siga sosteniendo el `Money` que envuelve y que la igualdad se resuelva sobre él, son todas reglas que el VO se encarga de garantizar.

```typescript
// 1. A refinement: the same Money, with one invariant added on top
const listed = Money.create({ amount: "19.99", currency: usd });
const unitPrice = Price.create(listed);
console.log(`Unit price: ${unitPrice}`); // -> 19.99 USD

// 2. Zero is a price; negative is not
console.log(`Free is a price: ${Price.create(Money.zero(usd))}`); // -> 0.00 USD

try {
  Price.create(Money.create({ amount: -1, currency: usd }));
} catch (error) {
  console.log(`Negative price: ${(error as Error).message}`); // -> Invalid price: -1.00 USD cannot be negative
}

// 3. Equality recurses through the composed Money
const sameListed = Money.create({ amount: 19.99, currency: usd });
const samePrice = Price.create(sameListed);
console.log(`unitPrice.equals(samePrice): ${unitPrice.equals(samePrice)}`); // -> true

// 4. But a Price is not the Money it wraps: equals compares constructors first
console.log(`unitPrice.equals(listed): ${unitPrice.equals(listed)}`); // -> false

// 5. Arithmetic stayed on Money: coming back to a Price means passing create() again
const twoUnits = Price.create(unitPrice.money.add(unitPrice.money));
console.log(`Two units: ${twoUnits}`); // -> 39.98 USD
```

![Price Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/dark/Price-Value-Object.svg)

## Serialización

Un VO no se queda necesariamente dentro del dominio, puede salir, por ejemplo, hacia una respuesta HTTP y en algún momento volver a ingresar. Esa forma de salida es un contrato y es el VO quien debe definirlo. Por eso `toString` y `toJSON` no devuelven lo mismo: `toString` produce algo legible para una persona, mientras que `toJSON` produce algo de lo que se puede reconstruir el objeto, en el caso de `Money` con el importe como string para no volver a pasar por un flotante en el camino de vuelta.

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

En `Amount` declarar `toJSON` es obligatorio, ya que su valor vive en un campo privado real y `JSON.stringify` no lo ve: sin el hook, un `Amount` se serializa como `{}` y su valor desaparece sin que nada falle. En `Money` el motivo es otro, sus campos sí son visibles y nunca correría ese riesgo, pero sin `toJSON` saldría la moneda entera con sus `decimals` derivados y el importe sin la escala que le corresponde.

No menos importante es el regreso del valor. La forma serializada no vuelve a entrar por el constructor sino por `create` y `fromCode`, es decir, por las mismas puertas que validan cualquier otra entrada al dominio. Un VO que sale y vuelve sigue siendo el mismo valor.

```typescript
// 1. toString() is for humans, and does not round-trip
console.log(`toString(): ${totalPayout}`); // -> 1250.00 USD

// 2. toJSON() is the wire form: amount at the currency scale, code alone
console.log(`JSON.stringify(): ${JSON.stringify(totalPayout)}`); // -> {"amount":"1250.00","currency":"USD"}

// 3. Nested in a payload it serialises just the same
//totalPayout is a Money, unitPrice is a Price
const order = { total: totalPayout, unitPrice };
console.log(`Nested: ${JSON.stringify(order)}`); // -> {"total":{"amount":"1250.00","currency":"USD"},"unitPrice":{"amount":"19.99","currency":"USD"}}

// 4. And the factories read it back into an equal value
const wire = JSON.parse(JSON.stringify(totalPayout)) as MoneyJSON;
const restored = Money.create({
  amount: wire.amount,
  currency: Currency.fromCode(wire.currency),
});
console.log(`Round-trips back: ${restored.equals(totalPayout)}`); // -> true
```

En el ejemplo anterior `total` es un `Money` y `unitPrice` un `Price`, y ambos se serializan con la misma forma, así que un `Price` es indistinguible del `Money` que envuelve. El tipo no viaja en la forma serializada: lo restituye el `create` por el que se decida entrar de vuelta.

Por último, un límite que conviene tener presente: la igualdad por valor es nuestra, no de JavaScript. `Set` y `Map` comparan por referencia, así que dos VO iguales ocupan dos posiciones distintas y una búsqueda con otra instancia falla. Eso no se puede cambiar, pero sí se puede usar la forma serializada como clave, ya que para dos VO iguales es idéntica.

```typescript
// 1. Set and Map key by reference, so two equal amounts are stored twice
//const salary = Money.create({ amount: 1000, currency: usd });
const seen = new Set([salary, Money.create({ amount: 1000, currency: usd })]);
console.log(`Set size for two equal amounts: ${seen.size}`); // -> 2

// 2. The serialised form is the key that behaves by value
const tenFifty = Money.create({ amount: "10.5", currency: usd });
const sameTenFifty = Money.create({ amount: 10.5, currency: usd });
const byMoney = new Map<string, string>();
byMoney.set(JSON.stringify(tenFifty), "ten fifty");

const key = JSON.stringify(sameTenFifty);
console.log(`Lookup with another instance: ${byMoney.get(key)}`); // -> ten fifty
```

## Cierre

- La obsesión por los primitivos nos lleva a tener validaciones distintas e incongruentes en cada capa, ya que el tipo por sí mismo no garantiza nada.

- Un Value Object representa un concepto del dominio y centraliza sus reglas en un solo lugar, por lo que si el objeto logró crearse es porque es válido.

- La igualdad por valor y la inmutabilidad permiten que un VO se pase por todo el sistema sin necesidad de volver a verificarlo.

- Un VO no tiene identidad y ahí está su diferencia con una entidad, ya que dos `Money` de 1000 USD representan el mismo dinero.

- No todo dato requiere un VO, solamente aquellos conceptos del dominio que cargan reglas propias.

Los Value Objects son una solución simple, ya que nos permiten encapsular la validación y las reglas de un concepto dentro de objetos inmutables que el resto del sistema puede dar por válidos.

![Domain Layer Overview](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/dark/Domain-Layer-Overview.svg)
