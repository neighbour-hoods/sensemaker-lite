import {
  AgentPubKey,
  AppAgentClient,
  AppSignal,
  encodeHashToBase64,
  decodeHashFromBase64,
  EntryHash,
  EntryHashB64,
  Record as HolochainRecord,
  RoleName
} from '@holochain/client';
import { SensemakerService } from './sensemakerService';
import {
  AppletConfig,
  AppletConfigInput,
  AppletUIConfig,
  Assessment,
  ComputeContextInput,
  CreateAppletConfigInput,
  CreateAssessmentInput,
  CulturalContext,
  Dimension,
  getAssessmentKey,
  getAssessmentKeyValues,
  GetAssessmentsForResourceInput,
  getAssessmentValue,
  getDimensionHash,
  getResourceHash,
  MapAssessmentsByHash,
  MapAssessmentsByHashByResource,
  Method,
  ResourceDef,
  ResourceDefEh, ResourceEh, DimensionEh, MethodEh, ContextEh, AssessmentEh,
  RunMethodInput,
  SignalPayload,
  VecAssessmentsByHash
} from './index';
import { derived, get, Writable, writable } from 'svelte/store';
import { Option } from './utils';
import { createContext } from '@lit-labs/context';

export interface assessmentsFilterOpts {
  resourceEhs?: EntryHashB64[] // :TODO: ResourceEh should be typed as B64 variant
  dimensionEhs?: EntryHashB64[] // :TODO: DimensionEh should be typed as B64 variant
}

interface ContextResults {
  [culturalContextName: string]: EntryHash[],
}

type AssessmentMap = Map<EntryHashB64, Assessment>;
type AssessmentIndex = Map<EntryHashB64, Set<Assessment>>;
// type EhAssessmentMap = Map<EntryHashB64, AssessmentMap>;

const constructAssessmentMap = (): AssessmentMap => new Map<EntryHashB64, Assessment>()
const constructAssessmentIndex = (): AssessmentIndex => new Map<EntryHashB64, Set<Assessment>>()
// const constructEhAssessmentMap = (): EhAssessmentMap => new Map<EntryHashB64, AssessmentMap>()

export class SensemakerStore {
  // store any value here that would benefit from being a store
  // like cultural context entry hash and then the context result vec

  _appletConfig: Writable<AppletConfig> = writable({ dimensions: {}, resource_defs: {}, methods: {}, cultural_contexts: {}, name: "", role_name: "", ranges: {} });
  _contextResults: Writable<ContextResults> = writable({});

  // TODO: update the structure of this store to include dimension and resource type
  /*
  {
    [resourceEh: string]: Array<Assessment>
  }
  */

  _allAssessments: AssessmentMap = constructAssessmentMap();
  _resourceIndex: AssessmentIndex = constructAssessmentIndex();

  _resourceAssessments: Writable<{ [entryHash: string]: Array<Assessment> }> = writable({});

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

  constructor(
    public client: AppAgentClient,
    public roleName: RoleName,
    public zomeName = 'sensemaker',
  ) {
    if (client) {
      client.on("signal", (signal: AppSignal) => {
        console.log("received signal in sensemaker store: ", signal)
        const payload = (signal.payload as SignalPayload);

        switch (payload.type) {
          case "NewAssessment":
            const assessmentMap = payload.assessment_map;
            this._updateAssessmentIndices(assessmentMap);
            break;
        }
      });

      this.setService(new SensemakerService(client, roleName))
    }
  }

  setService(s: SensemakerService) {
    this.service = s
  }

  _updateAssessmentIndices(assessmentMap: MapAssessmentsByHash) {
    // Iterate over input values
    for (let [eh, assessment] of getAssessmentKeyValues(assessmentMap)) {
      const resource_eh = getResourceHash(assessment);
      // const dimension_eh = getDimensionHash(assessment);
      /**
       * XXX: This assumes we don't ever update assessments.
       *      If that's not true, remove the conditional.
       */
      // If we have a new resource, add it. Otherwise, ignore it.
      if (!this._allAssessments.has(eh)) {
        this._allAssessments.set(eh, assessment);
        // Add assessment to resource index
        if (!this._resourceIndex.has(resource_eh)) {
          this._resourceIndex.set(resource_eh, new Set([assessment]));
        } else {
          this._resourceIndex.get(resource_eh)?.add(assessment);
        }
      }
    }

    this._resourceAssessments.update(resourceAssessments => {
      for (let [resource_eh, assessmentSet] of this._resourceIndex) {
        resourceAssessments[resource_eh] = Array.from(assessmentSet);
      }
      return resourceAssessments;
    })
  }

