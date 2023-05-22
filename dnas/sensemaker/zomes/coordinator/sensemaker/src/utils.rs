use std::collections::BTreeMap;

use hdk::prelude::*;
use sensemaker_integrity::{AppletConfig, Assessment, LinkTypes};

pub fn unwrap_result_option<T> (result: ExternResult<Option<T>>) -> Option<T> {
    match result {
        Ok(maybe_record) => maybe_record,
        _ => None
    }
}

pub fn entry_from_record<T: TryFrom<SerializedBytes, Error = SerializedBytesError>>(
    record: Record,
) -> ExternResult<T> {
    Ok(record
        .entry()
        .to_app_option()
        .map_err(|err| wasm_error!(WasmErrorInner::from(err)))?
        .ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Malformed bytes"))))?
    )
}

// flatten a btree map into flat vec for convenience
pub fn flatten_btree_map<K, V: Clone>(btree_map: BTreeMap<K, Vec<V>>) -> Vec<V> {
    btree_map
        .values()
        .map(|vec| vec.clone())
        .collect::<Vec<Vec<V>>>()
        .into_iter()
        .flatten()
        .collect::<Vec<V>>()
}

pub fn fetch_provider_resource(
    resource_eh: EntryHash,
    resource_def_eh: EntryHash,
) -> ExternResult<Option<Record>> {
    // make a bridge call to the provider zome
    let links = get_links(
        resource_def_eh.clone(),
        LinkTypes::ResourceDefEhToAppletConfig,
        None,
    )?;
    // get the last link
    match links.last() {
        // we have a link, get the resource
        Some(last_link) => match get(
            EntryHash::from(last_link.target.clone()),
            GetOptions::default()
        )? {
            // we have a record, get the config
            Some(record) => match entry_from_record::<AppletConfig>(record) {
                // we have a config, get the role name
                Ok(applet_config) => match applet_config.role_name {
                    // we have a role name, get the resource
                    Some(role_name) => {
                        let response = call(
                            CallTargetCell::OtherRole(role_name),
                            ZomeName::from("test_provider"),
                            "get_resource".into(),
                            None,
                            resource_eh,
                        )?;
                        match response {
                            ZomeCallResponse::Ok(result) => {
                                Ok(result
                                    .decode()
                                    .map_err(|err| wasm_error!(WasmErrorInner::from(err)))?)
                            },
                            _ => Err(wasm_error!("Could not retreive resource with bridged call."))
                        }
                    },
                    // resource type is not associated with a provider dna
                    // this only occurs when applet config is created during the init() callback
                    _ => Err(wasm_error!("Resource type not associated with provider DNA."))
                },
                // could not get the applet config
                _ => Err(wasm_error!("Could not retreive the applet config."))
            },
            // there is a link, but the record it points to doesn't exist
            _ => Err(wasm_error!("Could not retreive resource record from the link."))
        },
        // there is no link to applet config from the resource type eh
        _ => Err(wasm_error!("No links for resource_def_eh."))
    }
}

pub fn reduce_assessments_to_latest(mut assessments: Vec<Assessment>) -> Vec<Assessment> {
    // Sort the assessments by timestamp in descending order
    assessments.sort_by_key(|a| std::cmp::Reverse(a.timestamp));

    // Use a hash set to keep track of which dimension_eh values have already been added
    let mut seen_dimension_eh = std::collections::HashSet::new();

    // Filter the assessments to include only the most recent assessment for each unique dimension_eh value
    let filtered_assessments = assessments.into_iter().filter(|a| {
        if seen_dimension_eh.contains(&a.dimension_eh) {
            false
        } else {
            seen_dimension_eh.insert(a.dimension_eh.clone());
            true
        }
    }).collect();

    filtered_assessments
}
