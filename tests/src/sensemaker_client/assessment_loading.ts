import test from "tape-promise/tape"
import equal from 'fast-deep-equal/es6'
import { TestScheduler } from 'rxjs/testing'
import { of, filter, lastValueFrom } from 'rxjs'

import { mockAssessmentsStore, mockAssessment, mockEh } from '../store_mocks'
import { Assessment } from '@neighbourhoods/client'

test('it emits all values progressively loaded into resourceAssessments', async (t) => {
  const testScheduler = new TestScheduler((actual, expected) => {
    if (!equal(actual, expected)) {
      t.deepEqual(actual, expected)
    } else {
      t.ok(true, 'stream publishes expected values')
    }
  })

  // configure mock data

  const r1 = mockEh()
  const r2 = mockEh()
  const a1 = mockAssessment({ Integer: 1 }, r1)
  const a2 = mockAssessment({ Integer: 2 }, r2)

  const store = await mockAssessmentsStore({ 'resource_001': [a1] })

  // START TEST LOGIC

  const observed = store.resourceAssessments()

  // Load some initial Assessment set from server

  await store.loadAssessmentsForResources({ resource_ehs: [r1] })

  const expectedMarbles1 = 'a'
  const expectedValues1 = { a: a1 }

  testScheduler.run(({ expectObservable, flush }) => {
    expectObservable(observed).toBe(expectedMarbles1, expectedValues1)
    flush()
  })

  // Load an additional Assessment set from server, should emit newly returned data

  store.mockAssessments({ 'resource_002': [a2] })
  await store.loadAssessmentsForResources({ resource_ehs: [r2] })

  const expectedMarbles2 = 'a'
  const expectedValues2 = { a: a2 }

  testScheduler.run(({ expectObservable, flush }) => {
    expectObservable(observed).toBe(expectedMarbles2, expectedValues2)
    flush()
  })

  // Newly bound observers to the assessments should get them all

  const newlyObserved = store.resourceAssessments()

  const expectedMarbles3 = 'ab'
  const expectedValues3 = { a: a1, b: a2 }

  testScheduler.run(({ expectObservable, flush }) => {
    expectObservable(newlyObserved).toBe(expectedMarbles3, expectedValues3)
    flush()
  })
})
