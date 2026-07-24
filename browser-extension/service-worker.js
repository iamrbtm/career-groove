chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "career-groove-save-job",
    title: "Save job to CareerGroove",
    contexts: ["page", "selection"],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "career-groove-save-job" || !tab?.id) return;
  await chrome.storage.session.set({
    careerGrooveContextCapture: {
      tabId: tab.id,
      selectionText: info.selectionText || "",
      requestedAt: new Date().toISOString(),
    },
  });
  await chrome.action.openPopup().catch(() => undefined);
});
