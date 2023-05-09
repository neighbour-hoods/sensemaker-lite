import test from "tape-promise/tape"
import { scheduler, mockAssessmentsStore, mockAssessment, mockEh } from '../store_mocks'



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



test('it emits a filtered stream of resourceAssessments based on matching resourceEh & dimensionE', async (t) => {
  const testScheduler = scheduler(t)

  // configure mock data

  const d1 = mockEh(), d2 = mockEh()
  const r1 = mockEh()
  const a1 = mockAssessment({ Integer: 1 }, r1, d1),
    a2 = mockAssessment({ Integer: 2 }, 0, d2),
    a3 = mockAssessment({ Integer: 3 }, 0, d1),
    a4 = mockAssessment({ Integer: 4 }),
    a5 = mockAssessment({ Integer: 5 }, r1)

  const store = await mockAssessmentsStore({
    'resource_001': [a1, a5],
    'resource_002': [a2, a3, a4]
  })

  // START TEST LOGIC

  const observing1 = store.resourceAssessments({ dimensionEhs: [d1] })
  const observing2 = store.resourceAssessments({ dimensionEhs: [d1, d2] })
  const observingR1 = store.resourceAssessments({ resourceEhs: [r1] })
  const observingR1D1 = store.resourceAssessments({ resourceEhs: [r1], dimensionEhs: [d1] })

  await store.loadAssessmentsForResources({})

  // filtering works as expected

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing1).toBe('a', { a: new Set([a1, a3]) })
    expectObservable(observing2).toBe('a', { a: new Set([a1, a2, a3]) })
    expectObservable(observingR1).toBe('a', { a: new Set([a1, a5]) })
    expectObservable(observingR1D1).toBe('a', { a: new Set([a1]) })
  })

  // late subscribers get existing data

  const observing3 = store.resourceAssessments({ dimensionEhs: [d1] })
  const observing4 = store.resourceAssessments({ dimensionEhs: [d1, d2] })

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing3).toBe('a', { a: new Set([a1, a3]) })
    expectObservable(observing4).toBe('a', { a: new Set([a1, a2, a3]) })
  })
})



test('it provides convenience methods for accessing Assessment data in Applet widgets', async (t) => {
  const testScheduler = scheduler(t)

  // configure mock data

  const d1 = mockEh(), d2 = mockEh()
  const r1 = mockEh()
  const a1 = mockAssessment({ Integer: 1 }, r1, d1),
    a2 = mockAssessment({ Integer: 2 }, 0, d2),
    a3 = mockAssessment({ Integer: 3 }, 0, d1),
    a4 = mockAssessment({ Integer: 4 }),
    a5 = mockAssessment({ Integer: 5 }, r1),
    a6 = mockAssessment({ Integer: 6 }, r1, d2)

  const store = await mockAssessmentsStore({})

  // START TEST LOGIC

  const observing1 = store.assessmentsForResource(r1)
  const observing4 = store.assessmentsForResourceDimension(r1, d2)
  const observing2 = store.assessmentsForResourceDimensions(r1, [d1])
  const observing3 = store.assessmentsForResourceDimensions(r1, [d1, d2])

  store.mockAssessments({
    'resource_001': [a1, a5],
    'resource_002': [a2, a3, a4, a6]
  })
  await store.loadAssessmentsForResources({})

  // filtering works as expected

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing1).toBe('a', { a: new Set([a1, a5, a6]) })
    expectObservable(observing4).toBe('a', { a: new Set([a6]) })
    expectObservable(observing2).toBe('a', { a: new Set([a1]) })
    expectObservable(observing3).toBe('a', { a: new Set([a1, a6]) })
  })

  // late subscribers get existing data

  const observing1E = store.assessmentsForResource(r1)

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing1E).toBe('a', { a: new Set([a1, a5, a6]) })
  })

  // 'latest' filtering operates as expected

  const a7 = mockAssessment({ Integer: 7 }, r1, d2)
  store.mockAssessments({ 'resource_003': [a7] })
  await store.loadAssessmentsForResources({})

  const observing5 = store.latestAssessmentOf(r1, d2)

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing5).toBe('a', { a: a7 })
  })

  // adding information updates the most recently emitted value

  const a8 = mockAssessment({ Integer: 8 }, r1, d2)
  store.mockAssessments({ 'resource_003': [a8] })
  await store.loadAssessmentsForResources({})

  const observing6 = store.latestAssessmentOf(r1, d2)

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing5).toBe('a', { a: a8 })
    expectObservable(observing6).toBe('a', { a: a8 })
  })

  // outdated information does not cause an update

  const a9 = mockAssessment({ Integer: 9 }, r1, d2, Date.now() - 3600000)
  store.mockAssessments({ 'resource_003': [a9] })
  await store.loadAssessmentsForResources({})

  const observing7 = store.latestAssessmentOf(r1, d2)

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing7).toBe('a', { a: a8 })
  })

  // more complex set-based accessor

  const observing8 = store.latestAssessmentsOfDimensions(r1, [d2, d1])

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing8).toBe('a', { a: {
      [d1]: a1,
      [d2]: a8,
    } })
  })
})



test('it provides convenience methods for accessing Assessment data in the Sensemaker dashboard', async (t) => {
  const testScheduler = scheduler(t)

  // configure mock data

  const d1 = mockEh(), d2 = mockEh()
  const r1 = mockEh(), r2 = mockEh()
  const a1 = mockAssessment({ Integer: 1 }, r1, d1),
    a3 = mockAssessment({ Integer: 3 }, 0, d1),
    a5 = mockAssessment({ Integer: 5 }, r1),
    a6 = mockAssessment({ Integer: 6 }, r1, d1)

  const store = await mockAssessmentsStore({})

  // START TEST LOGIC

  const observing1 = store.assessmentsForDimension(d1)
  const observing2 = store.assessmentsForResourcesInDimension(d1, [r1])

  store.mockAssessments({
    'resource_001': [a1, a5, a6],
    'resource_002': [a3]
  })
  await store.loadAssessmentsForResources({})

  // filtering works as expected

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing1).toBe('a', { a: new Set([a1, a3, a6]) })
    expectObservable(observing2).toBe('a', { a: new Set([a1, a6]) })
  })

  // late subscribers get existing data

  const observing2E = store.assessmentsForResourcesInDimension(d1, [r1])

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing2E).toBe('a', { a: new Set([a1, a6]) })
  })

  // more complex set-based accessor; 'latest' filtering operates as expected

  const a7 = mockAssessment({ Integer: 7 }, r2, d1)
  store.mockAssessments({ 'resource_003': [a7] })
  await store.loadAssessmentsForResources({})

  const observing5 = store.latestAssessmentsForResourcesInDimension(d1, [r1, r2])

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing5).toBe('a', { a: {
      [r1]: a6,
      [r2]: a7,
    } })
  })

  // adding information updates the most recently emitted value

  const a8 = mockAssessment({ Integer: 8 }, r1, d1)
  store.mockAssessments({ 'resource_003': [a8] })
  await store.loadAssessmentsForResources({})

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing5).toBe('a', { a: {
      [r1]: a8,
      [r2]: a7,
    } })
  })

  // outdated information does not cause an update

  const a9 = mockAssessment({ Integer: 9 }, r1, d1, Date.now() - 3600000)
  store.mockAssessments({ 'resource_003': [a9] })
  await store.loadAssessmentsForResources({})

  testScheduler.run(({ expectObservable }) => {
    expectObservable(observing5).toBe('a', {
      a: {
        [r1]: a8,
        [r2]: a7,
      }
    })
  })
})
