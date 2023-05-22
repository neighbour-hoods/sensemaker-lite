use std::collections::{BTreeMap};

use hdk::prelude::*;
use holo_hash::EntryHashB64;
use sensemaker_integrity::{
    EntryTypes,
    LinkTypes,
    Dimension,
    Assessment,
    CreateAssessmentInput,
    UpdateAssessmentInput,
    GetAssessmentsForResourceInput,
    VecAssessmentsByHashInner,
    AssessmentWithDimensionAndResource,
    MapAssessmentsByHash,
    MapAssessmentsByHashByResource,
    MapAugmentedAssessmentsByHash
};

use crate::agent::get_all_agents;
use crate::get_dimension;
use crate::signals::Signal;
use crate::utils::{
    unwrap_result_option,
    entry_from_record,
    fetch_provider_resource
};

const ALL_ASSESSED_RESOURCES_BASE: &str = "all_assessed_resources";

#[hdk_extern]
pub fn get_assessment(entry_hash: EntryHash) -> ExternResult<Option<Record>> {
    get(entry_hash, GetOptions::default())
}

// Returns the created assessment so we have the canonical author and timestamp
#[hdk_extern]
pub fn create_assessment(CreateAssessmentInput { value, dimension_eh, resource_eh, resource_def_eh, maybe_input_dataset }: CreateAssessmentInput) -> ExternResult<MapAssessmentsByHash> {
    let assessment = Assessment {
        value,
        dimension_eh,
        resource_eh,
        resource_def_eh,
        maybe_input_dataset,
        author: agent_info()?.agent_latest_pubkey,
        timestamp: sys_time()?.into(),
    };
    create_entry(&EntryTypes::Assessment(assessment.clone()))?;
    let assessment_eh = hash_entry(&EntryTypes::Assessment(assessment.clone()))?;
    let assessment_path = assessment_typed_path(assessment.resource_eh.clone(), assessment.dimension_eh.clone())?;
    // ensure the path components are created so we can fetch child paths later
    assessment_path.clone().ensure()?;
    create_link(
        assessment_path.path_entry_hash()?,
        assessment_eh.clone(),
        LinkTypes::Assessment,
        (),
    )?;

    let return_assessment = BTreeMap::from([(assessment_eh.into(), assessment)]);

    // send signal after assessment is created
    let signal = Signal::NewAssessment { assessment_map: return_assessment.clone() };
    let encoded_signal = ExternIO::encode(signal).map_err(|err| wasm_error!(WasmErrorInner::Guest(err.into())))?;
    remote_signal(encoded_signal, get_all_agents(())?)?;

    Ok(return_assessment)
}

// Returns all the assessments, indexed by hash, with their child objects
#[hdk_extern]
pub fn get_all_assessments(_:()) -> ExternResult<MapAugmentedAssessmentsByHash> {
    let assessed_resources_typed_paths = all_assessments_typed_path()?.children_paths()?;
    let mut assessments: MapAugmentedAssessmentsByHash = BTreeMap::new();

    // for each resource that has been assessed, crawl all children to get each dimension that it has been assessed along
    for assessed_resource_path in assessed_resources_typed_paths {
        let assessed_dimensions_for_resource_typed_paths = assessed_resource_path.children_paths()?;

        // for each dimension that a resource has been assessed, get the assessment
        for assessed_dimension_path in assessed_dimensions_for_resource_typed_paths {
            get_assessments_for_base_path(
                assessed_dimension_path.path_entry_hash()?,
                | entry_hash, a | {
                    assessments.insert(entry_hash.into(), augment_assessment(a));
                }
            );
        }
    }
    Ok(assessments)
}

