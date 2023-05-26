import { AgentPubKey, AppAgentClient, AppSignal, RoleName, EntryHash, EntryHashB64, Record as HolochainRecord, encodeHashToBase64 } from '@holochain/client';
import { derived, writable, Writable } from 'svelte/store';
import { rxWritable } from 'svelte-fuse-rx';
import {
  of, from, filter, shareReplay, scan, map, merge, mergeMap, mergeScan, concatMap, mergeWith, groupBy, takeUntil,
  Subject, Observable, GroupedObservable, ObservableInput,
  tap,
  Observer,
} from 'rxjs';
import { produce } from 'immer';
import type { SignalPayload } from './signal';
import { createContext } from '@lit-labs/context';

import { SensemakerService } from './sensemakerService';
import {
  AppletConfig, AppletUIConfig,
  Assessment, AssessmentEh, CulturalContext, ContextEh, Dimension, DimensionEh, Method, MethodEh, ResourceDef, ResourceDefEh, ResourceEh,
  ComputeContextInput, CreateAppletConfigInput, CreateAssessmentInput, GetAssessmentsForResourceInput, RunMethodInput,
} from './index';
import type { Option } from './utils';

// API output types

export interface ContextResults {
  [culturalContextName: string]: ResourceEh[],
}

// API input types

export interface assessmentsFilterOpts {
  resourceEhs?: ResourceEh[]
  dimensionEhs?: DimensionEh[]
}

// external `SensemakerStore` API interface for `Assessment` observables

type StoreObservable<T> = Writable<T> & Subject<T> & Observable<T>

export type DimensionIndexedResult = Map<DimensionEh, Assessment>
export type ResourceIndexedResult = Map<ResourceEh, Assessment>
export type DimensionIndexedResults = Map<DimensionEh, Set<Assessment>>
export type ResourceIndexedResults = Map<ResourceEh, Set<Assessment>>

export type ResourceAssessmentsObservable = StoreObservable<DimensionIndexedResults>
export type AssessmentDimensionsObservable = StoreObservable<ResourceIndexedResults>

export type AssessmentObservable = StoreObservable<Assessment>

export type AssessmentSetObservable = StoreObservable<Set<Assessment>>  // :TODO: replace with `*IndexedResults`

// The main reason for indexing data this way would be to
// allow quick mapping between it and the the view, which has
// * `resource_def_eh`,
// * `resource_eh`,
// * a Resource,
// * `dimension_eh`s for each objective assessment,
// However, there are other ways of indexing these where
// secondary indices are used instead of a nested object
//
// :TODO: do we want the leafmost `Assessment` Set split out into subjective/objective?
//
export type IndexedSensemakerData = Map<ResourceEh, DimensionIndexedResults>

export type IndexedAssessmentsObservable = StoreObservable<IndexedSensemakerData>

// internal types

type IndexedAssessments = Record<EntryHashB64, Assessment>

// `Assessment` stream filtering helpers

const resourceID = (a: Assessment) => a.resource_eh,
  dimensionID = (a: Assessment) => a.dimension_eh,
  isResource = (resourceEh: ResourceEh) => (a: Assessment) => resourceID(a) === resourceEh,
  isDimension = (dimensionEh: DimensionEh) => (a: Assessment) => dimensionID(a) === dimensionEh,
  isResAndDim = (resourceEh: ResourceEh, dimensionEh: DimensionEh) => (a: Assessment) => dimensionEh === dimensionID(a) && resourceEh === resourceID(a),
  isResAndDims = (resourceEh: ResourceEh, dimensionEhs: DimensionEh[]) => (a: Assessment) => resourceEh === resourceID(a) && -1 !== dimensionEhs.indexOf(dimensionID(a)),
  isDimAndResources = (dimensionEh: DimensionEh, resourceEhs: ResourceEh[]) => (a: Assessment) => dimensionEh === dimensionID(a) && -1 !== resourceEhs.indexOf(resourceID(a))

export const forResource = (resourceEh: ResourceEh) => (assessments: AssessmentObservable) =>
  assessments.pipe(filter(isResource(resourceEh))) as AssessmentObservable

