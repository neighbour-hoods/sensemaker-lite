import { EntryHash } from '@holochain/client';
import { ConfigCulturalContext, ContextEh } from "./culturalContext";
import { ConfigDimension, DimensionEh } from "./dimension";
import { ConfigMethod, MethodEh } from "./method";
import { ConfigResourceDef, ResourceDefEh } from "./resourceDef";
import { Range, RangeEh } from "./range";

interface AppletMetadata {
  name: string,
  role_name: string,
}

export type AppletConfig = AppletMetadata & {
  ranges: {
    [rangeName: string]: RangeEh,
  },
  dimensions: {
    [dimensionName: string]: DimensionEh,
  },
  resource_defs: {
    [resourceDefName: string]: ResourceDefEh,
  },
  methods: {
    [methodName: string]: MethodEh,
  },
  cultural_contexts: {
    [contextName: string]: ContextEh,
  }
}

export type RawAppletConfig = AppletMetadata & {
  ranges: {
    [rangeName: string]: EntryHash,
  },
  dimensions: {
    [dimensionName: string]: EntryHash,
  },
  resource_defs: {
    [resourceDefName: string]: EntryHash,
  },
  methods: {
    [methodName: string]: EntryHash,
  },
  cultural_contexts: {
    [contextName: string]: EntryHash,
  }
}

export interface AppletConfigInput {
    name: string,
    ranges: Array<Range>,
    dimensions: Array<ConfigDimension>,
    resource_defs: Array<ConfigResourceDef>,
    methods: Array<ConfigMethod>,
    cultural_contexts: Array<ConfigCulturalContext>,
}

export interface CreateAppletConfigInput {
    applet_config_input: AppletConfigInput,
    role_name: string,
}

export interface AppletUIConfig {
    [resourceDefEh: string]: {
      display_objective_dimension: DimensionEh,
      create_assessment_dimension: DimensionEh,
      method_for_created_assessment: MethodEh,
  }
}