#[hdk_extern]
pub fn get_assessments_for_resources(
    GetAssessmentsForResourceInput {
        resource_ehs,
        dimension_ehs,
    }: GetAssessmentsForResourceInput,
) -> ExternResult<MapAssessmentsByHashByResource> {
    let mut resource_assessments: MapAssessmentsByHashByResource = BTreeMap::<EntryHashB64, MapAssessmentsByHash>::new();
    for resource_eh in resource_ehs {
        let mut assessments: MapAssessmentsByHash = BTreeMap::new();
        for dimension_eh in &dimension_ehs {
            get_assessments_for_base_path(
                assessment_typed_path(resource_eh.clone(), dimension_eh.clone())?.path_entry_hash()?,
                | eh, assessment | {
                    assessments.insert(eh.into(), assessment);
                }
            );
        }
        resource_assessments.insert(resource_eh.into(), assessments);
    }
    Ok(resource_assessments)
}

// NOTE: when using the to get objective assessments, we need to clarify what it means for multiple objective assessments to be created for a resource
// do we always assume the most up to date? how will these affect checking against thresholds?
pub fn get_assessments_for_resource_inner(
    resource_eh: EntryHash,
    dimension_ehs: Vec<EntryHash>,
) -> ExternResult<VecAssessmentsByHashInner> {
    let mut assessments: VecAssessmentsByHashInner = BTreeMap::new();

    for dimension_eh in dimension_ehs {
        let mut dimension_assessments: Vec<Assessment> = Vec::new();
        get_assessments_for_base_path(
            assessment_typed_path(resource_eh.clone(), dimension_eh.clone())?.path_entry_hash()?,
            | _, assessment | {
                dimension_assessments.push(assessment);
            }
        );
        assessments.insert(dimension_eh.clone(), dimension_assessments);
    }
    Ok(assessments)
}

#[hdk_extern]
pub fn update_assessment(input: UpdateAssessmentInput) -> ExternResult<ActionHash> {
    update_entry(input.original_action_hash, &input.updated_assessment)
}

#[hdk_extern]
pub fn delete_assessment(action_hash: ActionHash) -> ExternResult<ActionHash> {
    delete_entry(action_hash)
}

pub fn assessment_typed_path(
    resource_eh: EntryHash,
    dimension_eh: EntryHash,
) -> ExternResult<TypedPath> {
    let resource_eh_string = EntryHashB64::from(resource_eh).to_string();
    let dimension_eh_string = EntryHashB64::from(dimension_eh).to_string();
    Ok(Path::from(format!(
        "{}.{}.{}",
        ALL_ASSESSED_RESOURCES_BASE, resource_eh_string, dimension_eh_string
    ))
    .typed(LinkTypes::Assessment)?)
}

pub fn all_assessments_typed_path() -> ExternResult<TypedPath> {
    Ok(Path::from(ALL_ASSESSED_RESOURCES_BASE)
    .typed(LinkTypes::Assessment)?)
}

// Returns the dimension associated with an assessment
fn fetch_dimension_entry (assessment: &Assessment) -> Option<Dimension> {
    match unwrap_result_option(get_dimension(assessment.dimension_eh.clone())) {
        Some(record) => match entry_from_record::<Dimension>(record) {
            Ok(dimension) => Some(dimension),
            _ => None
        },
        _ => None
    }
}

// Returns all the data associated with an assessment
fn augment_assessment(assessment: Assessment) -> AssessmentWithDimensionAndResource {
    // get the actual assessment object, dimension, and resource entry
    let dimension = fetch_dimension_entry(&assessment);

    // attempt a bridge call to the provider zome to get the resource
    let resource = unwrap_result_option(fetch_provider_resource(
        assessment.resource_eh.clone(),
        assessment.resource_def_eh.clone()
    ));

    AssessmentWithDimensionAndResource {
        assessment,
        dimension,
        resource
    }
}

fn get_assessments_for_base_path<F>(base: holo_hash::EntryHash, mut callback: F)
    where F: FnMut(HoloHash<holo_hash::hash_type::Entry>, Assessment) -> () {
    if let Ok(links) = get_links(
        base,
        LinkTypes::Assessment,
        None
    ) {
        for link in links {
            let entry_hash = EntryHash::from(link.target);
            if let Some(assessment_record) = unwrap_result_option(get_assessment(entry_hash.clone())) {
                if let Ok(assessment) = entry_from_record::<Assessment>(assessment_record) {
                    callback(entry_hash, assessment)
                }
            }
        }
    }
}
