import { Condition, Operator, PersistenceKeys } from "@decaf-ts/core";
import { Decoration, Metadata, propMetadata } from "@decaf-ts/decoration";
import { DefaultSeparator } from "@decaf-ts/db-decorators";
import {
  AggregateOptions,
  ViewKind,
  ViewMetadata,
  ViewOptions,
} from "./views/types";
import { CouchDBKeys } from "./constants";

function nextViewSlot(
  target: any,
  key: PersistenceKeys | Operator | string,
  attr: string
): string {
  const existing = Metadata.get(target.constructor, key) || {};
  const attrBucket = existing[attr] || {};
  const next = Object.keys(attrBucket).length + 1;
  return String(next);
}

function applyViewDecorator(
  metaKey: PersistenceKeys | Operator | string,
  kind: ViewKind,
  opts?: ViewOptions
) {
  return function decorator(target: any, attr: any) {
    const slot = opts?.name || nextViewSlot(target, metaKey, attr as string);
    const key = Metadata.key(metaKey, attr as string, slot);
    const value: ViewMetadata = {
      ...(opts || {}),
      kind,
      attribute: attr as string,
    };
    return propMetadata(key, value)(target, attr);
  };
}

export function view(opts?: ViewOptions) {
  return Decoration.for(CouchDBKeys.VIEW)
    .define({
      decorator: function view(o?: ViewOptions) {
        return applyViewDecorator(CouchDBKeys.VIEW, "view", o);
      },
      args: [opts],
    })
    .apply();
}

export function groupBy(
  compositionsOrOptions?: string[] | string | ViewOptions,
  nameOrOptions?: string | ViewOptions
) {
  let opts: ViewOptions = {};
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

  return Decoration.for(Operator.GROUP_BY)
    .define({
      decorator: function groupBy(o?: ViewOptions) {
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

export { DefaultSeparator };
