import { AgentPubKey, AppAgentCallZomeRequest, AppAgentClient, EntryHash, Record as HolochainRecord, RoleName } from '@holochain/client';
import { AppletConfig, AppletConfigInput, Assessment, ComputeContextInput, CreateAppletConfigInput, CreateAssessmentInput, MapAssessmentsByHash, CulturalContext, Dimension, GetAssessmentsForResourceInput, Method, ResourceDef, RunMethodInput, VecAssessmentsByHash, MapAssessmentsByHashByResource } from './index';
import { Option } from './utils';

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

  async createDimension(dimension: Dimension): Promise<EntryHash> {
    return this.callZome('create_dimension', dimension);
  }

  async createResourceDef(resourceDef: ResourceDef): Promise<EntryHash> {
    return this.callZome('create_resource_def', resourceDef);
  }

  async createAssessment(assessment: CreateAssessmentInput): Promise<MapAssessmentsByHash> {
    return this.callZome('create_assessment', assessment);
  }

  async getAssessment(assessmentEh: EntryHash): Promise<Assessment> {
    return this.callZome('get_assessment', assessmentEh);
  }

  async getAssessmentsForResources(getAssessmentsInput: GetAssessmentsForResourceInput): Promise<MapAssessmentsByHashByResource> {
    return this.callZome('get_assessments_for_resources', getAssessmentsInput);
  }

  async createMethod(method: Method): Promise<EntryHash> {
    return this.callZome('create_method', method);
  }

  async runMethod(runMethodInput: RunMethodInput): Promise<MapAssessmentsByHash> {
    return this.callZome('run_method', runMethodInput);
  }

  async createCulturalContext(culturalContext: CulturalContext): Promise<EntryHash> {
    return this.callZome('create_cultural_context', culturalContext);
  }

  async getCulturalContext(culturalContextEh: EntryHash): Promise<CulturalContext> {
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
