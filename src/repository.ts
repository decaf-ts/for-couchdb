import { MaybeContextualArg, Repository } from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import { Constructor } from "@decaf-ts/decoration";
import type { CouchDBAdapter } from "./adapter";
import { getMetadata, setMetadata } from "./metadata";
import { ContextOf } from "@decaf-ts/core";
import {
  enforceDBDecorators,
  reduceErrorsToPrint,
  InternalError,
  OperationKeys,
  ValidationError,
  BulkCrudOperationKeys,
} from "@decaf-ts/db-decorators";
import type { PrimaryKeyType } from "@decaf-ts/db-decorators";

export class CouchDBRepository<
  M extends Model,
  A extends CouchDBAdapter<any, any, any>,
> extends Repository<M, A> {
  constructor(adapter: A, model: Constructor<M>) {
    super(adapter, model);
  }

  protected assignMetadata(model: M, source?: M): M;
  protected assignMetadata(models: M[], source?: M[]): M[];
  protected assignMetadata(target: M | M[], source?: M | M[]): M | M[] {
    const apply = (instance: M, carrier?: M) => {
      const metadataSource = carrier ?? instance;
      const metadata = getMetadata(metadataSource);
      if (metadata) setMetadata(instance, metadata);
      return instance;
    };

    if (Array.isArray(target)) {
      return target.map((model, index) => {
        const carrier = Array.isArray(source) ? source[index] : source;
        return apply(model, carrier);
      });
    }

    const carrier = Array.isArray(source) ? source?.[0] : source;
    return apply(target, carrier);
  }

  override async create(
    model: M,
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<M> {
    const result = await super.create(model, ...args);
    this.assignMetadata(result);
    this.assignMetadata(model, result);
    return result;
  }

  override async createAll(
    models: M[],
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<M[]> {
    const results = await super.createAll(models, ...args);
    this.assignMetadata(results);
    this.assignMetadata(models, results);
    return results;
  }

  override async read(
    id: PrimaryKeyType,
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<M> {
    const result = await super.read(id, ...args);
    return this.assignMetadata(result) as M;
  }

  override async readAll(
    ids: PrimaryKeyType[],
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<M[]> {
    const results = await super.readAll(ids, ...args);
    return this.assignMetadata(results) as M[];
  }

  override async update(
    model: M,
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<M> {
    const result = await super.update(model, ...args);
    this.assignMetadata(result);
    this.assignMetadata(model, result);
    return result;
  }

  override async updateAll(
    models: M[],
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<M[]> {
    const results = await super.updateAll(models, ...args);
    this.assignMetadata(results);
    this.assignMetadata(models, results);
    return results;
  }

  override async delete(
    id: PrimaryKeyType,
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<M> {
    const result = await super.delete(id, ...args);
    return this.assignMetadata(result) as M;
  }

  override async deleteAll(
    ids: PrimaryKeyType[],
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<M[]> {
    const results = await super.deleteAll(ids, ...args);
    return this.assignMetadata(results) as M[];
  }

  /**
   * @description Prepares a model for update.
   * @summary Validates the model and prepares it for update in the database.
   * @param {M} model - The model to update.
   * @param {...any[]} args - Additional arguments.
   * @return The prepared model and context arguments.
   * @throws {InternalError} If the model has no primary key value.
   * @throws {ValidationError} If the model fails validation.
   */
  protected override async updatePrefix(
    model: M,
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<[M, ...args: any[], ContextOf<A>, M | undefined]> {
    const { ctx, ctxArgs, log } = (
      await this.logCtx(args, OperationKeys.UPDATE, true)
    ).for(this.updatePrefix);

    const ignoreHandlers = ctx.get("ignoreHandlers");
    const ignoreValidate = ctx.get("ignoreValidation");
    log.silly(
      `handlerSetting: ${ignoreHandlers}, validationSetting: ${ignoreValidate}`
    );
    const pk = model[this.pk] as string;
    if (!pk)
      throw new InternalError(
        `No value for the Id is defined under the property ${this.pk as string}`
      );
    let oldModel: M | undefined;
    let oldMetadata: any;

    if (ctx.get("applyUpdateValidation")) {
      oldModel = await this.read(pk as string);
      oldMetadata = oldModel ? getMetadata(oldModel) : undefined;

      if (ctx.get("mergeForUpdate"))
        model = Model.merge(oldModel, model, this.class);
    }
    if (!ignoreHandlers)
      await enforceDBDecorators(
        this,
        ctx as any,
        model,
        OperationKeys.UPDATE,
        OperationKeys.ON,
        oldModel
      );

    if (!ignoreValidate) {
      const propsToIgnore = ctx.get("ignoredValidationProperties") || [];
      log.silly(`ignored validation properties: ${propsToIgnore}`);
      const errors = await Promise.resolve(
        model.hasErrors(oldModel, ...propsToIgnore)
      );
      if (errors) throw new ValidationError(errors.toString());
    }
    if (oldMetadata) setMetadata(model, oldMetadata);
    return [model, ...ctxArgs, oldModel];
  }

  /**
   * @description Prepares multiple models for update.
   * @summary Validates multiple models and prepares them for update in the database.
   * @param {M[]} models - The models to update.
   * @param {...any[]} args - Additional arguments.
   * @return {Promise<any[]>} The prepared models and context arguments.
   * @throws {InternalError} If any model has no primary key value.
   * @throws {ValidationError} If any model fails validation.
   */
  protected override async updateAllPrefix(
    models: M[],
    ...args: MaybeContextualArg<ContextOf<A>>
  ): Promise<[M[], ...args: any[], ContextOf<A>, M[] | undefined]> {
    const { ctx, ctxArgs, log } = (
      await this.logCtx(args, BulkCrudOperationKeys.UPDATE_ALL, true)
    ).for(this.updateAllPrefix);

    const ignoreHandlers = ctx.get("ignoreHandlers");
    const ignoreValidate = ctx.get("ignoreValidation");
    log.silly(
      `handlerSetting: ${ignoreHandlers}, ignoredValidation: ${ignoreValidate}`
    );
    const ids = models.map((m) => {
      const id = m[this.pk] as string;
      if (!id) throw new InternalError("missing id on update operation");
      return id;
    });
    let oldModels: M[] | undefined;
    if (ctx.get("applyUpdateValidation")) {
      oldModels = await this.readAll(ids as string[], ctx);
      models = models.map((m, i) => {
        if (ctx.get("mergeForUpdate"))
          m = Model.merge((oldModels as any)[i], m, this.class);
        const oldMetadata = getMetadata((oldModels as any)[i]);
        if (oldMetadata) setMetadata(m, oldMetadata);
        return m;
      });
    }
    if (!ignoreHandlers)
      await Promise.all(
        models.map((m, i) =>
          enforceDBDecorators<M, Repository<M, A>, any>(
            this,
            ctx,
            m,
            OperationKeys.UPDATE,
            OperationKeys.ON,
            oldModels ? oldModels[i] : undefined
          )
        )
      );

    if (!ignoreValidate) {
      const ignoredProps = ctx.get("ignoredValidationProperties") || [];
      log.silly(`ignored validation properties: ${ignoredProps}`);
      let modelsValidation: any;
      if (!ctx.get("applyUpdateValidation")) {
        modelsValidation = await Promise.resolve(
          models.map((m) => m.hasErrors(...ignoredProps))
        );
      } else {
        modelsValidation = await Promise.all(
          models.map((m, i) =>
            Promise.resolve(
              m.hasErrors((oldModels as any)[i] as any, ...ignoredProps)
            )
          )
        );
      }

      const errorMessages = reduceErrorsToPrint(modelsValidation);

      if (errorMessages) throw new ValidationError(errorMessages);
    }
    return [models, ...ctxArgs, oldModels];
  }
}
