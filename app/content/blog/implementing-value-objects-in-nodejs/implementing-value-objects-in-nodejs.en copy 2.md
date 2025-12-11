---
type: 'post'
title: 'Implementing Value Objects in Node.js'
description: 'A practical guide to implementing Value Objects in TypeScript and Node.js to create more robust and expressive domain models, inspired by Domain-Driven Design principles.'
tags: ['nodejs', 'typescript', 'ddd', 'architecture', 'value-object']
publishedAt: '2025-11-02'
repository: 'https://github.com/poschuler/nodejs-ddd-value-objects'
---
## I. Introducción: La Obsesión por los Primitivos y la Integridad de los Datos

Cuando comenzamos a trabajar con Domain-Driven Design (DDD), solemos definir las propiedades de nuestras Entidades/Agregados utilizando tipos primitivos de JavaScript/TypeScript, tales como string, number, o Date. Esto de por sí, no es un error.

Sin embargo, la dependencia exclusiva de tipos primitivos para representar conceptos de dominio  nos lleva a un problema que denominamos la "Obsesión por los Primitivos".

### Problemas de la obsesión por los primitivos

Depender únicamente de tipos primitivos nos lleva a dos problemas fundamentales:

1. Pobreza en el Lenguaje Ubicuo: Si definimos una propiedad como `email: string`, el código no expresa la verdadera intención del dominio y nacen preguntas como, ¿Está validado? ¿Está normalizado? El lenguaje suele volverse ambiguo.

2. Violación de DRY: En muchos casos la obsesión por los primitivos deja puertas abiertas a que las reglas de validación, normalización, y de negocio se dispersen y descentralicen, yendo en contra de DRY.

Siguiendo con el ejemplo del email, si el formato se valida en el Controller, luego en la capa de Aplicación y nuevamente en la capa de Dominio, estamos violando el principio DRY, lo cual nos lleva a un código frágil y mas dificil de mantener.

### La Solución DDD: Value Objects (VOs)

En DDD, implementamos los Value Objects para ayudar a resolver estos problemas.

Un Value Object es un patrón que busca encapsular la lógica para la validación, creación, y manipulación de un campo o un grupo de campos específicos.

El VO no solo define la estructura del dato, sino también las reglas de negocio que lo rigen. Si no se puede crear un `EmailAddress` válido, la creación debe fallar inmediatamente, forzando a la siguiente capa a manejar el error.

## II. Los tres pilares de un Value Object

Un Value Object solo es un VO si cumple con tres reglas fundamentales. Estas reglas son el contrato que garantiza la integridad de los datos en el Dominio. Si un objeto no cumple con una de estas reglas, es probable que no sea un Value Object, sino una Entidad.

1. **Inmutabilidad.**

    Una vez que un Value Object es creado, **su valor no puede cambiar**. Para "cambiar" un VO, debes destruirlo y crear uno nuevo.

    Por ejemplo:

    - Si tenemos un `EmailAddress` con el valor "<usuario@dominio.com>", no debe existir una forma de cambiar su valor a "<nuevo@dominio.com>" o a ningún otro.

    - Si pensamos en un VO como `Money` que tenga un valor de $10 y quisieramos sumarle $5, el método add(5) no modifica la instancia actual; retorna una nueva instancia de `Money` con el nuevo monto.

    La inmutabilidad es importante, porque elimina los efectos secundarios inesperados. Por ejemplo, si pasasamos un VO a un servicio, tenemos la total certeza de que el servicio no lo modificará, garantizando la consistencia del mismo.

2. **Igualdad por Valor.**

    A diferencia de las Entidades (que se definen por un identificador único), un Value Object se define por el valor de sus componentes, es decir un VO no tiene identificador único.

    Dos VOs son iguales si todas sus propiedades son iguales.

    - Si tenemos un objeto Money A con `{amount: 10, currency: USD}` y un objeto Money B con `{amount: 10, currency: USD}`, son exactamente el mismo Value Object, aunque sean dos instancias diferentes en memoria.

    - Pensando en un ejemplo real: Un billete de $20 es igual a cualquier otro billete de $20. El valor es el mismo; su número de serie es irrelevante para su función.

3. **La Garantía de tener un valor "Siempre Válido"**

    El Value Object tiene la responsabilidad exclusiva de validar sus propias reglas de negocio y normalizar sus datos durante el proceso de creación.

    - **Validación**: ¿El `EmailAddress` cumple con el formato? ¿El `DateRange` tiene una fecha de inicio anterior a la fecha de fin?

    - **Normalización**: Si el input es "<USER@DOMAIN.COM>", el VO lo convertirá internamente a su forma canónica (limpia y minúscula): "<user@domain.com>".

    Si la validación falla o la normalización es imposible, el VO impedirá su propia creación, ya sea lanzando una excepción o devolviendo un objeto Result con el error. Con esto nos aseguramos que solo objetos válidos entren en nuestro Dominio.