  _updateResourceAssessmentIndices(resourceAssessmentsMap: MapAssessmentsByHashByResource) {
    let resourceAssessmentsVec: VecAssessmentsByHash = {};

    for (let [resource_eh, assessmentMap] of Object.entries(resourceAssessmentsMap)) {
      resourceAssessmentsVec[resource_eh] = Object.values(assessmentMap)
      // Iterate over input values
      for (let [eh, assessment] of getAssessmentKeyValues(assessmentMap)) {
        /**
         * XXX: This assumes we don't ever update assessments.
         *      If that's not true, remove the conditional.
         */
        // If we have a new resource, add it. Otherwise, ignore it.
        if (!this._allAssessments.has(eh)) {
          this._allAssessments.set(eh, assessment);
          // Add assessment to resource index
          if (!this._resourceIndex.has(resource_eh)) {
            this._resourceIndex.set(resource_eh, new Set([assessment]));
          } else {
            this._resourceIndex.get(resource_eh)?.add(assessment);
          }
        }
      }
    }

    this._resourceAssessments.update(resourceAssessments => {
      for (let [resource_eh, assessmentSet] of this._resourceIndex) {
        resourceAssessments[resource_eh] = Array.from(assessmentSet);
      }
      return resourceAssessments;
    })

    return resourceAssessmentsVec;
  }

  // if provided a list of resource ehs, filter the assessments to only those resources, and return that object, otherwise return the whole thing.
  resourceAssessments(opts?: assessmentsFilterOpts) {
    return derived(this._resourceAssessments, resourceAssessments => {
      if (opts && opts.resourceEhs) {
        const filteredResourceAssessments = opts.resourceEhs.reduce((resourceSubsetAssessment, resource_eh) => {
          if (resourceAssessments.hasOwnProperty(resource_eh)) {
            resourceSubsetAssessment[resource_eh] = resourceAssessments[resource_eh];
          }
          return resourceSubsetAssessment;
        }, {});
        return filteredResourceAssessments;
      }
      else {
        return resourceAssessments;
      }
    })
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
    this._appletConfig.update(appletConfig => {
      appletConfig.dimensions[dimension.name] = dimensionEh;
      return appletConfig;
    });
    return dimensionEh;
  }

  async createResourceDef(resourceDef: ResourceDef): Promise<ResourceDefEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const resourceDefEh = await this.service.createResourceDef(resourceDef);
    this._appletConfig.update(appletConfig => {
      appletConfig.resource_defs[resourceDef.name] = resourceDefEh;
      return appletConfig;
    });
    return resourceDefEh;
  }

  async createAssessment(assessment: CreateAssessmentInput): Promise<AssessmentEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const assessmentMap = await this.service.createAssessment(assessment);
    this._updateAssessmentIndices(assessmentMap);
    return decodeHashFromBase64(getAssessmentKey(assessmentMap)!);
  }

  async getAssessment(assessmentEh: AssessmentEh): Promise<Assessment> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const assessment = await this.service.getAssessment(assessmentEh)
    this._updateAssessmentIndices({ [encodeHashToBase64(assessment.resource_eh)]: assessment })
    return assessment
  }

  async loadAssessmentsForResources(getAssessmentsInput: GetAssessmentsForResourceInput): Promise<VecAssessmentsByHash> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const resourceAssessments: MapAssessmentsByHashByResource = await this.service.getAssessmentsForResources(getAssessmentsInput);
    return this._updateResourceAssessmentIndices(resourceAssessments);
  }

  async createMethod(method: Method): Promise<MethodEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const methodEh = await this.service.createMethod(method);
    this._appletConfig.update(appletConfig => {
      appletConfig.methods[method.name] = methodEh;
      return appletConfig;
    });
    return methodEh;
  }

  async runMethod(runMethodInput: RunMethodInput): Promise<Assessment> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    let assessmentMap = await this.service.runMethod(runMethodInput);
    this._updateAssessmentIndices(assessmentMap);
    return getAssessmentValue(assessmentMap)!;
  }

  async createCulturalContext(culturalContext: CulturalContext): Promise<ContextEh> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const contextEh = await this.service.createCulturalContext(culturalContext);
    this._appletConfig.update(appletConfig => {
      appletConfig.cultural_contexts[culturalContext.name] = contextEh;
      return appletConfig;
    });
    return contextEh;
  }

  async getCulturalContext(culturalContextEh: ContextEh): Promise<CulturalContext> {
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

  async checkIfAppletConfigExists(appletName: string): Promise<Option<AppletConfig>> {
    if (!this.service) throw new Error("SensemakerStore service not connected");
    const maybeAppletConfig = await this.service.checkIfAppletConfigExists(appletName);
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
