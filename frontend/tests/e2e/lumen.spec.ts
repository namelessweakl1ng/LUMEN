import { test, expect } from "@playwright/test";

async function search(page: import("@playwright/test").Page, q = "linux") {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Search sources", { exact: true }).fill(q);
  await page.getByLabel("Search sources", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/q=/);
  await expect(
    page.getByRole("region", { name: "Search results" }),
  ).toBeVisible();
}

test("search flows through Next.js and FastAPI adapters, with rankings and attribution", async ({
  page,
}) => {
  await search(page);
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Linux", exact: true }),
  ).toBeVisible();
  await page.getByText("Why this result?", { exact: false }).first().click();
  await expect(page.getByText(/score/).first()).toBeVisible();
});

test("real backend comparison handles shared source results", async ({
  page,
}) => {
  await search(page);
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await expect(page.getByTestId("comparison-results")).toBeVisible();
  await expect(page.getByTestId("comparison-results")).toContainText(
    "shared URLs",
  );
});

test("category capabilities disable unsupported categories", async ({
  page,
}) => {
  await search(page);
  await expect(page.getByRole("button", { name: /Videos/ })).toBeDisabled();
  await page.getByRole("button", { name: "Developer", exact: true }).click();
  await expect(page).toHaveURL(/category=developer/);
  await expect(
    page.getByRole("heading", { name: "torvalds/linux" }),
  ).toBeVisible();
});

test("domain filters are in URL and enforce returned domain", async ({
  page,
}) => {
  await search(page);
  await page.getByText("Search controls & profiles", { exact: true }).click();
  await page.getByLabel("Include domains", { exact: true }).fill("github.com");
  await expect(page).toHaveURL(/site=github.com/);
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByTestId("search-result")).toContainText("github.com");
});

test("source selection updates URL and results", async ({ page }) => {
  await search(page);
  await page.getByText("Search controls & profiles", { exact: true }).click();
  await page.getByRole("checkbox", { name: /GitHub/ }).click();
  await expect(page.getByRole("checkbox", { name: /GitHub/ })).toBeChecked();
  await expect(page).toHaveURL(/engines=github/);
  await expect(page.getByTestId("search-result")).toHaveCount(1);
});

test("custom profiles persist across reload and can be renamed and removed", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeEnabled();
  await page.getByText("Search controls & profiles", { exact: true }).click();
  await page.getByLabel("Profile name", { exact: true }).fill("My research");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByLabel("Search profile")).toContainText("My research");
  await page.reload();
  await expect(page.getByLabel("Search profile")).toContainText("My research");
  await page
    .getByLabel("Search profile")
    .selectOption({ label: "My research" });
  await page.getByText("Search controls & profiles", { exact: true }).click();
  await page.getByLabel("Profile name", { exact: true }).fill("Renamed");
  await page.getByRole("button", { name: "Rename profile" }).click();
  await expect(page.getByLabel("Search profile")).toContainText("Renamed");
  await page.getByRole("button", { name: "Delete profile" }).click();
  await expect(page.getByLabel("Search profile")).not.toContainText("Renamed");
});

test("bookmarks, notes and collections persist in IndexedDB and export", async ({
  page,
}) => {
  await search(page);
  const result = page
    .getByTestId("search-result")
    .filter({ has: page.getByRole("heading", { name: "Linux", exact: true }) });
  await result
    .getByRole("button", {
      name: "Save Linux to research workspace",
      exact: true,
    })
    .click();
  await expect(
    result.getByRole("button", {
      name: "Save Linux to research workspace",
      exact: true,
    }),
  ).toHaveText("Saved");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.getByLabel("New collection name").fill("Kernel notes");
  await page.getByRole("button", { name: "Create collection" }).click();
  await page
    .getByLabel("Notes for Linux", { exact: true })
    .fill("Read scheduler documentation");
  await page
    .getByLabel("Tags for Linux", { exact: true })
    .fill("kernel, research");
  await page
    .getByLabel("Move Linux to collection", { exact: true })
    .selectOption({ label: "Kernel notes" });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON" }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe("lumen-research.json");
  const path = await file.path();
  expect(path).toBeTruthy();
  const exported = JSON.parse(
    await (await import("node:fs/promises")).readFile(path!, "utf8"),
  );
  expect(
    exported.bookmarks.some(
      (b: { notes: string }) => b.notes === "Read scheduler documentation",
    ),
  ).toBe(true);
  await page.reload();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(page.getByLabel("Notes for Linux", { exact: true })).toHaveValue(
    "Read scheduler documentation",
  );
  await expect(
    page.getByLabel("Move Linux to collection", { exact: true }),
  ).toContainText("Kernel notes");
  await expect(
    page.getByRole("checkbox", { name: /Remember search history/ }),
  ).not.toBeChecked();
});

