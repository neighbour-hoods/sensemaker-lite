import { AgentPubKey, decodeHashFromBase64, encodeHashToBase64, EntryHash, EntryHashB64, Record as HolochainRecord, Timestamp } from '@holochain/client';
import { derived, writable, Writable } from 'svelte/store';
import { rxReplayableWritable as rxWritable } from 'svelte-fuse-rx';
import { of, filter, shareReplay, scan, map, mergeMap, mergeScan, groupBy, takeUntil, withLatestFrom, Subject, Observable, GroupedObservable, tap } from 'rxjs';
import { produce } from 'immer';
import { createContext } from '@lit-labs/context';

import { SensemakerService, ResourceAssessmentsResponse } from './sensemakerService';
import { AppletConfig, AppletConfigInput, AppletUIConfig, Assessment, ComputeContextInput, CreateAppletConfigInput, CreateAssessmentInput, CulturalContext, Dimension, DimensionEh, GetAssessmentsForResourceInput, Method, ResourceDef, ResourceDefEh, ResourceEh, RunMethodInput } from './index';
import { Option } from './utils';

// zome API output types

export interface ContextResults {
  [culturalContextName: string]: EntryHash[],
}

export type ResourceAssessmentResults = Map<EntryHashB64, Set<Assessment>>

// SensemakerStore API inputs

export interface assessmentsFilterOpts {
  resourceEhs?: string[]
  dimensionEhs?: string[]
}

// TypeScript interface

export type StoreObservable<T> = Writable<T> & Subject<T> & Observable<T>

export type AssessmentObservable = StoreObservable<Assessment>

export type AssessmentSetObservable = StoreObservable<Set<Assessment>>

export type AssessmentDimensionsObservable = StoreObservable<Record<EntryHashB64, Assessment>>

// `Assessment` stream filtering helpers

export const asSet = (as: AssessmentObservable) =>
  as.pipe(
    scan((set, a) => produce(set, draft => draft.add(a)), new Set<Assessment>()),
    shareReplay(1),
  ) as AssessmentSetObservable

/*
export const dimensionOf = (dimensionEh: EntryHashB64, assessments: AssessmentObservable): AssessmentObservable => {
  return assessments.pipe(map((as: Set<Assessment>) =>
    produce(as, draft => {
      as.forEach(a => {
        if (encodeHashToBase64(a.dimension_eh) !== dimensionEh) {
          draft.delete(a)
        }
      })
    })
  )) as AssessmentObservable
}

export const groupDimensionsOf = (assessments: AssessmentObservable) => {
  return assessments.pipe(concatMap((as) => from(as)))
    .pipe(groupBy(a => encodeHashToBase64(a.dimension_eh)))
}
*/

export function latestOf<T>(returnNewest: (latest: T | null, a: T) => T) {
  return function (things: Observable<T> & Writable<T> & Subject<T>) {
    return things.pipe(
      mergeScan((latest: T | null, a: T, i: number) => {
        return of(returnNewest(latest, a))
      }, null),
    ) as Observable<T> & Writable<T> & Subject<T>
  }
}

function getNewerAssessment(latest: Assessment | null, a: Assessment): Assessment {
  return (!latest || latest.timestamp < a.timestamp) ? a : latest
}

export const mostRecentAssessment: (as: AssessmentObservable) => AssessmentObservable = latestOf<Assessment>(getNewerAssessment)

export const forResource = (resourceEh: string) => (assessments: AssessmentObservable) =>
  assessments.pipe(
    filter(a => resourceEh === encodeHashToBase64(a.resource_eh)),
  ) as AssessmentObservable

export const forResourceDimension = (resourceEh: string, dimensionEh: string) => (assessments: AssessmentObservable) =>
  assessments.pipe(
    filter(a => resourceEh === encodeHashToBase64(a.resource_eh) && dimensionEh === encodeHashToBase64(a.dimension_eh)),
  ) as AssessmentObservable

export const forResourceDimensions = (resourceEh: string, dimensionEhs: string[]) => (assessments: AssessmentObservable) =>
  assessments.pipe(
    filter(a => resourceEh === encodeHashToBase64(a.resource_eh) && -1 !== dimensionEhs.indexOf(encodeHashToBase64(a.dimension_eh))),
  ) as AssessmentObservable

// Store structure and zome API service bindings

export class SensemakerStore {
  // unsubscribe stream to close all listeners
  _destroy = new Subject()

