import { useEffect, useMemo, useRef, useState } from "react";
import {
  Query,
  QueryDocumentSnapshot,
  queryEqual,
  onSnapshot,
  CollectionReference,
  DocumentReference,
  DocumentSnapshot,
  doc,
  QueryConstraint,
  query,
  type WhereFilterOp,
  where,
  type OrderByDirection,
  orderBy,
  type DocumentData,
  collection,
} from "firebase/firestore";
import _ from "lodash";
import { useAuth } from "./contexts/AuthContext";
import { DbCollections, type DbCampParticipant, type DbCampParticipantInstallment, type DbStripeCheckoutSession } from "shared";
import { db } from "./firebase";

export type Loadable<T, ErrorExtra = object> =
  | { status: "loading"; value: undefined }
  | { status: "loaded"; value: T }
  | ({ status: "error"; value: undefined } & ErrorExtra);

export interface QueryConstraintT<
  AppModelType,
  DbModelType extends DocumentData,
> extends QueryConstraint {
  // Phantom fields to preserve type parameters
  readonly __appModelType?: AppModelType;
  readonly __dbModelType?: DbModelType;
}

/// Typed version of firebase `query`
export function queryT<AppModelType, DbModelType extends DocumentData>(
  q: Query<AppModelType, DbModelType>,

  ...queryConstraints: (
    | QueryConstraintT<AppModelType, DbModelType>
    | undefined
  )[]
): Query<AppModelType, DbModelType> {
  const qc = queryConstraints.filter(
    (c) => c !== undefined
  ) as QueryConstraintT<AppModelType, DbModelType>[];

  return query(q, ...qc);
}

/// Typed version of firebase `where`
export function whereT<
  AppModelType,
  DbModelType extends DocumentData,
  K extends keyof AppModelType,
>(
  fieldPath: K,
  opStr: "in",
  value: Array<AppModelType[K]>
): QueryConstraintT<AppModelType, DbModelType>;
// eslint-disable-next-line no-redeclare
export function whereT<
  AppModelType,
  DbModelType extends DocumentData,
  K extends keyof AppModelType,
>(
  fieldPath: K,
  opStr: WhereFilterOp,
  value: AppModelType[K]
): QueryConstraintT<AppModelType, DbModelType>;
// eslint-disable-next-line no-redeclare
export function whereT<
  AppModelType,
  DbModelType extends DocumentData,
  K extends keyof AppModelType,
>(
  fieldPath: K,
  opStr: WhereFilterOp,
  value: AppModelType[K]
): QueryConstraintT<AppModelType, DbModelType> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return where(fieldPath as any, opStr, value);
}

/// Typed version of firebase `orderBy`
export function orderByT<
  AppModelType,
  DbModelType extends DocumentData,
  K extends keyof AppModelType,
>(
  fieldPath: K,
  directionStr?: OrderByDirection
): QueryConstraintT<AppModelType, DbModelType> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return orderBy(fieldPath as any, directionStr);
}

export function useFirebaseQuery<
  AppModelType,
  DbModelType extends DocumentData,
>(query: Query<AppModelType, DbModelType> | undefined) {
  const currentQuery = useFirebaseQueryDedup(query);
  return useFirebaseQuerySnapshotUnsafe(currentQuery);
}

export function useFirebaseQueryDedup<
  AppModelType,
  DbModelType extends DocumentData,
>(
  query: Query<AppModelType, DbModelType> | undefined
): Query<AppModelType, DbModelType> | undefined {
  const currentQuery = useRef<Query<AppModelType, DbModelType> | undefined>(
    query
  );

  if (
    query === undefined ||
    currentQuery.current === undefined ||
    !queryEqual(query, currentQuery.current)
  ) {
    currentQuery.current = query;
  }
  return currentQuery.current;
}

/** WARNING: This must be used together with useFirebaseQueryDedup. If unsure, use useFirebaseQuery */
export function useFirebaseQuerySnapshotUnsafe<
  AppModelType,
  DbModelType extends DocumentData,
>(query: Query<AppModelType, DbModelType> | undefined) {
  const [docs, setDocs] = useState<
    QueryDocumentSnapshot<AppModelType, DbModelType>[]
  >([]);
  const docsRef = useRef(docs);
  useEffect(() => {
    const unsubscribe =
      query === undefined
        ? () => {}
        : onSnapshot(query, (snapshot) => {
            const newDocs = snapshot.docs;

            // Compare new and old docs before updating state
            if (
              newDocs.length !== docsRef.current.length ||
              !newDocs.every((doc, i) => _.isEqual(doc, docsRef.current[i]))
            ) {
              docsRef.current = newDocs;

              setDocs(newDocs);
            }
          });

    return () => {
      unsubscribe();
    };
  }, [query]);
  return docs;
}

export type DocumentErrors =
  | "no-such-document"
  | "permission-denied"
  | "internal";

export type DocumentError = {
  error: DocumentErrors;
  message?: string;
  docId: string | undefined;
};

export function useStreamDocumentTo<
  AppModelType,
  DbModelType extends DocumentData,
