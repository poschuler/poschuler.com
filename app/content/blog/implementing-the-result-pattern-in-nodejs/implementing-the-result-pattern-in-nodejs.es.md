---
type: 'post'
title: 'Implementación del Result pattern en Node.js'
description: 'Cómo implementar el Result pattern en TypeScript y Node.js: los errores conocidos quedan en la firma, y el try/catch se reserva para los que realmente son inesperados.'
tags: ['nodejs', 'typescript', 'error-handling', 'backend']
publishedAt: '2026-10-26'
repository: 'https://github.com/poschuler/nodejs-result-pattern'
---

El Result pattern nos permite trabajar con errores explícitamente definidos: tenemos certeza de qué errores pueden ocurrir, y quien llama a la función sabe cómo manejarlos.

Es importante entender que usar este patrón no implica en absoluto que dejemos de usar `try/catch`, sino que su uso queda reservado para los errores que realmente son inesperados, como una falla de red o la caída de algún servicio, mientras que los errores conocidos se manejan como parte del flujo de la aplicación. Asimismo, el código suele ser más limpio y legible, ya que no llenamos de `try/catch` cada llamada, sino que podemos tener, por ejemplo, un exception handler global que se encargue de los errores inesperados.

Para ver las ventajas de utilizar el Result pattern, implementaremos el registro de un usuario primero lanzando excepciones y luego devolviendo un objeto `Result`. El código completo está en el [repositorio](https://github.com/poschuler/nodejs-result-pattern).

## Registro de usuario lanzando excepciones

Definiremos que el registro de un usuario tiene dos errores conocidos: que el email no sea válido y que el email ya esté registrado. En la versión con excepciones cada error es una clase que extiende `Error`. El primero lo lanza `Email.create()`:

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

El segundo lo lanza `execute()` cuando el email ya está registrado:

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

La firma dice que `execute()` devuelve un `User`, lo cual es correcto; sin embargo, no dice nada de qué pasa cuando algo falla. Para saber qué errores puede lanzar hay que leer la implementación. Quien llama a `execute()` debe capturarlos y revisar de qué tipo es cada uno sin ayuda del compilador, por ejemplo con `instanceof`:

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

Los errores llegan al `catch` como `unknown`: el email inválido, el email repetido e incluso la base de datos caída salen por el mismo lugar, y separarlos es una cadena de `instanceof` que mantenemos a mano. Lo que no reconocemos termina en `reportUnexpected()`, que lo trata como una falla: le muestra al usuario un mensaje genérico y deja el detalle en los logs. Si borramos el `else if` de `EmailTakenError`, el código sigue compilando, pero el email repetido deja de reconocerse y termina ahí. El usuario recibe un error genérico en lugar de saber que su email ya está registrado, y en los logs aparece como falla algo que era un caso conocido.

## El tipo Result

Un `Result` es una unión discriminada sobre `ok`: o es un `Success` que lleva el valor, o es un `Failure` que lleva el error.

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

Cuando revisamos `ok`, TypeScript estrecha el tipo: dentro de `if (!result.ok)` solo existe `error`, y si ese `if` termina con un `return`, después de él solo existe `value`:

```typescript
if (!result.ok) {
  console.log(result.error); // only `error` exists here
  return;
}

console.log(result.value); // only `value` exists here
```

El compilador no nos deja leer el valor sin pasar antes por esa revisión.

## Registro de usuario devolviendo un objeto Result

`Email` mantiene el mismo comportamiento, pero se apoya en el tipo `Result` para devolver los errores explícitamente definidos:

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

El error ya no es una clase que extiende `Error`, sino un objeto con un `code` literal. Ese `code` es lo que permite que quien llama a `create()` distinga un error de otro sin recurrir a `instanceof`.

El registro de usuario también devuelve un `Result`, y junta sus dos errores conocidos en un solo tipo:

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

Ahora la firma dice claramente qué errores puede devolver: los de `RegisterUserError`.

El `return email` no construye un error nuevo: devuelve el mismo que recibió de `Email.create()`. TypeScript lo acepta porque un `Failure` solo lleva el error, no un valor, y ese error ya es uno de los que admite `RegisterUserError`.

## Manejo del Result

Al recibir el `Result`, revisamos `ok` y traducimos cada error a lo que corresponda: en este ejemplo, un mensaje en la consola; en una API, una respuesta HTTP.

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

El `switch` también estrecha el tipo: `error.detail` solo se puede leer en el caso de `invalidEmail`. Y como `toMessage()` no tiene `default`, si agregamos un nuevo código a `RegisterUserError` y olvidamos manejarlo, el código deja de compilar:

```
error TS2366: Function lacks ending return statement and return type does not include 'undefined'.
```

Con la cadena de `instanceof` pasa lo contrario: olvidar un caso compila sin problemas, y el error conocido termina en `reportUnexpected()` como si fuera una falla.

## El try/catch sigue siendo indispensable

Para simular una base de datos caída, usamos un repositorio que rechaza cada llamada:

```typescript
const unreachable: UserRepository = {
  existsByEmail: () => Promise.reject(new Error("connection refused")),
  save: () => Promise.reject(new Error("connection refused")),
};
```

En ninguna de las dos versiones `execute()` captura ese error. Una base de datos caída no es un error del registro de usuario, y quien llama no tiene nada específico que hacer con él. Por eso no forma parte de `RegisterUserError`: se lanza y termina en `reportUnexpected()`.

Con `Result`, el `catch` solo llama a `reportUnexpected()`, porque los errores conocidos ya no llegan hasta ahí. Ese `catch` puede vivir en un exception handler global, y en cada llamada queda solamente el `if (!result.ok)`.

## Corriendo ambas versiones

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

Ambas versiones nos llevan a la misma salida, pero las diferencias están en el fondo. Con `Result`, los errores conocidos se ven en la firma y sabemos qué esperar; además, el compilador nos avisa si nos falta manejar alguno. El `try/catch` queda para los errores que realmente son inesperados.

