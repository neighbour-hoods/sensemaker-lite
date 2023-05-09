import { EntryHashB64 } from "@holochain/client"
import { Range } from "./range"
interface CoreDimension {
    name: string,
    computed: boolean,
}

export type Dimension = CoreDimension & {
    range_eh: EntryHashB64,
}

export type ConfigDimension = CoreDimension & {
    range: Range
}

export type DimensionEh = EntryHashB64
