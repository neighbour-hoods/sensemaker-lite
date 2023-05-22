use std::collections::BTreeMap;
use crate::Dimension;
use crate::method::DataSet;
use crate::range::RangeValue;
use hdi::prelude::*;

#[hdk_entry_helper]
#[derive(Clone)]
pub struct Assessment {
    pub value: RangeValue,
    pub dimension_eh: EntryHash,
    pub resource_eh: EntryHash,
    pub resource_def_eh: EntryHash,
    pub maybe_input_dataset: Option<DataSet>,
    pub author: AgentPubKey,
    pub timestamp: Timestamp,
}

#[derive(Clone, Serialize, Deserialize, Debug)]
pub struct CreateAssessmentInput {
    pub value: RangeValue,
    pub dimension_eh: EntryHash,
    pub resource_eh: EntryHash,
    pub resource_def_eh: EntryHash,
    pub maybe_input_dataset: Option<DataSet>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateAssessmentInput {
    pub original_action_hash: ActionHash,
    pub updated_assessment: Assessment,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct GetAssessmentsForResourceInput {
    pub resource_ehs: Vec<EntryHash>,
    pub dimension_ehs: Vec<EntryHash>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct AssessmentWithDimensionAndResource {
    pub assessment: Assessment,
    pub dimension: Option<Dimension>,
    pub resource: Option<Record>
}

pub type ByHash<T> = BTreeMap<HoloHash<holo_hash::hash_type::Entry>, T>;
pub type ByHashB64<T> = BTreeMap<holo_hash::HoloHashB64<holo_hash::hash_type::Entry>, T>;

pub type VecAssessmentsByHashInner = ByHash<Vec<Assessment>>;
pub type VecAssessmentsByHash = ByHashB64<Vec<Assessment>>;
pub type MapAssessmentsByHash = ByHashB64<Assessment>;
pub type MapAssessmentsByHashByResource = ByHashB64<MapAssessmentsByHash>;
pub type MapAugmentedAssessmentsByHash = ByHashB64<AssessmentWithDimensionAndResource>;
