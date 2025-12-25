---
type: 'post'
title: 'Implementing Value Objects in Node.js'
description: 'A practical guide to implementing Value Objects in TypeScript and Node.js to create more robust and expressive domain models, inspired by Domain-Driven Design principles.'
tags: ['nodejs', 'typescript', 'ddd', 'architecture', 'value-object']
publishedAt: '2025-11-02'
repository: 'https://github.com/poschuler/nodejs-ddd-value-objects'
---
## I. Introduction: The Primitive Obsession and Data Integrity

When we begin working with Domain-Driven Design (DDD), we usually define the properties of our Entities/Aggregates using primitive JavaScript/TypeScript types, such as string, number, or Date. This, in itself, is not an error.

However, the exclusive reliance on primitive types to represent domain concepts leads us to a problem we call the "Primitive Obsession".

### Problems of Primitive Obsession

Relying solely on primitive types leads us to two fundamental problems:

1. Poor Ubiquitous Language: If we define a property as `email: string`, the code doesn't express the true domain intent, and questions arise like, Is it validated? Is it normalized? The language often becomes ambiguous-

2. Violation of DRY (Don't Repeat Yourself): In many cases, the primitive obsession leaves the door open for validation, normalization, and business rules to become scattered and decentralized, going against the DRY principle.

Following the email example, if the format is validated in the Controller, then in the Application layer, and again in the Domain layer, we are violating the DRY principle, which leads to fragile and harder-to-maintain code.

### The DDD Solution: Value Objects (VOs)

In DDD, we implement Value Objects to help solve these problems.

A Value Object (VO) is a pattern that seeks to encapsulate the logic for the validation, creation, and manipulation of a specific field or a group of fields.

The VO not only defines the structure of the data but also the business rules that govern it. If a valid `EmailAddress` cannot be created, the creation must fail immediately, forcing the subsequent layer to handle the error

## II. The Three Pillars of a Value Object

A Value Object (VO) is only a VO if it complies with three fundamental rules. These rules act as the contract that guarantees data integrity within the Domain. If an object does not meet one of these rules, it is likely an Entity, not a Value Object.

1. **Immutability.**

    Once a Value Object is created, **its value cannot change**. To "change" a VO, you must destroy the old one and create a new instance.

    For example:

    - If we have an `EmailAddress` with the value "<user@domain.com>", there should be no way to change its value to "<new@domain.com>" or any other value.

    - If we consider a VO like `Money` that has a value of $10 and we wanted to add $5 to it, the add(5) method does not modify the current instance; it returns a new `Money` instance with the updated amount.

    Immutability is important because it eliminates unexpected side effects. For instance, if you pass a VO to a service, you have full certainty that the service will not modify it, guaranteeing the object's consistency.

2. **Equality by Value.**

    Unlike Entities (which are defined by a unique identifier), a Value Object is defined by the value of its components; a VO does not have a unique identifier.

    Two VOs are equal if all their properties are equal.

    - If we have a Money object A with `{amount: 10, currency: USD}` and a Money object B with `{amount: 10, currency: USD}`, they are exactly the same Value Object, even if they are two different instances in memory.

    - Thinking of a real-world example: A $20 bill is equal to any other $20 bill. The value is the same; its serial number is irrelevant to its function.

3. **The Guarantee of an "Always Valid" Value**

    The Value Object holds the exclusive responsibility of validating its own business rules and normalizing its data during the creation process.

    - **Validation**: Does the `EmailAddress` comply with the required format? Does the `DateRange` have a start date that precedes the end date?

    - **Normalization**: If the input is "<USER@DOMAIN.COM>", the VO will internally convert it to its canonical form (clean and lowercase): "<user@domain.com>".

    If validation fails or normalization is impossible, the VO will prevent its own creation, either by throwing an exception or by returning a Result object containing the error. This ensures that only valid objects enter our Domain

## III. Building the Base `ValueObject` Class

The goal is to create an abstract base class, `ValueObject`, which handles **equality by value** and defines the contract of immutability for all classes that inherit from it.

A. The Abstract `ValueObject`

```typescript
// Define EqualityComponent to handle both primitives and nested VOs for value equality
type EqualityComponent = string | number | boolean  | Date | null | undefined | ValueObject;

export abstract class ValueObject {

  /**
  * Equality Contract:
  * Obliges every VO to declare which properties define its value.
  * @returns An array of the components that must be compared.
  */
  protected abstract getEqualityComponents(): EqualityComponent[];

  /**
  * Method to compare two VOs.
  */
  public equals(other?: ValueObject): boolean {
    // 1. Check if the object to compare is null or undefined
    if (other === null || other === undefined) {
      return false;
    }

    // 2. Check if they are of the same type
    if (other.constructor !== this.constructor) {
      return false;
    }

    // 3. Get the components to compare
    const componentsA = this.getEqualityComponents();
    const componentsB = other.getEqualityComponents();

    // 4. Check that they have the same length
    if (componentsA.length !== componentsB.length) {
      return false;
    }

    // 5. Iterate the components and compare them
    return componentsA.every((component, index) => {
      const otherComponent = componentsB[index];

      // 6. If any of the components is null or undefined
      if (component === null || component === undefined || otherComponent === null || otherComponent === undefined) {
        return component === otherComponent;
      }

      // 7. If any of the components is a ValueObject, compare recursively
      if (component instanceof ValueObject && otherComponent instanceof ValueObject) {
        return component.equals(otherComponent);
      }

      // 8. If they are of type Date
      if (component instanceof Date && otherComponent instanceof Date) {
        return component.getTime() === otherComponent.getTime();
      }

      // 9. Otherwise, compare the primitive values
      return component === otherComponent;
    });
  }
}

```

B. Immutability and Extensibility

With this *abstract base class*, we achieve two critical things

  1. **Contract Enforcement**: By making `getEqualityComponents()` abstract, we force every developer creating a new VO to explicitly declare what defines its value. There is no way to forget this.

  2. **Automatic Equality**: The `equals()` method does all the heavy lifting, including recursive comparison for nested VOs.

      - For example, if we compare two `Money` objects, the `equals` method knows that the `Currency` component is, in turn, another `ValueObject`, and automatically calls `currency.equals()` to ensure a deep and correct comparison.

## IV. Real-World Examples of Value Objects

A. Example 1: `EmailAddress`

For this example, the VO will ensure that the internal string is always a valid and canonical email. For this, we will use:

1. `static create()`: This static method will be the sole responsible for creating a new VO, performing validation and normalization

2. `private constructor()`: We define a private constructor, thereby only allowing objects to be created from the `create()` method.

```typescript

export class Email extends ValueObject {

  //Immutable state (readonly)
  public readonly value: string;

  //Private constructor
  private constructor(value: string) {
    super();
    this.value = value;
  }

  //Static factory, receives the input, validates and normalizes the email, in case of error it should throw an exception.
  public static create(input: string): Email {

    if (!input) throw new Error("Email requires a value");

    const normalizedEmail = input.trim().toLowerCase();

    if (!Email.isValid(normalizedEmail)) {
      throw new Error("Invalid email address");
    }

    return new Email(normalizedEmail);
  }

  // Method that returns the components to compare
  protected getEqualityComponents() {
    return [this.value];
  }

  // Simple logic to validate an email
  private static isValid(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

```

With this implementation, we ensure that any `Email` instance is always a valid instance.

Likewise, we can validate the equality functionality of our class with a simple example.

```typescript

// 1. Creating two different instances in memory
const emailA = Email.create("ADMIN@company.com");
const emailB = Email.create("admin@company.com");

// 2. Comparing memory references (should be false)2. Comparing memory references
console.log(`emailA === emailB: ${emailA === emailB}`); // -> false

// 3. Comparing by Value (should be true)
console.log(`emailA.equals(emailB): ${emailA.equals(emailB)}`); // -> true

// 4. A case of inequality
const emailC = Email.create("anotherAdmin@company.com");
console.log(`emailA.equals(emailC): ${emailA.equals(emailC)}`); // -> false

```

  ![Email Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/Email-Value-Object.svg)

B. Example 2: `Money`

The Money VO is more complex because it is composed of amount and currency, both of which are Value Objects.

First, we define Amount, for which we will use BigNumber to avoid problems with decimal values.

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

Now we define Money, which will utilize Amount.

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

  //Nested Amount VO
  public readonly amount: Amount;

  //Nested Currency VO
  public readonly currency: Currency;

  private constructor(props: MoneyProps) {
    super();
    this.amount = props.amount;
    this.currency = props.currency;
  }

  // Static factory with validation
  static create(inputProps: CreateMoneyProps) {
    if (!inputProps) throw new Error("Money requires props");
    if (!inputProps.currency) throw new Error("Money requires currency");

    const amountVO = Amount.create(inputProps.amount);

    return new Money({
      amount: amountVO,
      currency: inputProps.currency,
    });
  }

  //The add method does not modify the VO; instead, it returns a new instance
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

  //Other methods we can use in our domain, depending on the case
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

  // Method that returns the components to compare, including the nested VO
  protected getEqualityComponents() {
    return [this.amount, this.currency]
  }
  
}

```

- Composition: We can compose two VOs by nesting them as needed; in our example, we used Currency and Amount inside Money.

- Immutability: The `add()` method always creates and returns a `new Amount()`, never modifying its own state.

  ![Money Value Object](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/Money-Value-Object.svg)

## V. Final Thoughts

- The Primitive Obsession can lead us to write code that is expensive to maintain and fragile

- The use of Value Objects is a pragmatic design decision that improves the ubiquitous language of the domain.

- Using Value Objects helps us ensure that the domain always has valid and consistent data.

- Value Objects are the foundation for building an expressive and robust Domain.

Value Objects are a simple and powerful solution, helping us encapsulate validation and value logic within immutable objects.
