import { applyViewDecorator, Condition, Operator } from "@decaf-ts/core";
import { Decoration } from "@decaf-ts/decoration";
import { AggregateOptions, CouchDBViewOptions } from "./views/index";

export function groupBy(
  compositionsOrOptions?: string[] | string | CouchDBViewOptions,
  nameOrOptions?: string | CouchDBViewOptions
) {
  let opts: CouchDBViewOptions = {};
  if (Array.isArray(compositionsOrOptions)) {
    opts.compositions = compositionsOrOptions;
  } else if (typeof compositionsOrOptions === "string") {
    opts.name = compositionsOrOptions;
  } else if (compositionsOrOptions) {
    opts = compositionsOrOptions;
  }
  if (typeof nameOrOptions === "string") {
    opts.name = nameOrOptions;
  } else if (nameOrOptions) {
    opts = Object.assign({}, opts, nameOrOptions);
  }
  if (typeof opts.returnDocs === "undefined") {
    opts.returnDocs = true;
  }

  return Decoration.for(Operator.GROUP_BY)
    .define({
      decorator: function groupBy(o?: CouchDBViewOptions) {
        return applyViewDecorator(Operator.GROUP_BY, "groupBy", o);
      },
      args: [opts],
    })
    .apply();
}

export function count(
  valueOrCondition?: any | Condition<any> | AggregateOptions,
  options?: AggregateOptions
) {
  let opts: AggregateOptions = {};
  if (valueOrCondition instanceof Condition) {
    opts.condition = valueOrCondition;
  } else if (typeof valueOrCondition === "object" && valueOrCondition) {
    opts = valueOrCondition as AggregateOptions;
  } else if (typeof valueOrCondition !== "undefined") {
    opts.value = valueOrCondition;
  }
  if (options) opts = Object.assign({}, opts, options);

  return Decoration.for(Operator.COUNT)
    .define({
      decorator: function count(o?: AggregateOptions) {
        return applyViewDecorator(Operator.COUNT, "count", o);
      },
      args: [opts],
    })
    .apply();
}

export function sum(
  conditionOrOptions?: Condition<any> | AggregateOptions,
  options?: AggregateOptions
) {
  let opts: AggregateOptions = {};
  if (conditionOrOptions instanceof Condition) {
    opts.condition = conditionOrOptions;
  } else if (conditionOrOptions) {
    opts = conditionOrOptions as AggregateOptions;
  }
  if (options) opts = Object.assign({}, opts, options);

  return Decoration.for(Operator.SUM)
    .define({
      decorator: function sum(o?: AggregateOptions) {
        return applyViewDecorator(Operator.SUM, "sum", o);
      },
      args: [opts],
    })
    .apply();
}

export function max(
  conditionOrOptions?: Condition<any> | AggregateOptions,
  options?: AggregateOptions
) {
  let opts: AggregateOptions = {};
  if (conditionOrOptions instanceof Condition) {
    opts.condition = conditionOrOptions;
  } else if (conditionOrOptions) {
    opts = conditionOrOptions as AggregateOptions;
  }
  if (options) opts = Object.assign({}, opts, options);

  return Decoration.for(Operator.MAX)
    .define({
      decorator: function max(o?: AggregateOptions) {
        return applyViewDecorator(Operator.MAX, "max", o);
      },
      args: [opts],
    })
    .apply();
}

export function min(
  conditionOrOptions?: Condition<any> | AggregateOptions,
  options?: AggregateOptions
) {
  let opts: AggregateOptions = {};
  if (conditionOrOptions instanceof Condition) {
    opts.condition = conditionOrOptions;
  } else if (conditionOrOptions) {
    opts = conditionOrOptions as AggregateOptions;
  }
  if (options) opts = Object.assign({}, opts, options);

  return Decoration.for(Operator.MIN)
    .define({
      decorator: function min(o?: AggregateOptions) {
        return applyViewDecorator(Operator.MIN, "min", o);
      },
      args: [opts],
    })
    .apply();
}

export function distinct(
  conditionOrOptions?: Condition<any> | AggregateOptions,
  options?: AggregateOptions
) {
  let opts: AggregateOptions = {};
  if (conditionOrOptions instanceof Condition) {
    opts.condition = conditionOrOptions;
  } else if (conditionOrOptions) {
    opts = conditionOrOptions as AggregateOptions;
  }
  if (options) opts = Object.assign({}, opts, options);

  return Decoration.for(Operator.DISTINCT)
    .define({
      decorator: function distinct(o?: AggregateOptions) {
        return applyViewDecorator(Operator.DISTINCT, "distinct", o);
      },
      args: [opts],
    })
    .apply();
}