export const forDimension = (dimensionEh: DimensionEh) => (assessments: AssessmentObservable) =>
  assessments.pipe(filter(isDimension(dimensionEh))) as AssessmentObservable

export const forResourceDimension = (resourceEh: ResourceEh, dimensionEh: DimensionEh) => (assessments: AssessmentObservable) =>
  assessments.pipe(filter(isResAndDim(resourceEh, dimensionEh))) as AssessmentObservable

export const forResourceDimensions = (resourceEh: ResourceEh, dimensionEhs: DimensionEh[]) => (assessments: AssessmentObservable) =>
  assessments.pipe(filter(isResAndDims(resourceEh, dimensionEhs))) as AssessmentObservable

export const forDimensionResources = (dimensionEh: DimensionEh, resourceEhs: ResourceEh[]) => (assessments: AssessmentObservable) =>
  assessments.pipe(filter(isDimAndResources(dimensionEh, resourceEhs))) as AssessmentObservable

/// Generic stream helper to continually return "latest" emitted value(s) as determined by a custom comparator function.
export function latestOf<T>(returnNewest: (latest: T | null, a: T) => T) {
  return function (things: Observable<T> & Writable<T> & Subject<T>) {
    return things.pipe(
      mergeScan((latest: T | null, a: T, i: number) => {
        return of(returnNewest(latest, a))
      }, null),
    ) as Observable<T> & Writable<T> & Subject<T>
  }
}

/// Helper to fallthrough the most recent `Assessment` from a pair.
function getNewerAssessment(latest: Assessment | null, a: Assessment): Assessment {
  return (!latest || latest.timestamp < a.timestamp) ? a : latest
}

/// Helper to merge indexed data from `GroupedObservable` of `Assessments` to output streams
function newestGroupedAssessments(dims: IndexedAssessments, a: IndexedAssessments, i: number) {
  Object.keys(a).forEach(dH => dims[dH] = getNewerAssessment(dims[dH], a[dH]))
  return of(dims)
}

/// Batches all `Assessments` from the input stream (or group of streams) and discards all but the one with the most recent timestamp.
export const mostRecentAssessment: (as: AssessmentObservable) => AssessmentObservable = latestOf<Assessment>(getNewerAssessment)

// `map`ping helper to unpack `GroupedObservables` into keyed `Record` structs
function unpackRecord<S, T>(g: GroupedObservable<S, T>) {
  return function unpacker(a: T) {
    return { [g.key as any]: a } as Record<any, T>
  }
}

/// Flatten a `GroupedObservable` output from a `groupBy` operation into a `Record` collected from all streams in the group.
/// The returned `Record` is indexed by whatever `key` the group was first separated by.
export function mergeGroup<S, T>(reducer: (dims: Record<any, T>, a: Record<any, T>, i: number) => ObservableInput<Record<any, T>>, init: Record<any, T>) {
  return function(group: Observable<GroupedObservable<S, T>>) {
    return rxWritable(undefined).pipe(
      mergeWith(group),
      mergeMap((g: GroupedObservable<S, T>) => g.pipe(map(unpackRecord<S, T>(g)))),
      mergeScan(reducer, init),
      shareReplay(1),
    )
  }
}

/// Collect all `Assessments` emitted by the input stream into a persistently cached `Set`, and emit only the most recently updated collection.
export const asSet = (as: AssessmentObservable) =>
  as.pipe(
    scan((set, a) => produce(set, draft => draft.add(a)), new Set<Assessment>()),
    shareReplay(1),
  ) as AssessmentSetObservable

// Store structure and zome API service bindings

export class SensemakerStore {
  // unsubscribe stream to close all listeners
  _destroy = new Subject()

  // store any value here that would benefit from being a store
  // like cultural context entry hash and then the context result vec

  _appletConfig: Writable<AppletConfig> = writable({ dimensions: {}, resource_defs: {}, methods: {}, cultural_contexts: {}, name: "", role_name: "", ranges: {} });
  _contextResults: Writable<ContextResults> = writable({});

  // TODO: we probably want there to be a default Applet UI Config, specified in the applet config or somewhere.
  _appletUIConfig: Writable<AppletUIConfig> = writable({});
  /*
  {
    [resourceDefEh: string]: {
      display_objective_dimension: EntryHash, // the dimension eh
      create_assessment_dimension: EntryHash, // the dimension eh
    }
  }
  */

