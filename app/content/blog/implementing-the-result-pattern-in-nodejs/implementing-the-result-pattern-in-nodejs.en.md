---
type: 'post'
title: 'Implementing the Result pattern in Node.js'
description: 'How to implement the Result pattern in TypeScript and Node.js: known errors live in the signature, and try/catch is reserved for the ones that are truly unexpected.'
tags: ['nodejs', 'typescript', 'error-handling', 'backend']
publishedAt: '2026-10-26'
repository: 'https://github.com/poschuler/nodejs-result-pattern'
---

The Result pattern lets us work with explicitly defined errors: we know for certain which errors can happen, and whoever calls the function knows how to handle them.

It is important to understand that using this pattern does not mean we stop using `try/catch` at all. Its use is reserved for the errors that are truly unexpected, such as a network failure or a service going down, while known errors are handled as part of the application's flow. The code also tends to be cleaner and easier to read, since we do not wrap every call in a `try/catch`; instead we can have, for example, a global exception handler that takes care of the unexpected errors.

To see the advantages of using the Result pattern, we will implement user registration first by throwing exceptions and then by returning a `Result` object. The full code is in the [repository](https://github.com/poschuler/nodejs-result-pattern).

## User registration throwing exceptions

Let's say registering a user has two known errors: the email is not valid, and the email is already registered. In the version with exceptions, each error is a class that extends `Error`. The first one is thrown by `Email.create()`:

```typescript
export class InvalidEmailError extends Error {
  public override readonly name = "InvalidEmailError";
}

export class Email {
  private constructor(public readonly value: string) {}

  public static create(raw: string): Email {
    const normalized = raw.trim().toLowerCase();

    if (normalized === "") {
      throw new InvalidEmailError("Email is required");
    }

    if (!EMAIL_PATTERN.test(normalized)) {
      throw new InvalidEmailError("Email must look like name@domain.tld");
    }

    return new Email(normalized);
  }
}
```

The second one is thrown by `execute()` when the email is already registered:

```typescript
export class EmailTakenError extends Error {
  public override readonly name = "EmailTakenError";

  public constructor() {
    super("Email is already registered");
  }
}

export class RegisterUserThrowing {
  public constructor(private readonly users: UserRepository) {}

  public async execute(input: RegisterUserInput): Promise<User> {
    const email = Email.create(input.email);

    if (await this.users.existsByEmail(email)) {
      throw new EmailTakenError();
    }

    const user: User = { email };
    await this.users.save(user);

    return user;
  }
}
```

The signature says `execute()` returns a `User`, which is correct; however, it says nothing about what happens when something fails. To know which errors it can throw, you have to read the implementation. Whoever calls `execute()` has to catch them and check the type of each one with no help from the compiler, for example with `instanceof`:

```typescript
try {
  const user = await registerUser.execute({ email });
  console.log(`Registered ${user.email.value}`);
} catch (error) {
  if (error instanceof InvalidEmailError) {
    console.log(error.message);
  } else if (error instanceof EmailTakenError) {
    console.log("That email is already registered");
  } else {
    reportUnexpected(error);
  }
}
```

Errors reach the `catch` as `unknown`: the invalid email, the email already taken and even a database that is down all come out the same way, and telling them apart is a chain of `instanceof` that we maintain by hand. Whatever we do not recognize ends up in `reportUnexpected()`, which treats it as a failure: it shows the user a generic message and leaves the details in the logs. If we delete the `else if` for `EmailTakenError`, the code still compiles, but the email already taken is no longer recognized and ends up there. The user gets a generic error instead of learning that their email is already registered, and the logs show as a failure something that was a known case.

## The Result type

A `Result` is a discriminated union on `ok`: it is either a `Success` carrying the value, or a `Failure` carrying the error.

```typescript
export type Success<T> = {
  readonly ok: true;
  readonly value: T;
};

export type Failure<E> = {
  readonly ok: false;
  readonly error: E;
};

export type Result<T, E> = Success<T> | Failure<E>;

function success<T>(value: T): Success<T> {
  return { ok: true, value };
}

function failure<E>(error: E): Failure<E> {
  return { ok: false, error };
}

export const Result = {
  success,
  failure,
};
```

When we check `ok`, TypeScript narrows the type: inside `if (!result.ok)` only `error` exists, and if that `if` ends with a `return`, only `value` exists after it:

```typescript
if (!result.ok) {
  console.log(result.error); // only `error` exists here
  return;
}

console.log(result.value); // only `value` exists here
```

The compiler does not let us read the value without going through that check first.

## User registration returning a Result object

`Email` keeps the same behavior, but relies on the `Result` type to return the explicitly defined errors:

```typescript
export type EmailError = {
  readonly code: "invalidEmail";
  readonly detail: string;
};

export class Email {
  private constructor(public readonly value: string) {}

  public static create(raw: string): Result<Email, EmailError> {
    const normalized = raw.trim().toLowerCase();

    if (normalized === "") {
      return Result.failure({
        code: "invalidEmail",
        detail: "Email is required",
      });
    }

    if (!EMAIL_PATTERN.test(normalized)) {
      return Result.failure({
        code: "invalidEmail",
        detail: "Email must look like name@domain.tld",
      });
    }

    return Result.success(new Email(normalized));
  }
}
```

The error is no longer a class that extends `Error`, but an object with a literal `code`. That `code` is what lets whoever calls `create()` tell one error from another without resorting to `instanceof`.

User registration also returns a `Result`, and puts its two known errors together in a single type:

```typescript
export type RegisterUserError = EmailError | { readonly code: "emailTaken" };

export class RegisterUser {
  public constructor(private readonly users: UserRepository) {}

  public async execute(
    input: RegisterUserInput,
  ): Promise<Result<User, RegisterUserError>> {
    const email = Email.create(input.email);

    if (!email.ok) {
      return email;
    }

    if (await this.users.existsByEmail(email.value)) {
      return Result.failure({ code: "emailTaken" });
    }

    const user: User = { email: email.value };
    await this.users.save(user);

    return Result.success(user);
  }
}
```

Now the signature clearly says which errors it can return: those in `RegisterUserError`.

The `return email` does not build a new error: it returns the same one it got from `Email.create()`. TypeScript accepts it because a `Failure` only carries the error, not a value, and that error is already one of those `RegisterUserError` allows.

## Handling the Result

When we receive the `Result`, we check `ok` and translate each error into whatever fits: in this example, a message on the console; in an API, an HTTP response.

```typescript
try {
  const result = await registerUser.execute({ email });

  if (!result.ok) {
    console.log(toMessage(result.error));
    return;
  }

  console.log(`Registered ${result.value.email.value}`);
} catch (error) {
  reportUnexpected(error);
}

function toMessage(error: RegisterUserError): string {
  switch (error.code) {
    case "invalidEmail":
      return error.detail;
    case "emailTaken":
      return "That email is already registered";
  }
}
```

The `switch` narrows the type too: `error.detail` can only be read in the `invalidEmail` case. And since `toMessage()` has no `default`, if we add a new code to `RegisterUserError` and forget to handle it, the code stops compiling:

```
error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

With the `instanceof` chain it is the other way around: forgetting a case compiles without complaint, and the known error ends up in `reportUnexpected()` as if it were a failure.

## try/catch is still essential

To simulate a database that is down, we use a repository that rejects every call:

```typescript
const unreachable: UserRepository = {
  existsByEmail: () => Promise.reject(new Error("connection refused")),
  save: () => Promise.reject(new Error("connection refused")),
};
```

In neither version does `execute()` catch that error. A database that is down is not a user registration error, and whoever calls has nothing specific to do about it. That is why it is not part of `RegisterUserError`: it is thrown and ends up in `reportUnexpected()`.

With `Result`, the `catch` only calls `reportUnexpected()`, because known errors no longer get that far. That `catch` can live in a global exception handler, and each call is left with just the `if (!result.ok)`.

## Running both versions

```
--- with exceptions ---
Registered ada@example.com
Email must look like name@domain.tld
That email is already registered
Something went wrong, try again later
Error: connection refused
--- with Result ---
Registered ada@example.com
Email must look like name@domain.tld
That email is already registered
Something went wrong, try again later
Error: connection refused
```

Both versions lead to the same output, but the differences run deeper. With `Result`, the known errors are visible in the signature and we know what to expect; on top of that, the compiler warns us if we miss handling one. `try/catch` is left for the errors that are truly unexpected.
