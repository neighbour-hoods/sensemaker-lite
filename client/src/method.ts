import { EntryHash, EntryHashB64 } from "@holochain/client"
import { ConfigDimension, DimensionEh } from "./dimension"
import { ConfigResourceDef, ResourceDefEh, ResourceEh } from "./resourceDef"

interface CoreMethod {
    name: string,
    program: Program,
    can_compute_live: boolean,
    requires_validation: boolean,
}

export type Method = CoreMethod & {
  target_resource_def_eh: ResourceDefEh,
  input_dimension_ehs: Array<DimensionEh>,
  output_dimension_eh: DimensionEh,
}

export type RawMethod = CoreMethod & {
  target_resource_def_eh: EntryHash,
  input_dimension_ehs: Array<EntryHash>,
  output_dimension_eh: EntryHash,
}

export type ConfigMethod = CoreMethod & {
    target_resource_def: ConfigResourceDef,
    input_dimensions: Array<ConfigDimension>,
    output_dimension: ConfigDimension,
}

export interface RunMethodInput {
  resource_eh: ResourceEh,
  method_eh: MethodEh,
}
export interface DataSet {
    from: EntryHashB64, // :TODO: ResourceEh?
    data_points: {
        [key: string]: Array<EntryHashB64>, // key cannot be of type Uint8Array, specifying as string for now as we are not currently using `DataSet`
    }
}

export type Program = ProgramSum | ProgramAverage

export interface ProgramSum {
    Sum: null,
}

export interface ProgramAverage {
    Average: null,
}

export type MethodEh = EntryHashB64