>(
  docRef: DocumentReference<AppModelType, DbModelType> | undefined,

  setRes: (
    value: Loadable<DocumentSnapshot<AppModelType, DbModelType>, DocumentError>
  ) => void
) {
  useEffect(() => {
    if (!docRef) {
      setRes({
        status: "error",
        value: undefined,
        error: "no-such-document",
        message: "No such document",
        docId: undefined,
      });
      return;
    }

    return onSnapshot(
      docRef,
      (doc) => {
        if (!doc.exists()) {
          setRes({
            status: "error",
            value: undefined,
            error: "no-such-document",
            message: "No such document",
            docId: docRef.id,
          });
        } else {
          setRes({
            status: "loaded",
            value: doc,
          });
        }
      },

      (error) => {
        console.log("Failed to get document", docRef.id, error);

        const isPermissionDenied = error?.code === "permission-denied";
        setRes({
          status: "error",
          value: undefined,
          error: isPermissionDenied ? "permission-denied" : "internal",
          docId: docRef.id,
        });
      }
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docRef]);
}

export function useDocumentRefDedup<
  AppModelType,
  DbModelType extends DocumentData,
>(ref: DocumentReference<AppModelType, DbModelType> | undefined) {
  const currentRef = useRef(ref);
  if (currentRef.current?.path !== ref?.path) {
    currentRef.current = ref;
  }
  return currentRef.current;
}

export function useStreamDocument<
  AppModelType,
  DbModelType extends DocumentData,
>(
  doc: DocumentReference<AppModelType, DbModelType> | undefined
): Loadable<DocumentSnapshot<AppModelType, DbModelType>, DocumentError> {
  const docDedup = useDocumentRefDedup(doc);

  const [res, setRes] = useState<
    Loadable<DocumentSnapshot<AppModelType, DbModelType>, DocumentError>
  >(
    doc
      ? { status: "loading", value: undefined }
      : {
          status: "error",
          value: undefined,
          error: "no-such-document",
          message: "No such document",
          docId: undefined,
        }
  );

  useStreamDocumentTo(docDedup, setRes);
  return res;
}

export function useStreamDocumentById<
  AppModelType,
  DbModelType extends DocumentData,
>(
  collection: CollectionReference<AppModelType, DbModelType> | undefined,

  id: string | undefined
) {
  return useStreamDocument(
    useMemo(
      () => (collection && id ? doc(collection, id) : undefined),
      [collection, id]
    )
  );
}

// App specific hooks

export function useIsAdmin() {
  const { currentUser } = useAuth();
  return useStreamDocumentById(
    collection(db, DbCollections.permissions),
    currentUser?.uid
  ).value?.data()?.isAdmin ?? false;
}

// Hook to fetch installments and stripe checkout sessions for multiple participants
export function useParticipantInstallments(participants: QueryDocumentSnapshot<DbCampParticipant, DbCampParticipant>[]) {
  const [installmentsData, setInstallmentsData] = useState<Map<string, {
    installments: QueryDocumentSnapshot<DbCampParticipantInstallment, DbCampParticipantInstallment>[];
    stripeSessions: QueryDocumentSnapshot<DbStripeCheckoutSession, DbStripeCheckoutSession>[];
  }>>(new Map());

  useEffect(() => {
    if (participants.length === 0) {
      setInstallmentsData(new Map());
      return;
    }

    const unsubscribes: (() => void)[] = [];
    const newInstallmentsData = new Map<string, {
      installments: QueryDocumentSnapshot<DbCampParticipantInstallment, DbCampParticipantInstallment>[];
      stripeSessions: QueryDocumentSnapshot<DbStripeCheckoutSession, DbStripeCheckoutSession>[];
    }>();

    participants.forEach(participantDoc => {
      const participantId = participantDoc.id;
      newInstallmentsData.set(participantId, { installments: [], stripeSessions: [] });

      // Subscribe to installments subcollection
      const installmentsRef = collection(db, DbCollections.campParticipants, participantId, DbCollections.installments);
      const installmentsQuery = queryT(installmentsRef, orderByT('createdAt', 'desc'));
      const installmentsUnsubscribe = onSnapshot(installmentsQuery, (snapshot) => {
        setInstallmentsData(prev => {
          const updated = new Map(prev);
          const current = updated.get(participantId) || { installments: [], stripeSessions: [] };
          updated.set(participantId, { ...current, installments: snapshot.docs as QueryDocumentSnapshot<DbCampParticipantInstallment, DbCampParticipantInstallment>[] });
          return updated;
        });
      });
      unsubscribes.push(installmentsUnsubscribe);

      // Subscribe to stripe checkout sessions for this participant
      const stripeSessionsRef = collection(db, DbCollections.stripeCheckoutSessions);
      const stripeSessionsQuery = queryT(
        stripeSessionsRef,
        whereT('userId', '==', participantDoc.data().userId),
        whereT('campId', '==', participantDoc.data().campId),
        orderByT('createdAt', 'desc')
      );
      const stripeSessionsUnsubscribe = onSnapshot(stripeSessionsQuery, (snapshot) => {
        setInstallmentsData(prev => {
          const updated = new Map(prev);
          const current = updated.get(participantId) || { installments: [], stripeSessions: [] };
          updated.set(participantId, { ...current, stripeSessions: snapshot.docs as QueryDocumentSnapshot<DbStripeCheckoutSession, DbStripeCheckoutSession>[] });
          return updated;
        });
      });
      unsubscribes.push(stripeSessionsUnsubscribe);
    });

    return () => {
      unsubscribes.forEach(unsubscribe => unsubscribe());
    };
  }, [participants]);

  return installmentsData;
}
