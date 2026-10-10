import { test, expect, type Page } from "@playwright/test";

async function search(page: Page, query = "linux") {
  await page.goto("/");
  await expect(page.getByLabel("Search profile")).toContainText("General");
  await page.getByLabel("Search query", { exact: true }).fill(query);
  await page.getByLabel("Search query", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/search\?q=/);
  await expect(page.getByRole("region", { name: "Search results", exact: true })).toBeVisible();
}
async function save(page: Page, title: string) {
  const trigger = page.getByRole("button", { name: `Save ${title} to research workspace`, exact: true });
  await trigger.click();
  await page.getByRole("group", { name: `Choose collection for ${title}` }).getByRole("button", { name: "Inbox", exact: true }).click();
  await expect(trigger).toHaveText("Saved");
}

test("dedicated homepage navigation reaches all sections", async ({ page }) => {
  await page.goto("/");
  const nav = page.getByRole("navigation", { name: "Main navigation" });
  for (const [name, path, heading] of [["Workspace", "/workspace", "Research workspace"], ["Saved", "/saved", "Saved items"], ["Profiles", "/profiles", "Search profiles"], ["Settings", "/settings", "Settings"]]) {
    await nav.getByRole("link", { name, exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("search reaches real FastAPI adapters and keeps diagnostics collapsed", async ({ page }) => {
  await search(page);
  await expect(page.getByRole("heading", { name: "Linux", exact: true })).toBeVisible();
  const diagnostics = page.getByText("Search diagnostics", { exact: true });
  await expect(diagnostics.locator("..")).not.toHaveAttribute("open", "");
  await page.getByTestId("search-result").first().getByText("Source & ranking details").click();
  await expect(page.getByText("Strategy: balanced").first()).toBeVisible();
  const cookie = (await page.context().cookies()).find(c => c.name === "lumen-search-session");
  expect(cookie?.httpOnly).toBe(true);
});

test("working categories switch results and unsupported categories are absent", async ({ page }) => {
  await search(page);
  const category = page.getByLabel("Category", { exact: true });
  await expect(category).not.toContainText("Videos");
  await category.selectOption("developer");
  await expect(page).toHaveURL(/category=developer/);
  await expect(page.getByRole("heading", { name: "torvalds/linux", exact: true })).toBeVisible();
});

test("source selection is explicit and shareable", async ({ page }) => {
  await search(page);
  await page.getByRole("button", { name: "Sources", exact: true }).click();
  await page.getByRole("checkbox", { name: "GitHub repositories", exact: true }).click();
  await expect(page).toHaveURL(/engines=github/);
  await expect(page.getByTestId("search-result")).toHaveCount(1);
});

test("advanced filters constrain results and reset in one action", async ({ page }) => {
  await search(page);
  await page.getByRole("button", { name: /^Filters/ }).click();
  await page.getByLabel("Include domain", { exact: true }).fill("github.com");
  await page.getByLabel("Include domain", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/site=github.com/);
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByTestId("search-result")).toContainText("github.com");
  await expect(page.getByLabel("Safe search", { exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Reset filters" }).click();
  await expect(page).not.toHaveURL(/site=/);
  await expect(page.getByTestId("search-result")).toHaveCount(3);
});

test("pagination advances the page parameter", async ({ page }) => {
  await page.goto("/search?q=linux&engines=github&limit=1");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page.getByRole("button", { name: "Previous page" })).toBeVisible();
});

test("profiles can be created renamed and deleted without losing stored profiles", async ({ page }) => {
  await page.goto("/profiles");
  await page.getByRole("button", { name: "Create profile", exact: true }).click();
  await page.getByLabel("Profile name").fill("My research");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.getByRole("heading", { name: "My research", exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Edit My research", exact: true }).click();
  await page.getByLabel("Profile name").fill("Renamed");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.getByRole("button", { name: "Delete Renamed", exact: true }).click();
  await page.getByRole("button", { name: "Confirm delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Renamed", exact: true })).toHaveCount(0);
});

test("V2 profile data survives the new management interface", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("lumen-profiles")) localStorage.setItem("lumen-profiles", JSON.stringify([{ id: "existing-v2", name: "Legacy research", category: "science", engines: ["crossref"], ranking: "relevance", safe_search: 1, language: "en", time_range: "none", site: "", exclude_site: "", file_type: "", preferred_domains: "" }]));
  });
  await page.goto("/profiles");
  await expect(page.getByRole("heading", { name: "Legacy research" })).toBeVisible();
  await page.getByRole("button", { name: "Edit Legacy research" }).click();
  await expect(page.getByRole("checkbox", { name: "Crossref papers", exact: true })).toBeChecked();
});

test("saved items collections notes tags and JSON export persist", async ({ page }) => {
  await search(page);
  await save(page, "Linux");
  await page.goto("/workspace");
  await page.getByLabel("New collection name").fill("Kernel notes");
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await page.getByLabel("Notes for Linux", { exact: true }).fill("Read scheduler documentation");
  await page.getByLabel("Tags for Linux", { exact: true }).fill("kernel, research");
  await page.getByLabel("Move Linux to collection", { exact: true }).selectOption({ label: "Kernel notes" });
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const file = await downloaded;
  const exported = JSON.parse(await (await import("node:fs/promises")).readFile((await file.path())!, "utf8"));
  expect(exported.bookmarks[0].notes).toBe("Read scheduler documentation");
  await page.reload();
  await expect(page.getByLabel("Notes for Linux", { exact: true })).toHaveValue("Read scheduler documentation");
  await expect(page.getByRole("checkbox", { name: /Remember search history/ })).not.toBeChecked();
  await page.goto("/saved");
  await page.getByLabel("Search saved research").fill("kernel");
  await expect(page.getByRole("region", { name: "Selected saved item" })).toContainText("Linux");
});

test("collection rename and Markdown export work", async ({ page }) => {
  await page.goto("/workspace");
  await page.getByLabel("New collection name").fill("Reading");
  await page.getByRole("button", { name: "Create collection", exact: true }).click();
  await page.getByRole("button", { name: "Reading 0", exact: true }).click();
  await page.getByLabel("Rename collection", { exact: true }).fill("References");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await expect(page.getByRole("button", { name: "References 0", exact: true })).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Markdown", exact: true }).click();
  expect((await downloaded).suggestedFilename()).toMatch(/\.md$/);
});

test("invalid imports do not delete existing saved data", async ({ page }) => {
  await search(page);
  await save(page, "Linux");
  await page.goto("/workspace");
  await page.getByLabel("Import research JSON").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from('{"bookmarks":[{"url":"javascript:alert(1)"}]}') });
  await expect(page.getByRole("status").first()).toContainText(/invalid|unsupported|version|required/i);
  await expect(page.getByLabel("Notes for Linux", { exact: true })).toBeVisible();
});

test("comparison reports shared and unique results with real provider statuses", async ({ page }) => {
  await page.goto("/compare?q=linux");
  await page.getByRole("button", { name: "Compare profiles", exact: true }).click();
  await expect(page.getByRole("region", { name: "left comparison results" })).toBeVisible();
  await expect(page.getByText(/shared results ·/)).toBeVisible();
  await expect(page.getByText("Shared result", { exact: true }).first()).toBeVisible();
  await page.getByRole("region", { name: "right comparison results" }).getByText("Search diagnostics", { exact: true }).click();
  await expect(page.getByRole("region", { name: "right comparison results" })).toContainText("success");
});

test("RSS news is clearly labeled in fixture-enabled source mode", async ({ page }) => {
  await page.goto("/search?q=linux&category=news&engines=google_news");
  await expect(page.getByRole("heading", { name: /Linux kernel release/ })).toBeVisible();
  await expect(page.getByTestId("search-result")).toContainText("Example News");
  await expect(page.getByTestId("search-result")).toContainText("News article");
});

test("empty and partial failures are understandable", async ({ page }) => {
  await search(page, "no-results");
  await expect(page.getByText(/^No results\./)).toBeVisible();
  await page.goto("/search?q=partial-failure");
  await expect(page.getByTestId("search-result").first()).toBeVisible();
  await expect(page.getByText("Some sources could not respond. Results from available sources are shown.")).toBeVisible();
});

test("keyboard shortcut ignores typing and Escape closes filters", async ({ page }) => {
  await search(page);
  const query = page.getByLabel("Search query", { exact: true });
  await query.blur();
  await page.keyboard.press("/");
  await expect(query).toBeFocused();
  await page.getByRole("button", { name: /^Filters/ }).click();
  const domain = page.getByLabel("Include domain", { exact: true });
  await domain.focus();
  await page.keyboard.press("/");
  await expect(domain).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Advanced filters" })).toHaveCount(0);
});

test("mobile drawer traps focus closes with Escape and navigation works", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/");
  await page.getByRole("button", { name: "Open navigation" }).click();
  const drawer = page.getByRole("dialog", { name: "Navigation", exact: true });
  await expect(drawer).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(drawer).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Open navigation" })).toBeFocused();
  await page.getByRole("button", { name: "Open navigation" }).click();
  await drawer.getByRole("link", { name: "Workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Research workspace" })).toBeVisible();
  await expect(drawer).not.toBeVisible();
});