test("invalid collection import is rejected without deleting saved data", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page
    .locator("input[type=file]")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"bookmarks":[{"url":"javascript:alert(1)"}]}'),
    });
  await expect(page.getByRole("status")).toContainText(
    /invalid|unsupported|version|required/i,
  );
});

test("empty results are distinguished from provider failures", async ({
  page,
}) => {
  await search(page, "no-results");
  await expect(page.getByText(/No results/)).toBeVisible();
  await page.goto("/?q=provider-failure");
  await expect(
    page.getByText(/unavailable|failed|partial|No results/i).first(),
  ).toBeVisible();
});

test("partial engine failure preserves successful results", async ({
  page,
}) => {
  await search(page, "partial-failure");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await expect(page.getByText(/partial results/)).toBeVisible();
});

test("keyboard focus and workspace Escape respect typing contexts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeEnabled();
  await page.getByLabel("Search sources", { exact: true }).blur();
  await page.keyboard.press("/");
  await expect(
    page.getByLabel("Search sources", { exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Research workspace" }),
  ).not.toBeVisible();
});

test("mobile search has no horizontal page overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await search(page);
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("appearance settings persist and external image loading is opt-in", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  const settings = page.getByRole("region", { name: "Settings", exact: true });
  await settings
    .getByRole("button", { name: "Appearance", exact: true })
    .click();
  const preference = settings.getByRole("checkbox", {
    name: "Show external thumbnails automatically",
  });
  await expect(preference).not.toBeChecked();
  await preference.check();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "General", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await settings
    .getByRole("button", { name: "Appearance", exact: true })
    .click();
  await expect(preference).toBeChecked();
});

test("image results have attribution and require explicit thumbnail consent", async ({
  page,
}) => {
  let imageRequests = 0;
  await page.route("https://upload.wikimedia.org/**", async (route) => {
    imageRequests++;
    await route.fulfill({
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="gray"/></svg>',
    });
  });
  await search(page);
  await page.getByRole("button", { name: "Images", exact: true }).click();
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByTestId("search-result")).toContainText("CC BY-SA 4.0");
  expect(imageRequests).toBe(0);
  await page
    .getByRole("button", { name: "Load thumbnail · contacts image host" })
    .click();
  await expect(
    page.getByRole("img", { name: "File:Linux fixture.svg" }),
  ).toBeVisible();
  await expect.poll(() => imageRequests).toBe(1);
});

test("two tabs preserve research updates and cannot resurrect deleted data", async ({
  page,
  context,
}) => {
  await search(page);
  const second = await context.newPage();
  await search(second);
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await page.getByRole("button", { name: "Close research workspace" }).click();
  await second.getByRole("button", { name: "Workspace", exact: true }).click();
  await second
    .getByRole("button", { name: "Close research workspace" })
    .click();
  await page
    .getByRole("button", {
      name: "Save Linux to research workspace",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Save Linux to research workspace",
      exact: true,
    }),
  ).toHaveText("Saved");
  await second
    .getByRole("button", {
      name: "Save torvalds/linux to research workspace",
      exact: true,
    })
    .click();
  await expect(
    second.getByRole("button", {
      name: "Save torvalds/linux to research workspace",
      exact: true,
    }),
  ).toHaveText("Saved");
  await page.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(
    page.getByLabel("Notes for Linux", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Notes for torvalds/linux", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear local research data" }).click();
  await page.getByRole("button", { name: "Delete all local data" }).click();
  await expect(page.getByText("0 saved results")).toBeVisible();
  await second
    .getByRole("button", {
      name: "Save torvalds/linux to research workspace",
      exact: true,
    })
    .click();
  await second.reload();
  await expect(
    second.getByRole("button", { name: "General", exact: true }),
  ).toBeEnabled();
  await second.getByRole("button", { name: "Workspace", exact: true }).click();
  await expect(
    second.getByLabel("Notes for Linux", { exact: true }),
  ).not.toBeVisible();
  await expect(
    second.getByLabel("Notes for torvalds/linux", { exact: true }),
  ).toBeVisible();
  await expect(
    second.getByRole("checkbox", { name: /Remember search history/ }),
  ).not.toBeChecked();
  await second.close();
});
