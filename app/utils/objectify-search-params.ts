type SearchFields = {
  [key: string]: string | string[];
};

export function objectifySearchParams(
  searchParams: URLSearchParams
): SearchFields {
  const searchFields: SearchFields = {};

  searchParams.forEach((value, name) => {
    const isArrayField = name.endsWith("[]");
    const fieldName = isArrayField ? name.slice(0, -2) : name;

    if (!(fieldName in searchFields)) {
      searchFields[fieldName] = isArrayField
        ? searchParams.getAll(name)
        : value;
    }
  });

  return searchFields;
}
