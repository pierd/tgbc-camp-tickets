import {
  AggregateField,
  CollectionReference,
  DocumentData,
  DocumentReference,
  OrderByDirection,
  Query,
  SetOptions,
  UpdateData,
  WhereFilterOp,
  WithFieldValue,
  getFirestore,
} from "firebase-admin/firestore";
import { DbCollections } from "../shared/src/db";

export const db = getFirestore();
db.settings({ ignoreUndefinedProperties: true });

export function collection<T extends DocumentData>(
  name: DbCollections
): CollectionReferenceT<T> {
  return new CollectionReferenceT<T>(
    db.collection(name) as CollectionReference<T, T>
  );
}

export class QueryT<T extends DocumentData, Q extends Query<T, T>> {
  protected ref: Q;
  constructor(ref: Q) {
    this.ref = ref;
  }
  async get() {
    return await this.ref.get();
  }
  where<F extends Extract<keyof T, string>>(
    field: F,
    op: WhereFilterOp,
    value: T[F]
  ): QueryT<T, Query<T, T>> {
    return new QueryT(this.ref.where(field, op, value));
  }
  orderBy<F extends Extract<keyof T, string>>(
    field: F,
    direction?: OrderByDirection
  ): QueryT<T, Query<T, T>> {
    return new QueryT(this.ref.orderBy(field, direction));
  }
  limit(limit: number): QueryT<T, Query<T, T>> {
    return new QueryT(this.ref.limit(limit));
  }
  count() {
    return this.ref.count();
  }
  sum<F extends Extract<keyof T, string>>(field: F, outputField: string) {
    return this.ref.aggregate({
      [outputField]: AggregateField.sum(field),
    });
  }
}

export class CollectionReferenceT<T extends DocumentData> extends QueryT<
  T,
  CollectionReference<T, T>
> {
  constructor(ref: CollectionReference<T, T>) {
    super(ref);
  }
  doc(id?: string): DocumentReferenceT<T> {
    if (id === undefined) {
      return new DocumentReferenceT<T>(this.ref.doc());
    }
    return new DocumentReferenceT<T>(this.ref.doc(id));
  }
  async add(data: WithFieldValue<T>): Promise<DocumentReferenceT<T>> {
    return DocumentReferenceT.wrap(await this.ref.add(data));
  }
}

export class DocumentReferenceT<T extends DocumentData> {
  ref: DocumentReference<T, T>;
  get id(): string {
    return this.ref.id;
  }
  get path(): string {
    return this.ref.path;
  }
  constructor(ref: DocumentReference<T, T>) {
    this.ref = ref;
  }
  static wrap<T extends DocumentData>(
    ref: DocumentReference<unknown>
  ): DocumentReferenceT<T> {
    return new DocumentReferenceT<T>(ref as DocumentReference<T, T>);
  }
  collection<C extends DocumentData>(
    name: DbCollections
  ): CollectionReferenceT<C> {
    return new CollectionReferenceT(
      this.ref.collection(name)
    ) as CollectionReferenceT<C>;
  }
  get() {
    return this.ref.get();
  }
  create(data: WithFieldValue<T>) {
    return this.ref.create(data);
  }
  set(data: WithFieldValue<T>, options?: SetOptions) {
    return options ? this.ref.set(data, options) : this.ref.set(data);
  }
  update(data: UpdateData<T>) {
    return this.ref.update(data);
  }
  delete() {
    return this.ref.delete();
  }
}