test("mobile results filters and comparison have no horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const url of ["/search?q=linux", "/compare?q=linux", "/workspace", "/profiles", "/settings"]) {
    await page.goto(url);
    await expect(page.locator("main")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
});

test("settings themes and image preference persist", async ({ page }) => {
  await page.goto("/settings");
  const checkbox = page.getByRole("checkbox", { name: "Show external thumbnails automatically" });
  await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.getByRole("button", { name: "Dark", exact: true }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(checkbox).toBeChecked();
  await page.getByRole("button", { name: "Light", exact: true }).click();
  await expect(page.locator("html")).not.toHaveClass(/dark/);
  await page.getByRole("button", { name: "System", exact: true }).click();
});

test("images retain attribution and only load on consent", async ({ page }) => {
  let requests = 0;
  await page.route("https://upload.wikimedia.org/**", async route => {
    requests++;
    await route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="gray"/></svg>' });
  });
  await page.goto("/search?q=linux&category=images");
  await expect(page.getByTestId("search-result")).toContainText("CC BY-SA 4.0");
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Load thumbnail · contacts image host" }).click();
  await expect(page.getByRole("img", { name: "File:Linux fixture.svg" })).toBeVisible();
  await expect.poll(() => requests).toBe(1);
});

test("two tabs preserve updates and deletion cannot resurrect old items", async ({ page, context }) => {
  await search(page);
  const second = await context.newPage();
  await search(second);
  await save(page, "Linux");
  await save(second, "torvalds/linux");
  await page.goto("/workspace");
  await expect(page.getByText(/2 saved items across/)).toBeVisible();
  await page.getByRole("button", { name: "Clear local research data" }).click();
  await page.getByRole("button", { name: "Delete all local data" }).click();
  await expect(page.getByText(/0 saved items across/)).toBeVisible();
  await save(second, "torvalds/linux");
  await second.goto("/workspace");
  await expect(second.getByText(/1 saved item across/)).toBeVisible();
  await expect(second.getByLabel("Notes for Linux", { exact: true })).toHaveCount(0);
  await second.close();
});

test("profile defaults support local domain and date filters", async ({ page }) => {
  await page.goto("/profiles");
  await page.getByRole("button", { name: "Customize Developer", exact: true }).click();
  await page.getByText("Default filters", { exact: true }).click();
  await expect(page.getByLabel("Include domain", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Exclude domain", { exact: true })).toBeEnabled();
  await expect(page.getByLabel("Date range", { exact: true })).toBeEnabled();
});

test("changing category clears incompatible date filters", async ({ page }) => {
  await page.goto("/search?q=linux&category=developer&time_range=week");
  await expect(page.getByLabel("Category", { exact: true })).toContainText("Images");
  await page.getByLabel("Category", { exact: true }).selectOption("images");
  await expect(page).not.toHaveURL(/time_range=week/);
  await expect(page.getByTestId("search-result")).toHaveCount(1);
});

test("comparison result attribution stays with the submitted profiles and query", async ({ page }) => {
  await page.goto("/compare?q=linux");
  await page.getByRole("button", { name: "Compare profiles", exact: true }).click();
  const left = page.getByRole("region", { name: "left comparison results" });
  await expect(left.getByRole("heading", { name: "General", exact: true })).toBeVisible();
  await page.getByLabel("Left profile", { exact: true }).selectOption("research");
  await page.getByLabel("Query", { exact: true }).fill("unsent query");
  await expect(left.getByRole("heading", { name: "General", exact: true })).toBeVisible();
  await expect(left.getByRole("heading", { name: "Research", exact: true })).toHaveCount(0);
  await left.getByRole("button", { name: "Save Linux to research workspace", exact: true }).click();
  await left.getByRole("group", { name: "Choose collection for Linux" }).getByRole("button", { name: "Inbox", exact: true }).click();
  await page.goto("/workspace");
  const downloaded = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exported = JSON.parse(await (await import("node:fs/promises")).readFile((await (await downloaded).path())!, "utf8"));
  expect(exported.bookmarks[0].query).toBe("linux");
});

test("idle details refresh other-tab notes before editing", async ({ page, context }) => {
  await search(page);
  await save(page, "Linux");
  await page.goto("/workspace");
  const second = await context.newPage();
  await second.goto("/workspace");
  await expect(second.getByLabel("Notes for Linux", { exact: true })).toBeVisible();
  await page.bringToFront();
  await page.getByLabel("Notes for Linux", { exact: true }).fill("Latest shared note");
  await page.getByLabel("Tags for Linux", { exact: true }).fill("latest");
  await expect(second.getByLabel("Notes for Linux", { exact: true })).toHaveValue("Latest shared note");
  await expect(second.getByLabel("Tags for Linux", { exact: true })).toHaveValue("latest");
  await second.bringToFront();
  await second.getByLabel("Notes for Linux", { exact: true }).press("End");
  await second.getByLabel("Notes for Linux", { exact: true }).pressSequentially(" appended");
  await second.getByLabel("Notes for Linux", { exact: true }).blur();
  await expect(page.getByLabel("Notes for Linux", { exact: true })).toHaveValue("Latest shared note appended");
  await second.close();
});

test("retired providers in stored profiles preserve data and disclose safe execution", async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("lumen-profiles")) localStorage.setItem("lumen-profiles", JSON.stringify([{ id: "existing-provider-profile", name: "Existing developer", category: "general", engines: ["brave", "github"], ranking: "balanced", safe_search: 1, language: "en", time_range: "none", site: "", exclude_site: "", file_type: "", preferred_domains: "" }]));
  });
  await search(page);
  await page.getByLabel("Search profile", { exact: true }).selectOption("existing-provider-profile");
  await expect(page.getByTestId("search-result")).toHaveCount(1);
  await expect(page.getByText(/unavailable sources omitted/i).first()).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("lumen-profiles")!)[0].engines)).toEqual(["brave", "github"]);
});

test("an all-unavailable source selection cannot silently search defaults", async ({ page }) => {
  await page.goto("/search?q=linux&engines=retired_source");
  await expect(page.getByText(/All selected sources are unavailable/i).first()).toBeVisible();
  await expect(page.getByTestId("search-result")).toHaveCount(0);
});
