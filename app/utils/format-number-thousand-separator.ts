export const formatNumberThousandSeparator = (number: number) => {
  return Intl.NumberFormat("en-US").format(number);
};
