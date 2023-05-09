import { AgentPubKey, AppAgentCallZomeRequest, AppAgentClient, EntryHash, EntryHashB64, Record as HolochainRecord, RoleName, encodeHashToBase64 } from '@holochain/client';
import { AppletConfig, AppletConfigInput, Assessment, RawAssessment, ComputeContextInput, CreateAppletConfigInput, CreateAssessmentInput, CulturalContext, Dimension, GetAssessmentsForResourceInput, Method, ResourceDef, RunMethodInput } from './index';
import type { Option } from './utils';

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

export class SensemakerService {
  constructor(public client: AppAgentClient, public roleName: RoleName, public zomeName = 'sensemaker') {}

    /**
   * Get my agentkey, if it has been created
   * @returns my AgentPubKey
   */
    myPubKey(): AgentPubKey {
      return this.client.myPubKey
    }


  async createDimension(dimension: Dimension): Promise<EntryHash> {
    return this.callZome('create_dimension', dimension);
  }

  async createResourceDef(resourceDef: ResourceDef): Promise<EntryHash> {
    return this.callZome('create_resource_def', resourceDef);
  }

  async createAssessment(assessment: CreateAssessmentInput): Promise<EntryHash> {
    return this.callZome('create_assessment', assessment);
  }

  async getAssessment(assessmentEh: EntryHash): Promise<Assessment> {
    return this.callZome('get_assessment', assessmentEh);
  }

  async getAssessmentsForResources(getAssessmentsInput: GetAssessmentsForResourceInput): Promise<Assessment[]> {
    const assessments: ResourceAssessmentsResponse = await this.callZome('get_assessments_for_resources', getAssessmentsInput);

    return Object.keys(assessments).flatMap(resourceEh => assessments[resourceEh].map(deserializeAssessment))
  }

  async createMethod(method: Method): Promise<EntryHash> {
    return this.callZome('create_method', method);
  }

  async runMethod(runMethodInput: RunMethodInput): Promise<Assessment> {
    return this.callZome('run_method', runMethodInput);
  }

  async createCulturalContext(culturalContext: CulturalContext): Promise<EntryHash> {
    return this.callZome('create_cultural_context', culturalContext);
  }

  async getCulturalContext(culturalContextEh: EntryHash): Promise<HolochainRecord> {
    return this.callZome('get_cultural_context', culturalContextEh);
  }

  async computeContext(computeContextInput: ComputeContextInput): Promise<Array<EntryHash>> {
    return this.callZome('compute_context', computeContextInput);
  }

  async checkIfAppletConfigExists(appletName: string): Promise<Option<AppletConfig>> {
    return this.callZome('check_if_applet_config_exists', appletName);
  }

  async registerApplet(appletConfig: CreateAppletConfigInput): Promise<AppletConfig> {
    return this.callZome('register_applet', appletConfig);
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
