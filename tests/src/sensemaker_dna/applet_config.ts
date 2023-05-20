type AppEntryDef = import('@holochain/client').AppEntryDef;
type EntryHash = import('@holochain/client').EntryHash;

import { AppletConfig, ConfigCulturalContext, ConfigMethod, ResourceDef, ConfigResourceDef, ConfigThreshold, CreateAppletConfigInput, CulturalContext, Dimension, Method, Range, Threshold, SensemakerService } from "@neighbourhoods/client"

import { cleanAllConductors, pause, runScenario } from "@holochain/tryorama";
//@ts-ignore
import test from "tape-promise/tape";

import { setUpAliceandBob } from "../utils";
import { decodeHashFromBase64, encodeHashToBase64 } from "@holochain/client";

const app_entry_def: AppEntryDef = { entry_index: 0, zome_index: 0, visibility: { Public: null } };

    test("test Sensemaker Configuration", async (t) => {
        await runScenario(async (scenario) => {
            const {
                alice,
                bob,
                alice_happs,
                bob_happs,
                alice_agent_key,
                bob_agent_key,
                ss_cell_id_alice,
                ss_cell_id_bob,
                provider_cell_id_alice,
                provider_cell_id_bob,
            } = await setUpAliceandBob(true, app_entry_def);

            const AliceSvc = new SensemakerService(alice.appAgentWs(), 'sensemaker_dna')

            try {
                await scenario.shareAllAgents();
                await pause(500);

                const integerRange: Range = {
                    "name": "1-scale",
                    "kind": {
                        "Integer": { "min": 0, "max": 1 }
                    },
                };

                const rangeHash = await AliceSvc.createRange(integerRange);
                t.ok(rangeHash);

                const dimensionName = "importance"
                const dimension: Dimension = {
                    name: dimensionName,
                    range_eh: rangeHash,
                    computed: false,
                }

                const configDimension = {
                    name: dimensionName,
                    range: integerRange,
                    computed: false,
                }

                const dimensionHash = await AliceSvc.createDimension({
                  name: dimensionName,
                  range_eh: rangeHash,
                  computed: false,
                })

                t.ok(dimensionHash);
                console.log('dimension hash', dimensionHash)

                const integerRange2: Range = {
                    name: "1-scale-total",
                    kind: {
                        Integer: { min: 0, max: 1000000 },
                    },
                };

                const rangeHash2 = await AliceSvc.createRange(integerRange2);
                t.ok(rangeHash2);

                const objectiveDimension: Dimension = {
                    name: "total_importance",
                    range_eh: rangeHash2,
                    computed: true,
                };

                const configObjectiveDimension = {
                    name: "total_importance",
                    range: integerRange2,
                    computed: true,
                }

                const objectiveDimensionHash = await AliceSvc.createDimension(objectiveDimension)

                t.ok(objectiveDimensionHash);

                let app_entry_def: AppEntryDef = { entry_index: 0, zome_index: 0, visibility: { Public: null } };
                // waiting for sensemaker-lite-types to be updated
                // const resourceDef: ResourceDef = {
                const resourceDef: ResourceDef = {
                    name: "task_item",
                    base_types: [app_entry_def],
                    dimension_ehs: [dimensionHash]
                }

                // waiting for sensemaker-lite-types to be updated
                // const configResourceDef: ConfigResourceDef = {
                const configResourceDef: ConfigResourceDef = {
                    name: resourceDef.name,
                    base_types: resourceDef.base_types,
                    dimensions: [configDimension]
                }

                const resourceDefEh = await AliceSvc.createResourceDef(resourceDef)

                t.ok(resourceDefEh);

                const methodName = "total_importance_method"
                const totalImportanceMethod: Method = {
                    name: methodName,
                    target_resource_def_eh: resourceDefEh,
                    input_dimension_ehs: [dimensionHash],
                    output_dimension_eh: objectiveDimensionHash,
                    program: { Sum: null },
                    can_compute_live: false,
                    requires_validation: false,
                };

                const configMethod: ConfigMethod = {
                    name: totalImportanceMethod.name,
                    target_resource_def: configResourceDef,
                    input_dimensions: [configDimension], // check if it's subjective (for now)
                    output_dimension: configObjectiveDimension,      // check if it's objective
                    program: totalImportanceMethod.program,                 // making enum for now, in design doc it is `AST`
                    can_compute_live: totalImportanceMethod.can_compute_live,
                    requires_validation: totalImportanceMethod.requires_validation,
                }

                const methodEh = await AliceSvc.createMethod(totalImportanceMethod);
                t.ok(methodEh);

                const threshold: Threshold = {
                    dimension_eh: objectiveDimensionHash,
                    kind: { GreaterThan: null },
                    value: { Integer: 0 },
                };

                const configThreshold: ConfigThreshold = {
                    dimension: configObjectiveDimension,
                    kind: { GreaterThan: null },
                    value: { Integer: 0 },
                };

                const culturalContext: CulturalContext = {
                    name: "most_important_tasks",
                    resource_def_eh: resourceDefEh,
                    thresholds: [threshold],
                    order_by: [[objectiveDimensionHash, { Biggest: null }]], // DimensionEh
                };

                const configCulturalContext: ConfigCulturalContext = {
                    name: culturalContext.name,
                    resource_def: configResourceDef,
                    thresholds: [configThreshold],
                    order_by: [[configObjectiveDimension, { Biggest: null }]], // DimensionEh
                }

                const contextEh = await AliceSvc.createCulturalContext(culturalContext);
                t.ok(contextEh);

                // create a config type
                // const appletConfig: AppletConfig = {
                const appletConfig: any = {
                    name: "todo",
                    ranges: {
                        "1-scale": rangeHash,
                        "1-scale-total": rangeHash2

                    },
                    role_name: "test_provider_dna",
                    dimensions: {
                        importance: dimensionHash,
                        total_importance: objectiveDimensionHash
                    },
                    resource_defs: { task_item: resourceDefEh },
                    methods: { total_importance_method: methodEh },
                    cultural_contexts: { most_important_tasks: contextEh },
                }

                const appletConfigInput: CreateAppletConfigInput = {
                    applet_config_input: {
                        name: appletConfig.name,
                        ranges: [integerRange, integerRange2],
                        dimensions: [configDimension, configObjectiveDimension],
                        resource_defs: [configResourceDef],
                        methods: [configMethod],
                        cultural_contexts: [configCulturalContext],
                    },
                    role_name: "test_provider_dna"
                }

                let maybeAppletConfig: AppletConfig | null = await AliceSvc.loadAppletConfig(
                    appletConfigInput.applet_config_input.name,
                );
                t.ok(!maybeAppletConfig);

                const returnedAppletConfig: AppletConfig = await AliceSvc.registerApplet(appletConfigInput);
                console.log("this is the applet config added", returnedAppletConfig);
                t.ok(returnedAppletConfig);
                t.deepEqual(JSON.stringify(returnedAppletConfig), JSON.stringify(appletConfig))

                maybeAppletConfig = await AliceSvc.loadAppletConfig(
                  appletConfigInput.applet_config_input.name,
                );
                t.ok(maybeAppletConfig);
                t.deepEqual(JSON.stringify(maybeAppletConfig), JSON.stringify(appletConfig))
                console.log(maybeAppletConfig)
            } catch (e) {
                console.log(e);
                t.ok(null);
            }

            await alice.shutDown();
            await bob.shutDown();
            await cleanAllConductors();
        });
    });