## III. Construyendo la Clase Base `ValueObject`

El objetivo es crear una clase base, abstracta, `ValueObject`, que se encargue de la **igualdad por valor** y defina el contrato de inmutabilidad para todas las clases que la hereden.

A. La Clase Abstracta `ValueObject`

```typescript
// Definimos EqualityComponent para manejar tanto primitivos como VO anidades en la igualdad por valor
type EqualityComponent = string | number | boolean  | Date | null | undefined | ValueObject;

export abstract class ValueObject {

  /**
  * Contrato de Igualdad:
  * Obliga a cada VO a declarar qué propiedades definen su valor.
  * @returns Un array de los componentes que deben ser comparados.
  */
  protected abstract getEqualityComponents(): EqualityComponent[];

  /**
  * Método para comparar dos VOs.
  */
  public equals(other?: ValueObject): boolean {
    // 1. Validamos si el objeto a comprar es nulo o undefined
    if (other === null || other === undefined) {
      return false;
    }

    //2. Validamos si son del mismo tipo
    if (other.constructor !== this.constructor) {
      return false;
    }

    //3. Obtenemos los componentes a comparar
    const componentsA = this.getEqualityComponents();
    const componentsB = other.getEqualityComponents();

    //4. Validamos que tengan la misma longitud
    if (componentsA.length !== componentsB.length) {
      return false;
    }

    //5. Iteramos los componentes y los comparamos
    return componentsA.every((component, index) => {
      const otherComponent = componentsB[index];

      //6. Si alguno de los componentes es null o undefined
      if (component === null || component === undefined || otherComponent === null || otherComponent === undefined) {
        return component === otherComponent;
      }

      //7. Si alguno de los componentes es un ValueObject comparamos de forma recursiva
      if (component instanceof ValueObject && otherComponent instanceof ValueObject) {
        return component.equals(otherComponent);
      }

      //8. Si son tipo Date
      if (component instanceof Date && otherComponent instanceof Date) {
        return component.getTime() === otherComponent.getTime();
      }

      //8. en caso contrario comparamos los valores primitivos
      return component === otherComponent;
    });
  }
}

```

B. Inmutabilidad y la Extensibilidad

Con esta *clase base abstracta* logramos dos cosas críticas:

  1. **Imposición de Contrato**: Al hacer `getEqualityComponents()` abstracto, forzamos a cada desarrollador que crea un nuevo VO a declarar explícitamente qué define su valor. No hay forma de olvidarlo.

  2. **Igualdad Automática**: El método `equals()`  hace todo el trabajo pesado, incluyendo la comparación recursiva para VOs anidados.

      - Por ejemplo, si comparamos dos objetos `Money`, el método `equals` sabe que el componente `Currency` es, a su vez, otro `ValueObject`, y automáticamente llama a `currency.equals()` para garantizar una comparación profunda y correcta.

## IV. Algunos ejemplos reales de Value Objects

A. Ejemplo 1: `EmailAddress`

Para este ejemplo, el VO se asegurará de que el string interno sea siempre un email válido y canónico. Para esto utilizaremos:

1. `static create()`: este método estático será el único responsable de crear un nuevo VO, realizando la validación y normalización.

2. `private constructor()`: definimos un constructor privado, de tal manera que solo permitimos crear objetos desde el método `create()`.

```typescript

export class Email extends ValueObject {

  //Estado inmutable (readonly)
  public readonly value: string;

  //Constructor privado
  private constructor(value: string) {
    super();
    this.value = value;
  }

  //Fábrica estática, recibe el input, valida y normaliza el email, en caso de error deberá generar una excepción.
  public static create(input: string): Email {

    if (!input) throw new Error("Email requires a value");

    const normalizedEmail = input.trim().toLowerCase();

    if (!Email.isValid(normalizedEmail)) {
      throw new Error("Invalid email address");
    }

    return new Email(normalizedEmail);
  }

  // Método que retorna los componentes a comparar
  protected getEqualityComponents() {
    return [this.value];
  }

  // Lógica simple para validar un email
  private static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

```

Con esta implementación, nos aseguramos que cualquier instancia de `Email` sea siempre una instancia válida.

Así mismo podemos validar la funcionalidad de igualdad de nuestra clase con un simple ejemplo.

