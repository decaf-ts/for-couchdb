import { MaybeContextualArg, Repository } from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import { Constructor } from "@decaf-ts/decoration";
import { CouchDBAdapter } from "./adapter";
import { ContextOf } from "@decaf-ts/core";
import {
  Context,
  enforceDBDecorators,
  InternalError,
  OperationKeys,
  ValidationError,
} from "@decaf-ts/db-decorators";

export class CouchDBRepository<
  M extends Model,
  A extends CouchDBAdapter<any, any, any>,
> extends Repository<M, A> {
  constructor(adapter: A, model: Constructor<M>) {
    super(adapter, model);
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
  ): Promise<[M, ...args: any[], ContextOf<A>]> {
    const contextArgs = await Context.args<M, ContextOf<A>>(
      OperationKeys.UPDATE,
      this.class,
      args,
      this.adapter,
      this._overrides || {}
    );
    const shouldRunHandlers =
      contextArgs.context.get("ignoreHandlers") !== false;
    const shouldValidate = !contextArgs.context.get("ignoreValidation");
    const pk = model[this.pk] as string;
    if (!pk)
      throw new InternalError(
        `No value for the Id is defined under the property ${this.pk as string}`
      );
    const oldModel = await this.read(pk, ...contextArgs.args);
    model = Model.merge(oldModel, model, this.class);
    if (shouldRunHandlers)
      await enforceDBDecorators<M, Repository<M, A>, any>(
        this,
        contextArgs.context,
        model,
        OperationKeys.UPDATE,
        OperationKeys.ON,
        oldModel
      );

    if (shouldValidate) {
      const errors = await Promise.resolve(
        model.hasErrors(
          oldModel,
          ...Model.relations(this.class),
          ...(contextArgs.context.get("ignoredValidationProperties") || [])
        )
      );
      if (errors) throw new ValidationError(errors.toString());
    }
    if (CouchDBAdapter.getMetadata(oldModel)) {
      if (!CouchDBAdapter.getMetadata(model))
        CouchDBAdapter.setMetadata(model, CouchDBAdapter.getMetadata(oldModel));
    }
    return [model, ...contextArgs.args];
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
  ): Promise<[M[], ...args: any[], ContextOf<A>]> {
    const contextArgs = await Context.args<M, ContextOf<A>>(
      OperationKeys.UPDATE,
      this.class,
      args,
      this.adapter,
      this._overrides || {}
    );
    const shouldRunHandlers =
      contextArgs.context.get("ignoreHandlers") !== false;
    const shouldValidate = !contextArgs.context.get("ignoreValidation");
    const ids = models.map((m) => {
      const id = m[this.pk] as string;
      if (!id) throw new InternalError("missing id on update operation");
      return id;
    });
    const oldModels = await this.readAll(ids, ...contextArgs.args);
    models = models.map((m, i) => {
      m = Model.merge(oldModels[i], m, this.class);
      if (CouchDBAdapter.getMetadata(oldModels[i])) {
        if (!CouchDBAdapter.getMetadata(m))
          CouchDBAdapter.setMetadata(
            m,
            CouchDBAdapter.getMetadata(oldModels[i])
          );
      }
      return m;
    });
    if (shouldRunHandlers)
      await Promise.all(
        models.map((m, i) =>
          enforceDBDecorators<M, Repository<M, A>, any>(
            this,
            contextArgs.context,
            m,
            OperationKeys.UPDATE,
            OperationKeys.ON,
            oldModels[i]
          )
        )
      );

    if (shouldValidate) {
      const ignoredProps =
        contextArgs.context.get("ignoredValidationProperties") || [];

      const errors = await Promise.all(
        models.map((m, i) =>
          Promise.resolve(m.hasErrors(oldModels[i], m, ...ignoredProps))
        )
      );

      const errorMessages = errors.reduce((accum: string | undefined, e, i) => {
        if (e)
          accum =
            typeof accum === "string"
              ? accum + `\n - ${i}: ${e.toString()}`
              : ` - ${i}: ${e.toString()}`;
        return accum;
      }, undefined);

      if (errorMessages) throw new ValidationError(errorMessages);
    }

    models.forEach((m, i) => {
      if (CouchDBAdapter.getMetadata(oldModels[i])) {
        if (!CouchDBAdapter.getMetadata(m))
          CouchDBAdapter.setMetadata(
            m,
            CouchDBAdapter.getMetadata(oldModels[i])
          );
      }
    });
    return [models, ...contextArgs.args];
  }
}
