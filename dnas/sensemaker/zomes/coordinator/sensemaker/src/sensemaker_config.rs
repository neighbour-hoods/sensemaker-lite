use hdk::prelude::*;
use sensemaker_integrity::{LinkTypes, Properties, SensemakerConfig};

#[derive(Serialize, Deserialize, Debug)]
pub struct UpdateConfigurationInput {
    original_action_hash: ActionHash, // this must be the original Create Action Hash
    updated_sensemaker_config: SensemakerConfig,
}

#[hdk_extern]
pub fn get_latest_sensemaker_config(_: ()) -> ExternResult<Option<Record>> {
    let ca_key: AgentPubKey = Properties::get()?
        .sensemaker_config
        .community_activator
        .into();

    // get details of the first Sensemaker entry created in order to get all updates to it.
    let links = get_links(ca_key, LinkTypes::CAToSensemakerConfig, None)?;

    // return None if links is empty
    if links.is_empty() {
        return Ok(None);
    }

    // get the SM config eh from first link assuming that there is only one sensemaker config created, since subsequent ones are all udpates.
    // can unwrap since links is not empty
    let original_config_eh: EntryHash = links.get(0).unwrap().target.clone().into_entry_hash().ok_or(wasm_error!(WasmErrorInner::Guest(String::from("Invalid link target"))))?;
    // get detail and immediately return None if None
    let detail = get_details(original_config_eh.clone(), GetOptions::default())?;

    if detail.is_none() {
        return Ok(None);
    }

    // match the detail arm. since eh was given, Entry arm is the place to do the operation.
    // we can get all updates to the entry and compare their timestamp and retrieve the latest updates visible to the agent.
    // can unwrap since is_none is called above
    match detail.unwrap() {
        Details::Entry(entry_detail) => {
            let maybe_update = entry_detail.updates.into_iter().max_by(|a, b| {
                let a_ts = a.action().timestamp();
                let b_ts = b.action().timestamp();
                a_ts.cmp(&b_ts)
            });
            if let Some(update) = maybe_update {
                // match update and return unreachable macro for all arms except the Update arm of Action
                match update.action() {
                    Action::Update(update) => {
                        // get the entry hash from the update
                        let updated_entry_hash: EntryHash = update.entry_hash.clone();

                        // get the entry from the entry hash
                        if let Some(record) = get(updated_entry_hash, GetOptions::default())? {
                            Ok(Some(record))
                        } else {
                            Ok(None)
                        }
                    }
                    _ => unreachable!(),
                }
            } else {
                // return the original sensemakerConfig if there is no update visible
                get(original_config_eh, GetOptions::default())
            }
        }
        Details::Record(_) => unreachable!(), // this arm is unreachable given that we provided entry hash
    }
}

#[hdk_extern]
pub fn update_sensemaker_config(config: UpdateConfigurationInput) -> ExternResult<ActionHash> {
    // update the original config entry
    update_entry(
        config.original_action_hash,
        config.updated_sensemaker_config.clone(),
    )
}
