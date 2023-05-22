import { RangeValue } from "./range"
import { AgentPubKey, EntryHash, EntryHashB64, Record as HoloRecord, Timestamp, encodeHashToBase64 } from "@holochain/client"
import { Dimension, DimensionEh } from "./dimension"
import { DataSet } from "./method"
import { Option } from "./utils"
import { ResourceDefEh, ResourceEh } from "./resourceDef"

export interface CreateAssessmentInput {
    value: RangeValue,
    dimension_eh: EntryHash,
    resource_eh: EntryHash,
    resource_def_eh: EntryHash,
    maybe_input_dataset: Option<DataSet>, // For objective Dimensions only
}

export type Assessment = CreateAssessmentInput & {
    author: AgentPubKey,
    timestamp: Timestamp,
}

export type ByHashB64<T> = {
    [entry_hash: EntryHashB64]: T
}

export type MapAssessmentsByHash = ByHashB64<Assessment>
export type MapAssessmentsByHashByResource = ByHashB64<MapAssessmentsByHash>;
export type VecAssessmentsByHash = ByHashB64<Array<Assessment>>

export interface GetAssessmentsForResourceInput {
    resource_ehs: ResourceEh[],
    dimension_ehs: DimensionEh[],
}

export interface AssessmentWithDimensionAndResource {
    assessment: Assessment,
    dimension: Option<Dimension>,
    resource: Option<HoloRecord>
}

export type AssessmentEh = EntryHash

export const getAssessmentKeyValues = (returnMap: MapAssessmentsByHash): [EntryHashB64, Assessment][] => {
    return Object.entries(returnMap);
}

export const getAssessmentValue = (returnMap: MapAssessmentsByHash): Assessment | undefined => {
    return Object.values(returnMap).pop();
}

export const getAssessmentKey = (returnMap: MapAssessmentsByHash): EntryHashB64 | undefined => {
    return Object.keys(returnMap).pop();
}

export const getResourceHash = (a: Assessment): EntryHashB64 => {
    return encodeHashToBase64(a.resource_eh);
}

export const getDimensionHash = (a: Assessment): EntryHashB64 => {
    return encodeHashToBase64(a.dimension_eh);
}