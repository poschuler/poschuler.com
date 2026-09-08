---
type: 'post'
title: 'Implementing Value Objects in Node.js'
description: 'Implementing Value Objects in TypeScript and Node.js by building five real cases, from an email to a price, where every rule of the domain lives in a single place.'
tags: ['nodejs', 'typescript', 'domain-driven-design', 'software-architecture', 'value-object']
publishedAt: '2025-11-02'
repository: 'https://github.com/poschuler/nodejs-ddd-value-objects'
draft: false
updates:
  - date: '2026-09-07'
    note: 'Rewritten end to end. Spanish is now where this post is written first, and this English version was translated from it by an LLM. It adds three value objects — Amount, Currency and Price — plus serialization and why Set and Map do not honor equality by value.'
---

## Primitive obsession

When you start out with Domain Driven Design (DDD) and define your first entities, it is common to give every property a primitive TypeScript type, such as `string`, `number` or `Date`. That is not a mistake in itself, but relying only on primitive types leads to a problem known as "primitive obsession".

Imagine you have a user entity with an `email` property:

```typescript
export class User {
  public readonly email: string;

  constructor(email: string) {
    this.email = email;
  }
}
```

Here `email` expresses nothing. It is just a `string`, and technically it can carry a value of almost any kind: it could be holding a name, or even a password. The property should stand for a concept, but it settles instead for a poor ubiquitous language that says nothing about its own nature.

There is another problem, and it gets more expensive with time: the type guarantees nothing. Every layer that touches the email has to work out on its own what it really is, and apply its own validation, its own normalization, or whatever rules the value is "supposed" to satisfy.

That ends in validation that differs and contradicts itself from one layer to the next, or in different implementations written by whichever developer happened to be in charge. Nothing forces everyone to agree that an email always meets the rules defined for it.

DDD solves this with a `Value Object` (VO), which is nothing more than a class that stands for a concept of the domain — an email, an amount, a price — and takes charge of its own creation, its validation and every operation that concept needs. Validation, normalization and any other rule end up centralized and applied at the moment the object is created. And if the value is not valid, the object never comes into existence: it fails right there, without letting an invalid object travel through the system.

## The base `ValueObject` class

A `ValueObject` follows three fundamental rules: equality by value, immutability, and being always valid. The first two are covered here; the third arrives with the first VO we build.

The first is **equality by value**. An entity is defined by a unique identifier; a VO is defined by the value of its components. Two `Money` of `{10, USD}` are the same VO even though they are two different instances in memory. A $20 bill is worth the same as any other $20 bill; its serial number is irrelevant to its function.

The second is **immutability**. Once a VO is created its value does not change; changing it means building another one. A `Money` of $10 with $5 added to it is not modified: `add` returns a new instance. That removes side effects — if you hand a VO to a service, you know for certain the service cannot modify it.

The abstract class implements equality by value, while immutability is applied by each VO in its own constructor, with Object.freeze.

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

Every VO has to declare in `equalityComponents()` what defines it, and `equals` compares that list position by position.

We need `equalsComponent` because not every component compares with `===`. A `Date` compares by its time, and a component that is itself a VO delegates to its own `equals`, which is what makes nesting possible.

## Email

The third rule is that a VO is **always valid**: a VO is responsible for validating its own domain rules and normalizing its value during creation. If one of them fails, or is not possible, the VO cannot be created and either throws an exception or returns an error. That is what keeps anything but valid objects out of the domain.

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

With this implementation we make sure that any `Email` instance is always valid. All the validation runs through `create`, the only way in, so there is no way to end up with an email that never passed it.

And following the rule of **equality by value**, two instances holding the same value are not the same reference, but they are equal.

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

`Amount` stands for an exact decimal quantity, and that is why we cannot use `number` as its data type: a `number` is a binary float and there are decimals it simply cannot represent. So we store the value of `Amount` internally as a `BigNumber`, which lets us work with decimal quantities without losing precision.

When you bring in an external library like `BigNumber`, it matters that it does not show up in the public API of the `Amount` class. That is why the field holding the value is declared as a real JavaScript private, `readonly #value: BigNumber;`, and not with TypeScript's `private`, which only exists at compile time. Public methods such as `create` and the operators take `number | string` as input. That way the internal implementation can change without affecting the layers that consume it.

