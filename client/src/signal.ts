import { MapAssessmentsByHash } from "./assessment";

export type SignalPayload = 
| {
    type: "NewAssessment",
    assessment_map: MapAssessmentsByHash,
}