```typescript

// 1. Creamos dos instancias diferentes en memoria
const emailA = Email.create("ADMIN@company.com");
const emailB = Email.create("admin@company.com");

// 2. Comparamos las referencias de memoria
console.log(emailA === emailB); // -> false

// 3. Comparamos por el Valor 
console.log(emailA.equals(emailB)); // -> true

// 4. Un caso de desigualdad 
const emailC = Email.create("otroadmin@company.com");
console.log(emailA.equals(emailC)); // -> Resultado: false

```

  ![Email Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/Email-Value-Object.svg)

B. Ejemplo 2: `Money`

El VO Money es más complejo ya que está compuesto de amount y currency, siendo ambos Value Objects.

Primero definmos Amount, para el cual utilizaremos BigNumber para evitar problemas con los valores decimales.

```typescript
import BigNumber from "bignumber.js";

const ROUNDING_MODE = BigNumber.ROUND_HALF_UP;
const DECIMAL_PLACES = 2;

type AmountProps = {
  readonly value: BigNumber;
};

export class Amount extends ValueObject {

  public readonly value: BigNumber;

  private constructor(props: AmountProps) {
    super();
    this.value = props.value.dp(DECIMAL_PLACES, ROUNDING_MODE);
  }

  public static create(input: number | string | BigNumber): Amount {
    try {
      const bigValue = new BigNumber(input);

      if (bigValue.isNaN()) {
        throw new Error("Invalid amount: not a number");
      }

      if (bigValue.isNegative()) {
        throw new Error("Invalid amount: amount cannot be negative");
      }

      return new Amount({ value: bigValue });
    } catch {
      throw new Error(`Error creating Amount from input: ${input}`);
    }
  }

  public add(other: Amount): Amount {
    const newValue = this.value.plus(other.value);
    return new Amount({ value: newValue });
  }

  public times(multiplier: number): Amount {
    const newValue = this.value.times(multiplier);
    return new Amount({ value: newValue });
  }

  public isZero(): boolean {
    return this.value.isZero();
  }

  public toString(): string {
    return this.value.toFixed(DECIMAL_PLACES, ROUNDING_MODE);
  }

  public toNumber(): number {
    return parseFloat(this.toString());
  }

  protected getEqualityComponents() {
    return [this.value.toFixed(DECIMAL_PLACES)];
  }
}

```

Ahora definimos Money el cual utilizará Amount.

```typescript

type MoneyProps = {
  readonly amount: number;
  readonly currency: Currency;
};

type CreateMoneyProps = {
  readonly amount: number | string;
  readonly currency: Currency;
};

export class Money extends ValueObject {

  //VO Amount anidado
  public readonly amount: Amount;

  //VO Currency anidado
  public readonly currency: Currency;

  private constructor(props: MoneyProps) {
    super();
    this.amount = props.amount;
    this.currency = props.currency;
  }

  // Fábrica estática con validación
  static create(inputProps: CreateMoneyProps) {
    if (!inputProps) throw new Error("Money requires props");
    if (!inputProps.currency) throw new Error("Money requires currency");

    const amountVO = Amount.create(inputProps.amount);

    return new Money({
      amount: amountVO,
      currency: inputProps.currency,
    });
  }

  //El método add no modifica el VO, en cambio retorna una nueva instancia
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

  //otros métodos que podemos usar en nuestro dominio, según sea el caso
  public static zero(): Money;
  public static zero(props: { currency: Currency }): Money;

  public static zero(props?: { currency: Currency }): Money {
    const currency = props?.currency ?? Currency.None;
    const zeroAmount = Amount.create(0);
    return new Money({ currency, amount: zeroAmount });
  }

  public isZero(): boolean {
    return this.amount.isZero();
  }

  public isZeroInCurrency({ currency }: { currency: Currency }): boolean {
    return this.amount.isZero() && this.currency.equals(currency);
  }

  // Método que retorna los componentes a comparar, incluyendo el VO anidado
  protected getEqualityComponents() {
    return [this.amount, this.currency]
  }
  
}

```

- Composición: Podemos componer dos VO anidándolos según sea necesario, en nuestro ejemplo usamos Currency y Amount dentro de Money.

- Inmutabilidad: El método `add()` siempre crea y devuelve un `new Amount()`, nunca modifica su propio estado.

  ![Money Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/Money-Value-Object.svg)

## V. Cierre: Lo Esencial del Value Object

- La obsesión por los primitivos puede llevarnos a escribir código que sea costoso de mantener y frágil.

- El uso de Value Objects es una decisión de diseño pragmática que mejora el lenguaje del domínio.

- El uso de Value Objects nos ayuda a asegurar que el dominio tenga siempre datos válidos y consistentes.

- Los Value Objects son la base para construir un Dominio expresivo y robusto.

Los Value Object son una solución simple y poderosa: ayudandonos a encapsular la validación y la lógica de valor en objetos inmutables.
