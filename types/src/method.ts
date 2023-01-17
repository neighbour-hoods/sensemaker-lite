import { EntryHash } from "@holochain/client"
import { Dimension } from "./dimension"
import { ConfigResourceType } from "./resourceType"

interface CoreMethod {
    name: string,
    program: Program,
    can_compute_live: boolean,
    must_publish_dataset: boolean,
}
export type Method = CoreMethod & {
    target_resource_type_eh: EntryHash,
    input_dimension_ehs: Array<EntryHash>,
    output_dimension_eh: EntryHash,
}

export type ConfigMethod = CoreMethod & {
    target_resource_type: ConfigResourceType,
    input_dimensions: Array<Dimension>, 
    output_dimension: Dimension,
}

export interface RunMethodInput {
    resource_eh: EntryHash,
    method_eh: EntryHash,
}
export interface DataSet {
    from: EntryHash,
    data_points: {
        [key: string]: Array<EntryHash>, // key cannot be of type Uint8Array, specifying as string for now as we are not currently using `DataSet`
    }
}

export type Program = ProgramSum | ProgramAverage

export interface ProgramSum {
    Sum: null,
}

export interface ProgramAverage {
    Average: null,
}