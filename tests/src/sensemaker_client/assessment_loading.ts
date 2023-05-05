import test from "tape-promise/tape"
import { of, filter, lastValueFrom } from 'rxjs'

import { scheduler, mockAssessmentsStore, mockAssessment, mockEh } from '../store_mocks'
import { Assessment } from '@neighbourhoods/client'
import { encodeHashToBase64 } from "@holochain/client"



test('it emits all values progressively loaded into resourceAssessments', async (t) => {
  const testScheduler = scheduler(t)

  // configure mock data

  const r1 = mockEh()
  const r2 = mockEh()
  const r3 = mockEh()
  const a1 = mockAssessment({ Integer: 1 }, r1)
  const a2 = mockAssessment({ Integer: 2 }, r2)
  const a3 = mockAssessment({ Integer: 3 }, r3)

  const store = await mockAssessmentsStore({})

  // START TEST LOGIC

  const observed = store.resourceAssessments()

  // Load some initial Assessment set from server

  store.mockAssessments({ 'resource_001': [a1], 'resource_002': [a2] })
  await store.loadAssessmentsForResources({ resource_ehs: [r1, r2] })

  const expectedMarbles1 = 'b'
  const expectedValues1 = { b: new Set([a1, a2]) }

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observed).toBe(expectedMarbles1, expectedValues1)
  })

  // Load an additional Assessment set from server, should emit newly loaded data + initially loaded data

  store.mockAssessments({ 'resource_003': [a3] })
  await store.loadAssessmentsForResources({ resource_ehs: [r3] })

  const expectedMarbles2 = 'c'
  const expectedValues2 = { c: new Set([a1, a2, a3]) }

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observed).toBe(expectedMarbles2, expectedValues2)
  })

  // Newly bound observers to the assessments should get them all

  const newlyObserved = store.resourceAssessments()

  const expectedMarbles3 = 'a'
  const expectedValues3 = { a: new Set([a1, a2, a3]) }

  testScheduler.run(({ expectObservable }) => {
    expectObservable(newlyObserved).toBe(expectedMarbles3, expectedValues3)
  })
})



test('it emits a filtered stream of resourceAssessments based on matching dimensionEh', async (t) => {
  const testScheduler = scheduler(t)

  // configure mock data

  const d1 = mockEh(), d2 = mockEh()
  const r1 = mockEh()
  const a1 = mockAssessment({ Integer: 1 }, r1, d1),
    a2 = mockAssessment({ Integer: 2 }, 0, d2),
    a3 = mockAssessment({ Integer: 3 }, 0, d1),
    a4 = mockAssessment({ Integer: 2 }),
    a5 = mockAssessment({ Integer: 4 }, r1)

  const store = await mockAssessmentsStore({
    'resource_001': [a1, a5],
    'resource_002': [a2, a3, a4]
  })

  // START TEST LOGIC

  const observing1 = store.resourceAssessments({ dimensionEhs: [encodeHashToBase64(d1)] })
  const observing2 = store.resourceAssessments({ dimensionEhs: [encodeHashToBase64(d1), encodeHashToBase64(d2)] })
  const observingR1 = store.resourceAssessments({ resourceEhs: [encodeHashToBase64(r1)] })
  const observingR1D1 = store.resourceAssessments({ resourceEhs: [encodeHashToBase64(r1)], dimensionEhs: [encodeHashToBase64(d1)] })

  await store.loadAssessmentsForResources({})

  // filtering works as expected

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing1).toBe('a', { a: new Set([a1, a3]) })
    expectObservable(observing2).toBe('a', { a: new Set([a1, a2, a3]) })
    expectObservable(observingR1).toBe('a', { a: new Set([a1, a5]) })
    expectObservable(observingR1D1).toBe('a', { a: new Set([a1]) })
  })

  // late subscribers get existing data

  const observing3 = store.resourceAssessments({ dimensionEhs: [encodeHashToBase64(d1)] })
  const observing4 = store.resourceAssessments({ dimensionEhs: [encodeHashToBase64(d1), encodeHashToBase64(d2)] })

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing3).toBe('a', { a: new Set([a1, a3]) })
    expectObservable(observing4).toBe('a', { a: new Set([a1, a2, a3]) })
  })
})
