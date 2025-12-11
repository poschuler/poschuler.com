import { type ZodTypeDef, type z } from "zod";

type FieldErrors = { [key: string]: string };

type FormFields = {
  [key: string]: FormDataEntryValue | FormDataEntryValue[];
};

function objectify(formData: FormData) {
  const formFields: FormFields = {};

  formData.forEach((value, name) => {
    const isArrayField = name.endsWith("[]");
    const fieldName = isArrayField ? name.slice(0, -2) : name;

    if (!(fieldName in formFields)) {
      formFields[fieldName] = isArrayField ? formData.getAll(name) : value;
    }
  });

  return formFields;
}

export function validateForm<Input, Output, R, E>(
  formData: FormData,
  zodSchema: z.Schema<Output, ZodTypeDef, Input>,
  successFn: (data: Output) => R,
  errorFn: (errors: FieldErrors) => E
) {
  const fields = objectify(formData);
  const result = zodSchema.safeParse(fields);
  if (!result.success) {
    const errors: FieldErrors = {};
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      errors[path] = issue.message;
    });
    return errorFn(errors);
  }
  return successFn(result.data);
}

type formDataValidateResult<T extends z.ZodTypeAny> = {
  success: boolean;
  data: z.infer<T>;
  errors: FieldErrors;
};

export function validateFormData<T extends z.ZodTypeAny>(
  formData: FormData,
  zodSchema: T
): formDataValidateResult<T> {
  const fields = objectify(formData);
  const result = zodSchema.safeParse(fields);
  const errors: FieldErrors = {};
  let dataResult: z.infer<T> = {};

  if (!result.success) {
    result.error.issues.forEach((issue) => {
      const path = issue.path.join(".");
      errors[path] = issue.message;
    });
  } else {
    dataResult = result.data;
  }
  return { success: result.success, data: dataResult, errors };
}
