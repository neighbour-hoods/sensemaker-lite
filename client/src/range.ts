import { EntryHashB64 } from "@holochain/client"

export interface Range {
    name: string,
    kind: RangeKind,
}

export type RangeKind = RangeKindInteger | RangeKindFloat


export interface RangeKindInteger {
    Integer: {
        min: number,
        max: number,
    }
}

export interface RangeKindFloat {
    Float: {
        min: number,
        max: number,
    }
}

export type RangeValue = RangeValueInteger | RangeValueFloat

export interface RangeValueInteger {
    Integer: number,
}

export interface RangeValueFloat {
    Float: number,
}

export type RangeEh = EntryHashB64