  /** Static info */
  protected service?: SensemakerService;

  /**
   * raw unfiltered input/inbound `Observable` source emitting all `Assessment`
   * records as they are loaded from zome API calls, peer signals or other I/O
   */
  protected _assessments$: Observable<Assessment>
  protected _loadAssessment?: Observer<Assessment>

  /**
   * cached data structure pre-organising all loaded `Assessment` data for
   * efficiently piping through output streams
   */
  protected _allAssessments$: Observable<IndexedSensemakerData>
  // externally-facing Svelte-compatible interface to `_allAssessments$`
  protected _allAssessmentsBound$: IndexedAssessmentsObservable

  constructor(
    public client: AppAgentClient | null,
    public roleName: RoleName,
    public zomeName = 'sensemaker',
  ) {
    // Bind Holochain websocket signal callbacks to provided `client`.
    // To initialise or redefine client after instantiation, call
    // `bindSocketClient` and `setService` manually.
    if (client) {
      this.bindSocketClient(client)
      this.setService(new SensemakerService(client, roleName))
    }

    // Bind a raw source Observable that emits each newly loaded
    // `Assessment` once. Does not cache.
    this._assessments$ = new Observable(observer => {
      this._loadAssessment = observer
    })

    // Configure a processing pipeline to cache all previously loaded
    // `Assessment` entries.
    this._allAssessments$ = this._assessments$.pipe(
      // disconnect all listeners upon unmounting
      takeUntil(this._destroy),
      // continually emit newly merged data structure as `Assessments` come in
      mergeScan<Assessment, IndexedSensemakerData>((acc, value) =>
        of(produce(acc, draft => {
          const r = value.resource_eh
          const d = value.dimension_eh
          const subslice = draft.get(r) || new Map()
          subslice.set(d, value)
          draft.set(r, subslice)
        })),
        new Map(),
      ),
      // cache only the most recently emitted value
      shareReplay(1),
    )

    this._allAssessmentsBound$ = rxWritable(undefined).subscribe(this._allAssessments$)
  }

  setService(s: SensemakerService) {
    this.service = s
  }

  bindSocketClient(client: AppAgentClient) {
    client.on("signal", (signal: AppSignal) => {
      if (!this._loadAssessment) throw new Error("SensemakerStore not yet initialised! Please defer execution until next eventloop tick.")

      console.log("received signal in sensemaker store: ", signal)
      const payload = (signal.payload as SignalPayload);

      switch (payload.type) {
        case "NewAssessment":
          this._loadAssessment.next(payload.assessment)
          break;
      }
    })
  }

  /**
   * High-level API method for retrieving and filtering raw `Assessment` data from the Sensemaker backend
   */
  resourceAssessments(opts?: assessmentsFilterOpts): IndexedAssessmentsObservable {
    // if no filtering parameters provided, return the cached mapping of all Assessments
    if (!opts || !(opts.resourceEhs || opts.dimensionEhs)) {
      return this._allAssessmentsBound$
    }

    const rs = opts.resourceEhs
    const ds = opts.dimensionEhs

    const result = this._allAssessments$.pipe(
      concatMap((value) => {
        const resourcesFiltered: DimensionIndexedResults[] = rs
          ? [...rs.reduce((acc, h) => {
              value.get(h) || new Map()
              return acc
            }, new Map()).values()]
          : [...value.values()]

        const dimsFiltered: Assessment[] = ds
          ? resourcesFiltered.flatMap(dims => [...dims.entries()].flatMap(([h, As]) => ds?.includes(h) ? [...As] : []))
          : resourcesFiltered.flatMap(dims => [...dims.values()].flatMap(As => [...As]))

        return from(dimsFiltered)
      }),
      // :TODO: only emit the above cached Assessments once, then unsubscribe from it and only receive from below?
      mergeWith(this._assessments$.pipe(
        filter(a => (!ds || ds.includes(a.dimension_eh)) && (!rs || rs.includes(a.resource_eh)))
      )),
    )

    return rxWritable(undefined).subscribe(result)
  }

