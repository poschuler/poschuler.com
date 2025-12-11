import { type z } from "zod";
import { objectifySearchParams } from "~/utils/objectify-search-params";

type FieldErrors = { [key: string]: string };

type paramsValidateResult<T extends z.ZodTypeAny> = {
  success: boolean;
  data: z.infer<T>;
  errors: FieldErrors;
};

export function validateSearchParams<T extends z.ZodTypeAny>(
  urlSearchParams: URLSearchParams,
  zodSchema: T
): paramsValidateResult<T> {
  let dataResult: z.infer<T> = {};

  const fields = objectifySearchParams(urlSearchParams);
  const result = zodSchema.safeParse(fields);
  const errors: FieldErrors = {};

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      errors[path] = issue.message;
    });
  } else {
    dataResult = result.data;
  }

  return {
    success: result.success,
    data: dataResult,
    errors: errors,
  };
}
