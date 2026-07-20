export function withFn(
    this: any,
    context: any,
    options: any
  ) {
    return options.fn(context);
  }
