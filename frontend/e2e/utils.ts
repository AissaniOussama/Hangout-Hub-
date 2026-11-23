import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export interface TestUser {
  username: string
  email: string
  password: string
}

let counter = 0

/** Generates a unique user so tests never collide on already-registered emails. */
export function makeUser(prefix: string): TestUser {
  const unique = uniqueSuffix()
  return {
    username: `${prefix}${unique}`.slice(0, 50),
    email: `${prefix}${unique}@example.com`,
    password: 'password123',
  }
}

/** A suffix unique across parallel workers and repeated runs against the same dev DB. */
export function uniqueSuffix(): string {
  counter += 1
  return `${Date.now()}-${process.pid}-${counter}-${Math.random().toString(36).slice(2, 8)}`
}

/** Registers a brand-new user through the real UI and lands on the home page. */
export async function registerUser(page: Page, user: TestUser) {
  await page.goto('/register')
  await page.getByLabel('Username').fill(user.username)
  await page.getByLabel('Email').fill(user.email)
  await page.getByLabel('Password').fill(user.password)
  // Dismiss the password-strength overlay, which can otherwise cover the submit button.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Register' }).click()
  await expect(page).toHaveURL('/')
}

export interface EventFormInput {
  title: string
  description?: string
  startTime: string // 'YYYY-MM-DDTHH:mm'
  location?: string
  isPublic?: boolean
  groupName?: string // selects an existing group by label
}

/** Opens the "Create Event" dialog from the events page and submits it. */
export async function createEvent(page: Page, input: EventFormInput) {
  await page.goto('/')
  await page.getByRole('button', { name: 'Create Event' }).click()

  const dialog = page.getByRole('dialog', { name: 'New Event' })
  await dialog.getByLabel('Title *').fill(input.title)
  if (input.description) {
    await dialog.getByLabel('Description').fill(input.description)
  }
  await dialog.getByLabel('Start *').fill(input.startTime)
  if (input.location) {
    await dialog.getByLabel('Location').fill(input.location)
  }

  if (input.groupName) {
    await dialog.getByLabel('Group').click()
    await page.getByRole('option', { name: input.groupName }).click()
  } else if (input.isPublic === false) {
    await dialog.locator('#isPublic').click()
  }

  await dialog.getByRole('button', { name: 'Create Event' }).click()
  await expect(dialog).toBeHidden()
}

/** Creates a group via the Groups page and returns to the group detail view. */
export async function createGroup(page: Page, name: string) {
  await page.goto('/groups')
  await page.getByRole('button', { name: 'Create group' }).click()
  const dialog = page.getByRole('dialog', { name: 'Create group' })
  await dialog.getByLabel('Group name *').fill(name)
  await dialog.getByRole('button', { name: 'Create' }).click()
  await expect(dialog).toBeHidden()
}

/** Reads the invite link shown in a readonly input on the current page. */
export async function readInviteLink(page: Page): Promise<string> {
  const input = page.locator('input[readonly].font-mono')
  await expect(input).not.toHaveValue('')
  return input.inputValue()
}