  /// Accessor method to observe all known `Assessments` for the given `resourceEh`
  ///
  assessmentsForResource(resourceEh: ResourceEh): AssessmentSetObservable {
    return asSet(forResource(resourceEh)(this._resourceAssessments))
  }

  /// Accessor method to observe all known `Assessments` for the given `resourceEh` along the given `dimensionEh`s
  ///
  assessmentsForResourceDimensions(resourceEh: ResourceEh, dimensionEhs: DimensionEh[]): AssessmentSetObservable {
    return asSet(forResourceDimensions(resourceEh, dimensionEhs)(this._resourceAssessments))
  }

  /// Accessor method to observe all known `Assessments` for the given `resourceEh` along the given `dimensionEh`
  ///
  assessmentsForResourceDimension(resourceEh: ResourceEh, dimensionEh: DimensionEh): AssessmentSetObservable {
    return asSet(forResourceDimension(resourceEh, dimensionEh)(this._resourceAssessments))
  }

  /// Accessor method to observe the *latest* `Assessment` for a given `resourceEh`, ranked within `dimensionEh`
  ///
  latestAssessmentOf(resourceEh: ResourceEh, dimensionEh: DimensionEh): AssessmentObservable {
    return mostRecentAssessment(forResourceDimension(resourceEh, dimensionEh)(this._resourceAssessments))
  }

  /// Accessor method to observe the *latest* `Assessment`s for a given `resourceEh`, ranked within all specified `dimensionEh`s
  ///
  latestAssessmentsOfDimensions(resourceEh: ResourceEh, dimensionEhs: DimensionEh[]): AssessmentDimensionsObservable {
    return mergeGroup<EntryHashB64, Assessment>(newestGroupedAssessments, {})(
      forResourceDimensions(resourceEh, dimensionEhs)(this._resourceAssessments).pipe(groupBy(dimensionID))
    )
  }

  /// Accessor method to observe all known `Assessment`s for a given `dimensionEh`
  ///
  assessmentsForDimension(dimensionEh: DimensionEh): AssessmentSetObservable {
    return asSet(forDimension(dimensionEh)(this._resourceAssessments))
  }

  /// Accessor method to observe all known `Assessment`s ranked within the given `dimensionEh` for any provided `resourceEh`s
  ///
  assessmentsForResourcesInDimension(dimensionEh: DimensionEh, resourceEhs: ResourceEh[]): AssessmentSetObservable {
    return asSet(forDimensionResources(dimensionEh, resourceEhs)(this._resourceAssessments))
  }

  /// Accessor method to observe the *latest* `Assessment`s ranked within the given `dimensionEh` for any provided `resourceEh`s
  ///
  latestAssessmentsForResourcesInDimension(dimensionEh: DimensionEh, resourceEhs: ResourceEh[]): ResourceAssessmentsObservable {
    return mergeGroup<EntryHashB64, Assessment>(newestGroupedAssessments, {})(
      forDimensionResources(dimensionEh, resourceEhs)(this._resourceAssessments).pipe(groupBy(resourceID))
    )
  }

  appletConfig() {
    return derived(this._appletConfig, appletConfig => appletConfig)
  }

  contextResults() {
    return derived(this._contextResults, contextResults => contextResults)
  }

  appletUIConfig() {
    return derived(this._appletUIConfig, appletUIConfig => appletUIConfig)
  }

