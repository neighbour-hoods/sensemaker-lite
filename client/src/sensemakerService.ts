import { AgentPubKey, AppAgentCallZomeRequest, AppAgentClient, EntryHashB64, Record as HolochainRecord, RoleName, encodeHashToBase64, decodeHashFromBase64 } from '@holochain/client';
import {
  AppletConfig, RawAppletConfig,
  Assessment, RawAssessment,
  ComputeContextInput, CreateAppletConfigInput, CreateAssessmentInput, GetAssessmentsForResourceInput,
  CulturalContext, Dimension, Method, ResourceDef, RunMethodInput,
  DimensionEh, ResourceDefEh, AssessmentEh, MethodEh, ContextEh, ResourceEh, Range, RangeEh,
} from './index';
import type { Option } from './utils';

const objectMap = (obj, fn) =>
  Object.fromEntries(
    Object.entries(obj).map(
      ([k, v], i) => [k, fn(v, k, i)]
    )
  )

export type ResourceAssessmentsResponse = Record<EntryHashB64, RawAssessment[]>

export function deserializeAssessment(a: RawAssessment): Assessment {
  return {
    ...a,
    author: encodeHashToBase64(a.author),
    dimension_eh: encodeHashToBase64(a.dimension_eh),
    resource_eh: encodeHashToBase64(a.resource_eh),
    resource_def_eh: encodeHashToBase64(a.resource_def_eh),
  }
}

export function deserializeAppletConfig(c: RawAppletConfig | null): AppletConfig | null {
  if (!c) return null
  return {
    ...c,
    ranges: objectMap(c.ranges, encodeHashToBase64),
    dimensions: objectMap(c.dimensions, encodeHashToBase64),
    resource_defs: objectMap(c.resource_defs, encodeHashToBase64),
    methods: objectMap(c.methods, encodeHashToBase64),
    cultural_contexts: objectMap(c.cultural_contexts, encodeHashToBase64),
  }
}

export class SensemakerService {
  constructor(public client: AppAgentClient, public roleName: RoleName, public zomeName = 'sensemaker') {}

  /**
   * Get my agentkey, if it has been created
   * @returns my AgentPubKey
   */
  myPubKey(): AgentPubKey {
    return this.client.myPubKey
  }

  async getAllAgents(): Promise<AgentPubKey[]> {
    return this.callZome('get_all_agents', null);
  }

  async createDimension(dimension: Dimension): Promise<DimensionEh> {
    return encodeHashToBase64(await this.callZome('create_dimension', {
      ...dimension,
      range_eh: decodeHashFromBase64(dimension.range_eh),
    }));
  }

  async createResourceDef(resourceDef: ResourceDef): Promise<ResourceDefEh> {
    return encodeHashToBase64(await this.callZome('create_resource_def', {
      ...resourceDef,
      dimension_ehs: resourceDef.dimension_ehs.map(decodeHashFromBase64),
    }));
  }

  async createAssessment(assessment: CreateAssessmentInput): Promise<AssessmentEh> {
    return encodeHashToBase64(await this.callZome('create_assessment', {
      ...assessment,
      dimension_eh: decodeHashFromBase64(assessment.dimension_eh),
      resource_eh: decodeHashFromBase64(assessment.resource_eh),
      resource_def_eh: decodeHashFromBase64(assessment.resource_def_eh),
    }));
  }

  async getAssessment(assessmentEh: AssessmentEh): Promise<Assessment> {
    return deserializeAssessment(await this.callZome('get_assessment', decodeHashFromBase64(assessmentEh)));
  }

  async getAssessmentsForResources(getAssessmentsInput: GetAssessmentsForResourceInput): Promise<Assessment[]> {
    const assessments: ResourceAssessmentsResponse = await this.callZome('get_assessments_for_resources', getAssessmentsInput);

    return Object.keys(assessments).flatMap(resourceEh => assessments[resourceEh].map(deserializeAssessment))
  }

  async createMethod(method: Method): Promise<MethodEh> {
    return encodeHashToBase64(await this.callZome('create_method', {
      ...method,
      target_resource_def_eh: decodeHashFromBase64(method.target_resource_def_eh),
      output_dimension_eh: decodeHashFromBase64(method.output_dimension_eh),
      input_dimension_ehs: method.input_dimension_ehs.map(decodeHashFromBase64),
    }));
  }

  async runMethod(runMethodInput: RunMethodInput): Promise<Assessment> {
    return deserializeAssessment(await this.callZome('run_method', runMethodInput));
  }

  async createCulturalContext(culturalContext: CulturalContext): Promise<ContextEh> {
    return encodeHashToBase64(await this.callZome('create_cultural_context', {
      ...culturalContext,
      resource_def_eh: decodeHashFromBase64(culturalContext.resource_def_eh),
      order_by: culturalContext.order_by.map(([dim, ...rest]) => [decodeHashFromBase64(dim), ...rest]),
      thresholds: culturalContext.thresholds.map(({ dimension_eh, ...rest }) => ({ ...rest, dimension_eh: decodeHashFromBase64(dimension_eh) })),
    }));
  }

  async getCulturalContext(culturalContextEh: ContextEh): Promise<HolochainRecord> {
    return this.callZome('get_cultural_context', decodeHashFromBase64(culturalContextEh));
  }

  async computeContext(computeContextInput: ComputeContextInput): Promise<Array<ResourceEh>> {
    return (await this.callZome('compute_context', {
      ...computeContextInput,
      resource_ehs: computeContextInput.resource_ehs.map(decodeHashFromBase64),
      context_eh: decodeHashFromBase64(computeContextInput.context_eh),
    })).map(decodeHashFromBase64);
  }

  async loadAppletConfig(appletName: string): Promise<Option<AppletConfig>> {
    return deserializeAppletConfig(await this.callZome('check_if_applet_config_exists', appletName));
  }

  async registerApplet(appletConfig: CreateAppletConfigInput): Promise<AppletConfig> {
    return deserializeAppletConfig(await this.callZome('register_applet', appletConfig)) as AppletConfig;
  }

  private callZome(fn_name: string, payload: any) {
    const req: AppAgentCallZomeRequest = {
      role_name: this.roleName,
      zome_name: this.zomeName,
      fn_name,
      payload
    }
    return this.client.callZome(req);
  }
}