  // store any value here that would benefit from being a store
  // like cultural context entry hash and then the context result vec

  _appletConfig: Writable<AppletConfig> = writable({ dimensions: {}, resource_defs: {}, methods: {}, cultural_contexts: {}, name: "", role_name: "", ranges: {} });
  _contextResults: Writable<ContextResults> = writable({});

  // Raw, unfiltered "source of truth" `Assessment` stream as `ReplaySubject`
  // fed by asynchronous calls to zome APIs
  _resourceAssessments: AssessmentObservable = rxWritable(undefined).pipe(
    takeUntil(this._destroy),
  )

  _allResourceAssessments: AssessmentSetObservable

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
  public myAgentPubKey: AgentPubKey;

  constructor(
    protected service: SensemakerService,
  ) {
    this._allResourceAssessments = asSet(this._resourceAssessments)

    this.myAgentPubKey = service.myPubKey();
  }

  /**
   * High-level API method for retrieving and filtering raw `Assessment` data from the Sensemaker backend
   */
  resourceAssessments(opts?: assessmentsFilterOpts): AssessmentSetObservable {
    // if no filtering parameters provided, return a merged Set of all Assessments
    if (!opts || !(opts.resourceEhs || opts.dimensionEhs)) {
      return this._allResourceAssessments
    }

    let result = this._resourceAssessments

    if (opts.resourceEhs) {
      const matches = opts.resourceEhs
      result = result.pipe(
        filter(a => matches.indexOf(encodeHashToBase64(a.resource_eh)) !== -1),
      ) as AssessmentObservable
    }
    if (opts.dimensionEhs) {
      const matches = opts.dimensionEhs
      result = result.pipe(
        filter(a => matches.indexOf(encodeHashToBase64(a.dimension_eh)) !== -1),
      ) as AssessmentObservable
    }

    return asSet(result)
  }

  /// Accessor method to observe all known `Assessments` for the given `resourceEh`
  ///
  assessmentsForResource(resourceEh: EntryHashB64): AssessmentSetObservable {
    return asSet(forResource(resourceEh)(this._resourceAssessments))
  }

  /// Accessor method to observe all known `Assessments` for the given `resourceEh` along the given `dimensionEh`s
  ///
  assessmentsForResourceDimensions(resourceEh: EntryHashB64, dimensionEhs: EntryHashB64[]): AssessmentSetObservable {
    return asSet(forResourceDimensions(resourceEh, dimensionEhs)(this._resourceAssessments))
  }

  /// Accessor method to observe all known `Assessments` for the given `resourceEh` along the given `dimensionEh`
  ///
  assessmentsForResourceDimension(resourceEh: EntryHashB64, dimensionEh: EntryHashB64): AssessmentSetObservable {
    return asSet(forResourceDimension(resourceEh, dimensionEh)(this._resourceAssessments))
  }

  /// Accessor method to observe the *latest* `Assessment` for a given `resourceEh`, ranked within `dimensionEh`
  ///
  latestAssessmentOf(resourceEh: EntryHashB64, dimensionEh: EntryHashB64): AssessmentObservable {
    return mostRecentAssessment(forResourceDimension(resourceEh, dimensionEh)(this._resourceAssessments))
  }

