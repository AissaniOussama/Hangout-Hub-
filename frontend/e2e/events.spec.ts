import { test, expect } from '@playwright/test'
import { createEvent, makeUser, registerUser, uniqueSuffix } from './utils'

test.describe('Events page and event creation', () => {
  test.beforeEach(async ({ page }) => {
    await registerUser(page, makeUser('events'))
  })

  test('shows the events page for a logged-in user', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Upcoming Events' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create Event' })).toBeVisible()
  })

  test('validates required fields before creating', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: 'Create Event' }).click()
    const dialog = page.getByRole('dialog', { name: 'New Event' })
    await dialog.getByRole('button', { name: 'Create Event' }).click()

    await expect(dialog.getByText('Title is required')).toBeVisible()
    await expect(dialog.getByText('Start time is required')).toBeVisible()
    await expect(dialog).toBeVisible()
  })

  test('creates a public event and shows it on the events page and detail view', async ({ page }) => {
    const title = `Board Game Night ${uniqueSuffix()}`
    await createEvent(page, {
      title,
      description: 'Bring your favorite game.',
      startTime: '2027-01-15T18:00',
      location: 'Community Center',
    })

    await expect(page.getByText(title, { exact: true })).toBeVisible()

    await page.getByText(title, { exact: true }).click()
    await expect(page).toHaveURL(/\/events\/\d+$/)
    await expect(page.getByText(title)).toBeVisible()
    await expect(page.getByText('Bring your favorite game.')).toBeVisible()
    await expect(page.getByText('Community Center')).toBeVisible()
    await expect(page.getByText('Private', { exact: true })).not.toBeVisible()
  })

  test('creates a private event and marks it as Private on the detail page', async ({ page }) => {
    const title = `Private Dinner ${uniqueSuffix()}`
    await createEvent(page, {
      title,
      startTime: '2027-02-01T19:00',
      isPublic: false,
    })

    await page.getByText(title, { exact: true }).click()
    await expect(page).toHaveURL(/\/events\/\d+$/)
    await expect(page.getByText('Private', { exact: true })).toBeVisible()
  })
})
