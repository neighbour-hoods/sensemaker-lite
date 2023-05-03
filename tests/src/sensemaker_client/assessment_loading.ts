import test from "tape-promise/tape"
import { of, filter, lastValueFrom } from 'rxjs'

import { scheduler, mockAssessmentsStore, mockAssessment, mockEh } from '../store_mocks'
import { Assessment } from '@neighbourhoods/client'

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

  const expectedMarbles1 = 'ab'
  const expectedValues1 = { a: new Set([a1]), b: new Set([a1, a2]) }

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observed).toBe(expectedMarbles1, expectedValues1)
  })

  // Load an additional Assessment set from server, should emit newly returned data

  store.mockAssessments({ 'resource_003': [a3] })
  await store.loadAssessmentsForResources({ resource_ehs: [r3] })

  const expectedMarbles2 = 'abc'
  const expectedValues2 = { a: new Set([a1]), b: new Set([a1, a2]), c: new Set([a1, a2, a3]) }

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
