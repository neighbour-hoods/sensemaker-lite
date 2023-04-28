import test from "tape-promise/tape"
import { TestScheduler } from 'rxjs/testing'
import { of, filter, lastValueFrom } from 'rxjs'

import { mockAssessmentsStore, mockAssessment, mockEh } from '../store_mocks'
import { Assessment } from '@neighbourhoods/client'

test('it emits all values loaded into resourceAssessments', async (t) => {
  const testScheduler = new TestScheduler((actual, expected) => {
    return t.deepEqual(actual, expected)
  })

  // configure mock data

  const a1 = mockAssessment({ Integer: 1 })
  const a2 = mockAssessment({ Integer: 2 })

  const store = await mockAssessmentsStore({
    'resource_001': [a1],
  })

  // START TEST LOGIC

  const observed = store.resourceAssessments()

  await store.loadAssessmentsForResources({})

  const expectedMarbles = 'a'
  const expectedValues = { a: a1 }

  testScheduler.run(({ expectObservable, cold }) => {
    expectObservable(observed).toBe(expectedMarbles, expectedValues)
  })
})