  async getAllAgents() {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    return await this.service.getAllAgents();
  }
  async createDimension(dimension: Dimension): Promise<DimensionEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const dimensionEh = await this.service.createDimension(dimension);
    this._appletConfig.update(appletConfig => produce(appletConfig, draft => {
      draft.dimensions[dimension.name] = dimensionEh
    }));
    return dimensionEh;
  }

  async createResourceDef(resourceDef: ResourceDef): Promise<ResourceDefEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const resourceDefEh = await this.service.createResourceDef(resourceDef);
    this._appletConfig.update(appletConfig => produce(appletConfig, draft => {
      draft.resource_defs[resourceDef.name] = resourceDefEh
    }));
    return resourceDefEh;
  }

  async createAssessment(assessment: CreateAssessmentInput): Promise<AssessmentEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const assessmentEh = await this.service.createAssessment(assessment)

    // TODO: here is an instance where returning the assessment instead of the hash would be useful
    // NOTE: there is currently a slight discrepancy between the assessment returned from the service and the one stored in the store
    // because we are not returning the assessment, and so recreating the timestamp. This works enough for now, but would be worth it to change
    // it to use optimistic updates such that a draft assessment can be propagated earlier and updated upon completion of the `createAssessment` API call.
    this.syncNewAssessments([{ ...assessment, author: encodeHashToBase64(this.service.myPubKey()), timestamp: Date.now() * 1000 }])

    return assessmentEh
  }

  async getAssessment(assessmentEh: AssessmentEh): Promise<Assessment> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const assessment = await this.service.getAssessment(assessmentEh)

    this.syncNewAssessments([assessment])

    return assessment
  }

  async loadAssessmentsForResources(getAssessmentsInput: GetAssessmentsForResourceInput): Promise<Assessment[]> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const result = await this.service.getAssessmentsForResources(getAssessmentsInput);

    this.syncNewAssessments(result)

    return result;
  }

  protected syncNewAssessments(assessments: Assessment[]) {
    if (!this._loadAssessment) throw new Error("SensemakerStore not yet initialised! Please defer new Assessment syncing until next eventloop tick.")
    assessments.forEach(this._loadAssessment.next.bind(this._loadAssessment))
  }

  async createMethod(method: Method): Promise<MethodEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const methodEh = await this.service.createMethod(method);
    this._appletConfig.update(appletConfig => produce(appletConfig, draft => {
      draft.methods[method.name] = methodEh
    }));
    return methodEh;
  }

  async runMethod(runMethodInput: RunMethodInput): Promise<Assessment> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const assessment = await this.service.runMethod(runMethodInput);

    this.syncNewAssessments([assessment])

    return assessment
  }

  async createCulturalContext(culturalContext: CulturalContext): Promise<ContextEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const contextEh = await this.service.createCulturalContext(culturalContext);
    this._appletConfig.update(appletConfig => produce(appletConfig, draft => {
      draft.cultural_contexts[culturalContext.name] = contextEh
    }));
    return contextEh;
  }

  async getCulturalContext(culturalContextEh: ContextEh): Promise<HolochainRecord> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    return await this.service.getCulturalContext(culturalContextEh)
  }

  async computeContext(contextName: string, computeContextInput: ComputeContextInput): Promise<Array<ResourceEh>> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const contextResult = await this.service.computeContext(computeContextInput);
    this._contextResults.update(contextResults => {
      contextResults[contextName] = contextResult;
      return contextResults;
    });
    return contextResult;
  }

  async loadAppletConfig(appletName: string): Promise<Option<AppletConfig>> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const maybeAppletConfig = await this.service.loadAppletConfig(appletName);
    if (maybeAppletConfig) {
      this._appletConfig.update(() => maybeAppletConfig)
    }
    return maybeAppletConfig;
  }

  async registerApplet(appletConfigInput: CreateAppletConfigInput): Promise<AppletConfig> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const appletConfig = await this.service.registerApplet(appletConfigInput);
    this._appletConfig.update(() => appletConfig);
    return appletConfig;
  }

  async updateAppletUIConfig(
    resourceDefEh: ResourceDefEh,
    currentObjectiveDimensionEh: DimensionEh,
    currentCreateAssessmentDimensionEh: DimensionEh,
    currentMethodEh: MethodEh,
  ) {
    this._appletUIConfig.update(appletUIConfig => produce(appletUIConfig, draft => {
      draft[resourceDefEh] = {
        display_objective_dimension: currentObjectiveDimensionEh,
        create_assessment_dimension: currentCreateAssessmentDimensionEh,
        method_for_created_assessment: currentMethodEh
      }
    }))
  }

  // close all active streams, ending any straggling UI or dependant framework subscribers
  // :TODO: this should be called when `sensemakerStoreContext` is released.
  unmount() {
    this._destroy.next(1)
  }
}

export const sensemakerStoreContext = createContext<SensemakerStore>(
  'sensemaker-store-context'
);
