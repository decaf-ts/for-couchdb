import { sf } from "@decaf-ts/decorator-validation";
import { Sequence as Seq } from "../model/CouchDBSequence";
import {
  InternalError,
  IRepository,
  NotFoundError,
} from "@decaf-ts/db-decorators";
import { repository, SequenceOptions } from "@decaf-ts/core";
import { Sequence } from "@decaf-ts/core";

/**
 * @summary Abstract implementation of a Sequence
 * @description provides the basic functionality for {@link Sequence}s
 *
 * @prop {Repository} repository
 * @prop {SequenceOptions} [options] defaults to {@link DefaultSequenceOptions}
 *
 * @class AbsSequence
 * @abstract
 * @implements Sequence
 *
 * @category Sequences
 */
export class CouchDBSequence implements Sequence {
  @repository(Seq)
  protected repo!: IRepository<Seq>;

  constructor(protected readonly options: SequenceOptions) {}

  /**
   * @summary Retrieves the current value for the sequence
   * @protected
   */
  async current(): Promise<string | number | bigint> {
    const { name, startWith } = this.options;
    try {
      const sequence: Seq = await this.repo.read(name as string);
      return this.parse(sequence.current as string | number);
    } catch (e: any) {
      if (e instanceof NotFoundError) {
        if (typeof startWith === "undefined")
          throw new InternalError(
            "Starting value is not defined for a non existing sequence",
          );
        try {
          return this.parse(startWith);
        } catch (e: any) {
          throw new InternalError(
            sf(
              "Failed to parse initial value for sequence {0}: {1}",
              startWith.toString(),
              e,
            ),
          );
        }
      }
      throw new InternalError(
        sf(
          "Failed to retrieve current value for sequence {0}: {1}",
          name as string,
          e,
        ),
      );
    }
  }

  /**
   * @summary Parses the {@link Sequence} value
   *
   * @protected
   * @param value
   */
  protected parse(value: string | number | bigint): string | number | bigint {
    switch (this.options.type) {
      case "Number":
        return typeof value === "string"
          ? parseInt(value)
          : typeof value === "number"
            ? value
            : BigInt(value);
      case "BigInt":
        return BigInt(value);
      default:
        throw new InternalError("Should never happen");
    }
  }

  /**
   * @summary increments the sequence
   * @description Sequence specific implementation
   *
   * @param {any} current
   * @param create
   * @protected
   */
  protected async increment(
    current: string | number | bigint,
    create = false,
  ): Promise<string | number | bigint> {
    const { type, incrementBy, name } = this.options;
    let next: string | number | bigint;
    switch (type) {
      case "Number":
        next = (this.parse(current) as number) + incrementBy;
        break;
      case "BigInt":
        next = (this.parse(current) as bigint) + BigInt(incrementBy);
        break;
      default:
        throw new InternalError("Should never happen");
    }
    let seq: Seq;
    if (create) {
      seq = await this.repo.create(new Seq({ name: name, current: next }));
    } else {
      seq = await this.repo.read(name as string);
      seq = await this.repo.update(
        new Seq(
          Object.assign({}, seq, {
            current: next,
          }),
        ),
      );
    }
    return seq.current as string | number | bigint;
  }

  /**
   * @summary Generates the next value in th sequence
   * @description calls {@link AbsSequence#parse} on the current value
   * followed by {@link AbsSequence#increment}
   *
   * @param {T} model
   */
  async next(): Promise<number | string | bigint> {
    const current = await this.current();
    return this.increment(current);
  }
}
