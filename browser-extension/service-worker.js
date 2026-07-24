const extensionApi = globalThis.browser || globalThis.chrome;
const usesPromiseApi = typeof globalThis.browser !== "undefined";

function toPromise(method, ...args) {
  if (usesPromiseApi) return method(...args);
  return new Promise((resolve, reject) => {
    try {
      method(...args, (result) => {
        const lastError = extensionApi.runtime.lastError;
        if (lastError) reject(new Error(lastError.message));
        else resolve(result);
      });
      const lastError = extensionApi.runtime.lastError;
      if (lastError) reject(new Error(lastError.message));
    } catch (error) {
      reject(error);
    }
  });
}

function callMaybePromise(method, ...args) {
  if (usesPromiseApi) return method(...args);
  return new Promise((resolve, reject) => {
    try {
      const result = method(...args);
      const lastError = extensionApi.runtime.lastError;
      if (lastError) reject(new Error(lastError.message));
      else resolve(result);
    } catch (error) {
      reject(error);
    }
  });
}

extensionApi.runtime.onInstalled.addListener(() => {
  extensionApi.contextMenus.create({
    id: "career-groove-save-job",
    title: "Save job to CareerGroove",
    contexts: ["page", "selection"],
  });
});

extensionApi.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "career-groove-save-job" || !tab?.id) return;
  const storageArea = extensionApi.storage.session || extensionApi.storage.local;
  await toPromise(storageArea.set.bind(storageArea), {
    careerGrooveContextCapture: {
      tabId: tab.id,
      selectionText: info.selectionText || "",
      requestedAt: new Date().toISOString(),
    },
  });
  if (extensionApi.action?.openPopup) {
    await callMaybePromise(extensionApi.action.openPopup.bind(extensionApi.action)).catch(() => undefined);
  }
});
