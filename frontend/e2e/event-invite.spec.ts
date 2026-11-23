import { test, expect } from '@playwright/test'
import { createEvent, makeUser, readInviteLink, registerUser, uniqueSuffix } from './utils'

test('owner invites a second user to a private event via invite link', async ({ browser }) => {
  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await registerUser(ownerPage, makeUser('event-owner'))

  const eventTitle = `Private Movie Night ${uniqueSuffix()}`
  await createEvent(ownerPage, {
    title: eventTitle,
    startTime: '2027-03-01T20:00',
    isPublic: false,
  })

  await ownerPage.getByText(eventTitle).click()
  await expect(ownerPage).toHaveURL(/\/events\/\d+$/)
  await expect(ownerPage.getByText('Private')).toBeVisible()

  await ownerPage.getByRole('button', { name: 'Generate invite link' }).click()
  const inviteLink = await readInviteLink(ownerPage)
  const inviteUrl = new URL(inviteLink)

  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  const invitee = makeUser('event-invitee')
  await registerUser(inviteePage, invitee)

  await inviteePage.goto(inviteUrl.pathname)
  await expect(inviteePage.getByText(`Do you want to join`)).toBeVisible()
  await expect(inviteePage.getByText(eventTitle)).toBeVisible()
  await inviteePage.getByRole('button', { name: 'Join event' }).click()

  await expect(inviteePage).toHaveURL(/\/events\/\d+$/)
  await expect(inviteePage.getByText(eventTitle)).toBeVisible()

  await ownerPage.reload()
  await expect(ownerPage.getByRole('list').getByText(invitee.username)).toBeVisible()

  await ownerContext.close()
  await inviteeContext.close()
})
