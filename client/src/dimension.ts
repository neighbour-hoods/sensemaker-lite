import { EntryHash, EntryHashB64 } from "@holochain/client"
import { Range, RangeEh } from "./range"
interface CoreDimension {
    name: string,
    computed: boolean,
}

export type Dimension = CoreDimension & {
  range_eh: RangeEh,
}

export type RawDimension = CoreDimension & {
  range_eh: EntryHash;
}

export type ConfigDimension = CoreDimension & {
    range: Range
}

export type DimensionEh = EntryHashB64