Here the validation lives in the private constructor, because there are other ways in: `times`, `round`, `add` and `subtract` also build `Amount` instances out of an existing one, and we do not want an invalid `Amount` to be creatable from any of them.

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

The validation that `create` repeats is kept there not as an invariant, which the constructor already covers, but because it is what makes the error message correct.

```text
without create()'s guard:  Invalid amount: "NaN" is not a number
with create()'s guard:     Invalid amount: "abc" is not a number
```

The methods that act as operators never modify the instance they are called on: they return a new one. That is the rule of **immutability** put into practice. On top of that, `round` uses `assertDecimals` to check that its argument is an integer between 0 and 20, the configured range of decimal places. And `times` uses `Amount.create` to make sure the factor is a valid value, then builds a new VO through the constructor, `new Amount({ value: newValue })`.

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

Finally, `equalityComponents()` does not return the `BigNumber`, it returns its canonical form as text. That makes sure two `Amount` with different representations of the same decimal value are considered equal.

```typescript
protected equalityComponents(): readonly EqualityComponent[] {
  return [this.#value.toFixed()];
}
```

That the value is a finite number, positive or negative; that the number of decimal places is valid; that equality answers by value and not by representation; and that the operators return new instances rather than modifying the current one — those are all rules the VO takes charge of guaranteeing.

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

`Currency` stands for a currency the system supports, and that is why we cannot use `string` as its data type: free text leaves the door open to any value at all. The supported currencies are a closed set of codes, and each code carries its own number of decimal places on top of that.

The set of supported currencies declares both things, the code and its decimals, and the type of valid codes is derived from that same set, so adding a new currency only means touching this definition.

```typescript
export const currencyDecimals = {
  PEN: 2,
  USD: 2,
  EUR: 2,
  JPY: 0,
} as const;

export type CurrencyCode = keyof typeof currencyDecimals;
```

Unlike the other VOs we built, the rule here is membership: the code has to exist in the set of supported currencies. And that is settled by looking it up — `fromCode` just searches the list for the code and returns the matching instance, or fails if there is none. It also takes a `string` and not a `CurrencyCode`, because it is the way into the domain. And since the constructor is private and `All` is the only source of instances, a currency outside the set never gets built at all.

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

The private constructor does not take the `decimals` as an argument, it simply derives them from the code, which is how we make sure a currency only ever has the decimals declared for it. `CurrencyCode` exists only at compile time, which is why the `All` property has to pull the codes out of `currencyDecimals`.

Because `All` is built once when the class loads and `fromCode` always returns an element of that list, two lookups of the same code are not merely equal by value: they are identical by reference. That happens because the set is closed, not because it is something you can take for granted in a VO.

Finally, `equalityComponents()` returns only the code and not the decimals: since the decimals are derived from the code, including them would be redundant. Two currencies with the same code can never have different decimals.

```typescript
protected equalityComponents(): readonly EqualityComponent[] {
  return [this.code];
}
```

That the code belongs to the supported set, that the decimals always match their currency, and that equality answers by value — those are all rules the VO takes charge of guaranteeing.

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

`Money` stands for an amount in a specific currency, and it is the first VO built not on a primitive but on two other VOs. `Amount` guarantees precision and `Currency` guarantees that the currency exists and how many decimals it admits, but neither of them can guarantee on its own that an amount is representable in its currency: 1000.005 USD does not exist. It is an invariant that only shows up when both work together, and that is why a VO composing them is needed.

The constructor simply rounds the amount to the decimals its currency declares, because the currency is what governs the scale. With that, a `Money` carrying more precision than its currency admits cannot exist. There can be no `Money` in yen with cents, for instance, because that currency declares zero decimals. And by the same rule, an amount below the last decimal of its currency does not linger as an invisible fraction: it lands on zero.

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

What `Money` does not validate, and this is deliberate, is the sign, because a negative amount is still money — a refund, for example.

