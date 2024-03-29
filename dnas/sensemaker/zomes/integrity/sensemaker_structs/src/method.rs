use std::collections::BTreeMap;

use hdi::prelude::*;

use crate::{applet::ConfigMethod, Dimension};

#[hdk_entry_helper]
#[derive(Clone)]
pub struct Method {
    pub name: String,
    pub input_dimension_ehs: Vec<EntryHash>, // Validation: make sure it is subjective
    pub output_dimension_eh: EntryHash,      // Validation: make sure it is objective
    pub program: Program,                    // making enum for now, in design doc it is `AST`
    pub can_compute_live: bool,
    pub requires_validation: bool, // if true, DataSet must be committed to be retrievable in the validation The Objective Assesment must have the DataSet.
}

// Used for atomic operation in method creation
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PartialMethod {
    pub name: String,
    pub input_dimension_ehs: Vec<EntryHash>,
    pub output_dimension_eh: Option<EntryHash>, // This is now nullable
    pub program: Program,                   
    pub can_compute_live: bool,
    pub requires_validation: bool
}

impl TryFrom<ConfigMethod> for Method {
    type Error = WasmError;
    fn try_from(value: ConfigMethod) -> Result<Self, Self::Error> {
        let input_dimension_ehs = value
            .input_dimensions
            .into_iter()
            .map(|config_dimension| {
                let converted_dimension: Dimension = Dimension::try_from(config_dimension)?;
                hash_entry(converted_dimension)
            })
            .collect::<ExternResult<Vec<EntryHash>>>()?;

        let converted_output_dimension: Dimension = Dimension::try_from(value.output_dimension)?;
        let output_dimension_eh = hash_entry(converted_output_dimension)?;

        let method = Method {
            name: value.name,
            input_dimension_ehs,
            output_dimension_eh,
            program: value.program,
            can_compute_live: value.can_compute_live,
            requires_validation: value.requires_validation,
        };
        Ok(method)
    }
}

#[hdk_entry_helper]
#[derive(Clone)]
pub struct DataSet {
    pub from: EntryHash,                                  // method
    pub data_points: BTreeMap<EntryHash, Vec<EntryHash>>, //<DimensionEh, Vec<AssessmentEh>>
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub enum Program {
    Sum,
    Average,
}
