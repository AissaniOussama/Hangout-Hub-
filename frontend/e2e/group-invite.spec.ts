import { test, expect } from '@playwright/test'
import { createGroup, makeUser, readInviteLink, registerUser, uniqueSuffix } from './utils'

test('owner invites a second user to a group via invite link', async ({ browser }) => {
  const ownerContext = await browser.newContext()
  const ownerPage = await ownerContext.newPage()
  await registerUser(ownerPage, makeUser('group-owner'))

  const groupName = `Hiking Crew ${uniqueSuffix()}`
  await createGroup(ownerPage, groupName)
  await expect(ownerPage.getByText(groupName)).toBeVisible()

  await ownerPage.getByText(groupName).click()
  await expect(ownerPage).toHaveURL(/\/groups\/\d+$/)

  const inviteLink = await readInviteLink(ownerPage)
  const inviteUrl = new URL(inviteLink)

  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  const invitee = makeUser('group-invitee')
  await registerUser(inviteePage, invitee)

  await inviteePage.goto(inviteUrl.pathname)
  await expect(inviteePage.getByText(`Do you want to join`)).toBeVisible()
  await expect(inviteePage.getByText(groupName)).toBeVisible()
  await inviteePage.getByRole('button', { name: 'Join group' }).click()

  await expect(inviteePage).toHaveURL(/\/groups\/\d+$/)
  await expect(inviteePage.getByText(groupName)).toBeVisible()
  await expect(inviteePage.getByRole('list').getByText(invitee.username)).toBeVisible()

  await ownerPage.reload()
  await expect(ownerPage.getByText('Members (2)')).toBeVisible()

  await ownerContext.close()
  await inviteeContext.close()
})
