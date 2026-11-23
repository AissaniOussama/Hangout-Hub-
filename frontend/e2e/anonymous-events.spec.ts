import { test, expect } from '@playwright/test'
import { createEvent, makeUser, registerUser, uniqueSuffix } from './utils'

test.describe('Anonymous visitors and event visibility', () => {
  test('anonymous users see public events but not private ones on the home page', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    await registerUser(ownerPage, makeUser('anon-list-owner'))

    const publicTitle = `Public Anon List ${uniqueSuffix()}`
    const privateTitle = `Private Anon List ${uniqueSuffix()}`
    await createEvent(ownerPage, { title: publicTitle, startTime: '2027-04-01T18:00' })
    await createEvent(ownerPage, { title: privateTitle, startTime: '2027-04-02T18:00', isPublic: false })
    await ownerContext.close()

    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()

    await anonPage.goto('/')
    await anonPage.getByPlaceholder('Search by title...').fill(publicTitle)
    await expect(anonPage.getByText(publicTitle, { exact: true })).toBeVisible()

    await anonPage.getByPlaceholder('Search by title...').fill(privateTitle)
    await expect(anonPage.getByText('No events match your filters.')).toBeVisible()
    await expect(anonPage.getByText(privateTitle, { exact: true })).not.toBeVisible()

    await anonContext.close()
  })

  test('anonymous users can open a public event but RSVP/Polls are replaced with a login prompt', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    await registerUser(ownerPage, makeUser('anon-public-owner'))

    const title = `Public Detail Anon ${uniqueSuffix()}`
    await createEvent(ownerPage, { title, description: 'Open to everyone', startTime: '2027-04-03T18:00' })
    await ownerPage.getByPlaceholder('Search by title...').fill(title)
    await ownerPage.getByText(title, { exact: true }).click()
    await expect(ownerPage).toHaveURL(/\/events\/\d+$/)
    const eventPath = new URL(ownerPage.url()).pathname
    await ownerContext.close()

    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()

    await anonPage.goto(eventPath)
    await expect(anonPage).toHaveURL(eventPath) // stays put, no bounce to /login
    await expect(anonPage.getByText(title)).toBeVisible()
    await expect(anonPage.getByText('Open to everyone')).toBeVisible()

    // Logged-out UI: RSVP buttons and Polls widget (both auth-only) are hidden,
    // replaced by a login prompt.
    await expect(anonPage.getByRole('button', { name: 'Attending' })).not.toBeVisible()
    await expect(anonPage.getByRole('link', { name: 'Log in' })).toBeVisible()
    await expect(anonPage.getByText('to RSVP.')).toBeVisible()
    await expect(anonPage.getByText('Polls')).not.toBeVisible()

    await anonContext.close()
  })

  test('anonymous users cannot view a private event detail page', async ({ browser }) => {
    const ownerContext = await browser.newContext()
    const ownerPage = await ownerContext.newPage()
    await registerUser(ownerPage, makeUser('anon-private-owner'))

    const title = `Private Detail Anon ${uniqueSuffix()}`
    await createEvent(ownerPage, { title, startTime: '2027-04-04T18:00', isPublic: false })
    await ownerPage.getByPlaceholder('Search by title...').fill(title)
    await ownerPage.getByText(title, { exact: true }).click()
    await expect(ownerPage).toHaveURL(/\/events\/\d+$/)
    const eventPath = new URL(ownerPage.url()).pathname
    await ownerContext.close()

    const anonContext = await browser.newContext()
    const anonPage = await anonContext.newPage()

    await anonPage.goto(eventPath)
    await expect(anonPage).toHaveURL(eventPath) // no bounce to /login either
    await expect(anonPage.getByText("Event not found or you don't have access to it.")).toBeVisible()
    await expect(anonPage.getByText(title)).not.toBeVisible()

    await anonContext.close()
  })
})
