import { test, expect } from '@playwright/test';

test.describe('Leads CRUD E2E Flow', () => {
  let verticalName = `V-${Math.floor(Math.random() * 10000)}`;
  let subVerticalName = `SV-${Math.floor(Math.random() * 10000)}`;

  test.beforeEach(async ({ request, page }) => {
    // 1. Login via API to setup data
    const loginRes = await request.post('/api/v1/auth/login', {
      data: { email: 'admin@gmail.com', password: 'admin123' }
    });
    const { accessToken } = (await loginRes.json()).data;

    // 2. Create a Vertical
    const vRes = await request.post('/api/v1/verticals', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: verticalName, slug: verticalName.toLowerCase(), color: '#185FA5' }
    });
    const vertical = (await vRes.json()).data;

    // 3. Create a Sub-Vertical
    await request.post(`/api/v1/verticals/${vertical.id}/sub-verticals`, {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: { name: subVerticalName }
    });

    // 4. Perform standard login E2E flow
    await page.goto('/login');
    await page.fill('input[type="email"]', 'admin@gmail.com');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForURL('**/leads**');
    
    // Select the vertical from the sidebar
    await page.click(`text=${verticalName}`);
  });

  test('creates new lead successfully', async ({ page }) => {
    const uniqueId = Math.floor(100000 + Math.random() * 900000);
    const randomName = `E2E New Lead ${uniqueId}`;
    const randomPhone = `+1555${uniqueId}`;

    await page.click('button:has-text("Add Lead")');
    await page.fill('label:has-text("Name *") + input', randomName);
    await page.fill('label:has-text("Number *") + input', randomPhone);
    await page.fill('label:has-text("Business") + input', 'E2E Corp');
    
    // Select the Sub-Vertical (Mandatory)
    await page.selectOption('label:has-text("Sub-Vertical") + select', { label: subVerticalName });

    await page.click('button:has-text("Save Lead")');

    // Toast or table presence check
    await expect(page.locator(`text=${randomName}`)).toBeVisible();
  });
});
