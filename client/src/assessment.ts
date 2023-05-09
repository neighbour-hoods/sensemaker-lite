import { RangeValue } from "./range"
import { AgentPubKey, AgentPubKeyB64, EntryHash, EntryHashB64, Record, Timestamp } from "@holochain/client"
import { Dimension, DimensionEh } from "./dimension"
import { DataSet } from "./method"
import { ResourceDefEh, ResourceEh } from "./resourceDef"

type Option<Inner> = Inner | null

interface AssessmentData {
  value: RangeValue,
  maybe_input_dataset: Option<DataSet>, // For objective Dimensions only
}

export type CreateAssessmentInput = AssessmentData & {
  dimension_eh: EntryHash,
  resource_eh: EntryHash,
  resource_def_eh: EntryHash,
}

export type RawAssessment = CreateAssessmentInput & {
  author: AgentPubKey,
  timestamp: Timestamp,
}

export type Assessment = AssessmentData & {
  dimension_eh: DimensionEh,
  resource_eh: ResourceEh,
  resource_def_eh: ResourceDefEh,
  author: AgentPubKeyB64,
  timestamp: Timestamp,
}

export interface GetAssessmentsForResourceInput {
  resource_ehs?: EntryHashB64[],
  dimension_ehs?: EntryHashB64[],
}

export interface AssessmentWithDimensionAndResource {
  assessment: Assessment,
  dimension: Option<Dimension>,
  resource: Option<Record>
}

export type AssessmentEh = EntryHashB64
