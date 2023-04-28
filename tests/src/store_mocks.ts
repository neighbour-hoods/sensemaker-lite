// import { mock } from 'sinon'
import { randomBytes } from 'crypto'

import {
  SensemakerStore, SensemakerService,
  Assessment, AssessmentObservable,
  GetAssessmentsForResourceInput, ResourceAssessmentsResponse,
  RangeValue,
} from '@neighbourhoods/client'

// @see https://crates.io/crates/holo_hash
const HOLOCHAIN_RAW_IDENTIFIER_LEN = 36
// @see holo_hash::hash_type::primitive
const HOLOHASH_PREFIX_DNA = Uint8Array.of(0x84, 0x2d, 0x24) // uhC0k
const HOLOHASH_PREFIX_ENTRY = Uint8Array.of(0x84, 0x21, 0x24) // uhCEk
// const HOLOHASH_PREFIX_HEADER = Uint8Array.of(0x84, 0x29, 0x24) // uhCkk
const HOLOHASH_PREFIX_AGENT = Uint8Array.of(0x84, 0x20, 0x24) // uhCAk

function concatenate(...arrays) {
  // Calculate byteSize from all arrays
  let size = arrays.reduce((a, b) => a + b.byteLength, 0)
  // Allcolate a new buffer
  let result = new Uint8Array(size)

  // Build the new array
  let offset = 0
  for (let arr of arrays) {
    result.set(arr, offset)
    offset += arr.byteLength
  }

  return result
}

const mockHash = (prefix) =>
  Buffer.from(
    concatenate(
      prefix,
      randomBytes(HOLOCHAIN_RAW_IDENTIFIER_LEN).buffer,
    ),
  ) as Uint8Array

export const mockEh = () => mockHash(HOLOHASH_PREFIX_ENTRY)
export const mockAgentKey = () => mockHash(HOLOHASH_PREFIX_AGENT)

export const mockAssessment = (val: RangeValue) => ({
  resource_eh: mockEh(),
  dimension_eh: mockEh(),
  resource_def_eh: mockEh(),
  maybe_input_dataset: null,
  value: val,
  author: mockEh(),
  timestamp: Date.now(),
})

export async function mockAssessmentsStore(withAssessments: ResourceAssessmentsResponse) {
  const pubKey = mockAgentKey()
  const serviceMock = {
    myPubKey() {
      return pubKey
    },

    async getAssessmentsForResources(getAssessmentsInput: GetAssessmentsForResourceInput): Promise<Assessment[]> {
      return Object.keys(withAssessments).flatMap(resourceEh => withAssessments[resourceEh])
    },
  }

  return new SensemakerStore(serviceMock as SensemakerService)
}