The second invariant is arithmetic. Adding two different currencies has no possible correct result, so the operation fails instead of inventing a conversion. The operations are closed over the type itself, they take a `Money` and return a new `Money`, and currencies are compared with `equals` because `Money` depends on `Currency`'s equality.

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

Finally, `equalityComponents()` returns the two VOs that compose it and not their internal values. This is the nesting the base class already accounted for: `equals` delegates to each component's own, so `Amount` decides what it means for two amounts to be equal and `Currency` what it means for two currencies to be, and `Money` compares nothing again on its own.

```typescript
protected equalityComponents(): readonly EqualityComponent[] {
  return [this.amount, this.currency];
}
```

That the amount is always representable in its currency, that no arithmetic can cross currencies, and that equality is resolved by composing that of its parts — those are all rules the VO takes charge of guaranteeing.

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

A price is a `Money` with one more rule: it cannot be negative. And that is the only rule `Price` takes charge of validating, because precision, the currency's decimals and the arithmetic are already guaranteed by the `Money` it receives.

Unlike `Amount`, the validation here lives in `create` and not in the constructor. `Amount` had to push it down to the constructor because its operators build new instances and are another way in; `Price` has no operators, so `create` is the only path.

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

`Price` exposes no operators, and that is a design decision. Adding two prices certainly gives a price, but subtracting them could end in a negative price, which is exactly what `Price` forbids. So the operators stay on `Money`, and getting back to a `Price` means going through `create` again.

Zero is a valid price; a negative one fails in `create` and never gets built. Finally, `equalityComponents()` returns the `Money` it wraps, so two prices are compared by the `Money` they hold. A `Price` is never equal to that `Money`, though, because `equals` compares constructors before it compares components.

That a price is never negative, that everything else stays held up by the `Money` it wraps, and that equality is resolved over that `Money` — those are all rules the VO takes charge of guaranteeing.

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

## Serialization

A VO does not necessarily stay inside the domain. It can leave — towards an HTTP response, for instance — and come back in at some point. That outgoing shape is a contract, and it is the VO that has to define it. Which is why `toString` and `toJSON` do not return the same thing: `toString` produces something a person can read, while `toJSON` produces something the object can be rebuilt from, in `Money`'s case with the amount as a string so the trip back does not pass through a float again.

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

On `Amount`, declaring `toJSON` is mandatory: its value lives in a real private field that `JSON.stringify` cannot see, so without the hook an `Amount` serializes as `{}` and its value disappears without anything failing. On `Money` the reason is a different one — its fields are visible and it would never run that risk — but without `toJSON` the whole currency would go out with its derived `decimals`, and the amount without the scale that belongs to it.

No less important is the value's way back. The serialized form does not re-enter through the constructor but through `create` and `fromCode`, that is, through the same doors that validate any other entry into the domain. A VO that leaves and comes back is still the same value.

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

In the example above `total` is a `Money` and `unitPrice` a `Price`, and both serialize to the same shape, so a `Price` is indistinguishable from the `Money` it wraps. The type does not travel in the serialized form: it is restored by whichever `create` you decide to come back in through.

Finally, a limit worth keeping in mind: equality by value is ours, not JavaScript's. `Set` and `Map` compare by reference, so two equal VOs take up two different slots and a lookup with another instance fails. That cannot be changed, but the serialized form can be used as the key, since for two equal VOs it is identical.

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

## Closing

- Primitive obsession leaves us with validation that differs and contradicts itself from one layer to the next, because the type on its own guarantees nothing.

- A Value Object stands for a concept of the domain and centralizes its rules in a single place, so if the object was created at all it is because it is valid.

- Equality by value and immutability let a VO be passed around the whole system without having to be checked again.

- A VO has no identity, and that is where it parts ways with an entity, since two `Money` of 1000 USD stand for the same money.

- Not every piece of data needs a VO, only those concepts of the domain that carry rules of their own.

Value Objects are a simple solution, since they let us encapsulate a concept's validation and rules inside immutable objects that the rest of the system can take as valid.

![Domain Layer Overview](https://raw.githubusercontent.com/poschuler/nodejs-ddd-value-objects/refs/heads/main/architecture/diagrams/dark/Domain-Layer-Overview.svg)
