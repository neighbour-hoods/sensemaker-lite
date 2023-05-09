import { AppEntryDef, EntryHashB64 } from "@holochain/client";
import { ConfigDimension, Dimension } from "./dimension";

interface CoreResourceDef {
    name: string,
    base_types: Array<AppEntryDef>,
}
export type ResourceDef = CoreResourceDef & {
  dimension_ehs: Array<EntryHashB64>,
}

export type ConfigResourceDef = CoreResourceDef & {
  dimensions: Array<ConfigDimension>,
}

export type ResourceDefEh = EntryHashB64

export type ResourceEh = EntryHashB64