  /// Accessor method to observe the *latest* `Assessment`s for a given `resourceEh`, ranked within all specified `dimensionEh`s
  ///
  latestAssessmentsOfDimensions(resourceEh: EntryHashB64, dimensionEhs: EntryHashB64[]): AssessmentDimensionsObservable {
    return forResourceDimensions(resourceEh, dimensionEhs)(this._resourceAssessments).pipe(
      groupBy((d: Assessment) => encodeHashToBase64(d.dimension_eh)),
      mergeMap((group: GroupedObservable<EntryHashB64, Assessment>) => group.pipe(
        map(g => ({ [group.key]: g }))
      )),
      mergeScan((dims: Record<EntryHashB64, Assessment>, a: Record<EntryHashB64, Assessment>, i: number) => {
        Object.keys(a).forEach(dH => dims[dH] = getNewerAssessment(dims[dH], a[dH]))
        return of(dims)
      }, {}),
      shareReplay(1),
    ) as AssessmentDimensionsObservable
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

  async createDimension(dimension: Dimension): Promise<EntryHash> {
    const dimensionEh = await this.service.createDimension(dimension);
    this._appletConfig.update(appletConfig => {
      appletConfig.dimensions[dimension.name] = dimensionEh;
      return appletConfig;
    });
    return dimensionEh;
  }

  async createResourceDef(resourceDef: ResourceDef): Promise<EntryHash> {
    const resourceDefEh = await this.service.createResourceDef(resourceDef);
    this._appletConfig.update(appletConfig => {
      appletConfig.resource_defs[resourceDef.name] = resourceDefEh;
      return appletConfig;
    });
    return resourceDefEh;
  }

  async createAssessment(assessment: CreateAssessmentInput): Promise<EntryHash> {
    const assessmentEh = await this.service.createAssessment(assessment)

    // TODO: here is an instance where returning the assessment instead of the hash would be useful
    // NOTE: there is currently a slight discrepancy between the assessment returned from the service and the one stored in the store
    // because we are not returning the assessment, and so recreating the timestamp. This works enough for now, but would be worth it to change
    // it to use optimistic updates such that a draft assessment can be propagated earlier and updated upon completion of the `createAssessment` API call.
    this.syncNewAssessments([{ ...assessment, author: this.myAgentPubKey, timestamp: Date.now() * 1000 }])

    return assessmentEh
  }

  async getAssessment(assessmentEh: EntryHash): Promise<Assessment> {
    const assessment = await this.service.getAssessment(assessmentEh)

    this.syncNewAssessments([assessment])

    return assessment
  }

  async loadAssessmentsForResources(getAssessmentsInput: GetAssessmentsForResourceInput): Promise<Assessment[]> {
    const result = await this.service.getAssessmentsForResources(getAssessmentsInput);

    this.syncNewAssessments(result)

    return result;
  }

  protected syncNewAssessments(assessments: Assessment[]) {
    assessments.forEach(this._resourceAssessments.next.bind(this._resourceAssessments))
  }

  async createMethod(method: Method): Promise<EntryHash> {
    const methodEh = await this.service.createMethod(method);
    this._appletConfig.update(appletConfig => {
      appletConfig.methods[method.name] = methodEh;
      return appletConfig;
    });
    return methodEh;
  }

  async runMethod(runMethodInput: RunMethodInput): Promise<Assessment> {
    const assessment = await this.service.runMethod(runMethodInput);

    this.syncNewAssessments([assessment])

    return assessment
  }

  async createCulturalContext(culturalContext: CulturalContext): Promise<EntryHash> {
    const contextEh = await this.service.createCulturalContext(culturalContext);
    this._appletConfig.update(appletConfig => {
      appletConfig.cultural_contexts[culturalContext.name] = contextEh;
      return appletConfig;
    });
    return contextEh;
  }

  async getCulturalContext(culturalContextEh: EntryHash): Promise<HolochainRecord> {
    return await this.service.getCulturalContext(culturalContextEh)
  }

  async computeContext(contextName: string, computeContextInput: ComputeContextInput): Promise<Array<EntryHash>> {
    const contextResult = await this.service.computeContext(computeContextInput);
    this._contextResults.update(contextResults => {
      contextResults[contextName] = contextResult;
      return contextResults;
    });
    return contextResult;
  }

  async checkIfAppletConfigExists(appletName: string): Promise<Option<AppletConfig>> {
    const maybeAppletConfig = await this.service.checkIfAppletConfigExists(appletName);
    if (maybeAppletConfig) {
      this._appletConfig.update(() => maybeAppletConfig)
    }
    return maybeAppletConfig;
  }

  async registerApplet(appletConfigInput: CreateAppletConfigInput): Promise<AppletConfig> {
    const appletConfig = await this.service.registerApplet(appletConfigInput);
    this._appletConfig.update(() => appletConfig);
    return appletConfig;
  }

  async updateAppletUIConfig(
    resourceDefEh: EntryHashB64,
    currentObjectiveDimensionEh: EntryHash,
    currentCreateAssessmentDimensionEh: EntryHash,
    currentMethodEh: EntryHash
  ) {
    this._appletUIConfig.update(appletUIConfig => {
      appletUIConfig[resourceDefEh] = {
        display_objective_dimension: currentObjectiveDimensionEh,
        create_assessment_dimension: currentCreateAssessmentDimensionEh,
        method_for_created_assessment: currentMethodEh
      }
      return appletUIConfig;
    }
    )
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
