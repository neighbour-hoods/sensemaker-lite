import test from "tape-promise/tape"
import { of, filter, lastValueFrom } from 'rxjs'

import { scheduler, mockAssessmentsStore, mockAssessment, mockEh } from '../store_mocks'
import { Assessment } from '@neighbourhoods/client'

test('it emits all values progressively loaded into resourceAssessments', async (t) => {
  const testScheduler = scheduler(t)

  // configure mock data

  const r1 = mockEh()
  const r2 = mockEh()
  const a1 = mockAssessment({ Integer: 1 }, r1)
  const a2 = mockAssessment({ Integer: 2 }, r2)

  const store = await mockAssessmentsStore({})

  // START TEST LOGIC

  const observed = store.resourceAssessments()

  // Load some initial Assessment set from server

  store.mockAssessments({ 'resource_001': [a1] })
  await store.loadAssessmentsForResources({ resource_ehs: [r1] })

  const expectedMarbles1 = 'a'
  const expectedValues1 = { a: new Set([a1]) }

  testScheduler.run(({ expectObservable, flush }) => {
    expectObservable(observed).toBe(expectedMarbles1, expectedValues1)
    flush()
  })

  // Load an additional Assessment set from server, should emit newly returned data

  store.mockAssessments({ 'resource_002': [a2] })
  await store.loadAssessmentsForResources({ resource_ehs: [r2] })

  const expectedMarbles2 = 'a'
  const expectedValues2 = { a: new Set([a1, a2]) }

  testScheduler.run(({ expectObservable, flush }) => {
    expectObservable(observed).toBe(expectedMarbles2, expectedValues2)
    flush()
  })

  // Newly bound observers to the assessments should get them all

  const newlyObserved = store.resourceAssessments()

  const expectedMarbles3 = 'a'
  const expectedValues3 = { a: new Set([a1, a2]) }

  testScheduler.run(({ expectObservable, flush }) => {
    expectObservable(newlyObserved).toBe(expectedMarbles3, expectedValues3)
    flush()
  })
})
