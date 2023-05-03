import { AgentPubKey, decodeHashFromBase64, encodeHashToBase64, EntryHash, EntryHashB64, Record as HolochainRecord } from '@holochain/client';
import { derived, writable, Writable } from 'svelte/store';
import { rxReplayableWritable as rxWritable } from 'svelte-fuse-rx';
import { mergeWith, filter, map, concatMap, from, groupBy, of, share, shareReplay, scan, tap, Subject, Observable, takeUntil, takeLast } from 'rxjs';
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
  resourceEhs: string[]
  dimensionEhs: string[]
}

// TypeScript interface

export type AssessmentObservable = Writable<Assessment> & Subject<Assessment> & Observable<Assessment>

export type AssessmentSetObservable = Writable<Set<Assessment>> & Subject<Set<Assessment>> & Observable<Set<Assessment>>

// `Assessment` stream filtering helpers

export const asSet = (as: AssessmentObservable) =>
  as.pipe(
    scan((set, a) => produce(set, draft => draft.add(a)), new Set<Assessment>()),
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

export const latestOf = (assessments: AssessmentObservable): SingleAssessmentObservable => {
  return assessments.pipe(map((as: Set<Assessment>) =>
    Array.from(as.values()).sort((a, b) => {
      if (a.timestamp === b.timestamp) return 0
      return a.timestamp < b.timestamp ? -1 : 1
    }).pop() as Assessment
  )) as SingleAssessmentObservable
}
*/

// Store structure and zome API service bindings

export class SensemakerStore {
  // unsubscribe stream to close all listeners
  // :TODO: `_destroy.next()` should be called when Sensemaker context UI
  // control is unmounted.
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
    this.myAgentPubKey = service.myPubKey();
  }

  /**
   * High-level API method for retrieving and filtering raw `Assessment` data from the Sensemaker backend
   */
  resourceAssessments(opts?: assessmentsFilterOpts): AssessmentSetObservable {
    // if no filtering parameters provided, return a merged stream of all Assessments for all ResourceEhs
    // if (!opts || !(opts.resourceEhs || opts.dimensionEhs)) {
      // return this.allResourceAssessments()

    return asSet(this._resourceAssessments)
  }
    // }
/*
    let result

    // start by filtering to relevant Resource/s; via different (sub)set of merged streams
    if (opts.resourceEhs) {
      const streams: AssessmentObservable[] = []
      for (let [k, stream] of this._resourceAssessments.entries()) {
        if (opts.resourceEhs.includes(k)) {
          streams.push(stream)
        }
      }
      result = rxWritable(new Set()).pipe(merge(...streams))
    } else {
      result = this.allResourceAssessments()
    }

    // filter relevant Dimension/s sub-slice if specified
    if (opts.dimensionEhs) {
      result = result.pipe(filter((a: Assessment) => opts.dimensionEhs.includes(encodeHashToBase64(a.dimension_eh))))
    }

    return result
  }

  /// Accessor method to observe all known `Assessments` for the given `resourceEh`
  ///
  assessmentsForResource(resourceEh: EntryHashB64): AssessmentObservable {
    return this._resourceAssessments.get(resourceEh) || rxWritable(new Set())
  }

  /// Accessor method to observe all known `Assessments` for the given `resourceEh` along the given `dimensionEh`
  ///
  assessmentsForResourceDimension(resourceEh: EntryHashB64, dimensionEh: EntryHashB64): AssessmentObservable {
    return dimensionOf(dimensionEh, this.assessmentsForResource(resourceEh))
  }

  /// Accessor method to observe the *latest* `Assessment` for a given `resourceEh`, ranked within `dimensionEh`
  ///
  latestAssessmentOf(resourceEh: EntryHashB64, dimensionEh: EntryHashB64): AssessmentObservable {
    return latestOf(this.assessmentsForResourceDimension(resourceEh, dimensionEh))
  }
  */

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
}

export const sensemakerStoreContext = createContext<SensemakerStore>(
  'sensemaker-store-context'
);
