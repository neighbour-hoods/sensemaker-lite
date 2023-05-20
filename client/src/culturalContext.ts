import { EntryHashB64 } from "@holochain/client"
import { ConfigDimension, DimensionEh } from "./dimension"
import { RangeValue } from "./range"
import { ConfigResourceDef, ResourceDefEh, ResourceEh } from "./resourceDef"

interface CoreCulturalContext {
    name: string,
}
export type CulturalContext = CoreCulturalContext & {
    resource_def_eh: ResourceDefEh,
    order_by: Array<[DimensionEh, OrderingKind]>,
    thresholds: Array<Threshold>,
}

export type ConfigCulturalContext = CoreCulturalContext & {
    resource_def: ConfigResourceDef,
    order_by: Array<[ConfigDimension, OrderingKind]>,
    thresholds: Array<ConfigThreshold>,
}

export interface ContextResult {
  context_eh: ContextEh,
  dimension_ehs: Array<DimensionEh>, // of objective dimensions
  result: Array<[DimensionEh, Array<RangeValue>]>,
}

export interface ComputeContextInput {
    resource_ehs: Array<ResourceEh>,
    context_eh: ContextEh,
    can_publish_result: boolean,
}

interface CoreThreshold {
    kind: ThresholdKind,
    value: RangeValue,
}
export type Threshold = CoreThreshold & {
    dimension_eh: DimensionEh,
}

export type ConfigThreshold = CoreThreshold & {
    dimension: ConfigDimension,
}

export type OrderingKind = OrderingKindBiggest | OrderingKindSmallest

export interface OrderingKindBiggest {
    Biggest: null,
}

export interface OrderingKindSmallest {
    Smallest: null,
}

export type ThresholdKind = ThresholdKindGreaterThan | ThresholdKindLessThan | ThresholdKindEqual

export interface ThresholdKindGreaterThan {
    GreaterThan: null,
}

export interface ThresholdKindLessThan {
    LessThan: null,
}

export interface ThresholdKindEqual {
    Equal: null,
}

export type ContextEh = EntryHashB64
