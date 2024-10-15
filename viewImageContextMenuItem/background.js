window.DEFAULT_OPTIONS = Object.freeze({
    "show-view-audio": true,
    "show-view-image": true,
    "show-view-video": true,
    "override-referer": true,
    "override-accept": true,
    "left-click-action": "same-tab",
    "ctrl-left-click-action": "new-foreground-tab",
    "shift-left-click-action": "new-foreground-window",
    "ctrl-shift-left-click-action": "new-background-tab",
    "middle-click-action": "new-background-tab",
    "action-key-view-audio": null,
    "action-key-view-image": null,
    "action-key-view-video": null
  });

function loadOptionsFromStorage() {
  return browser.storage.local.get("options").then((resolve, reject) => {
    const options = resolve.options || {};
    return new Promise((resolve, reject) => {
      Object.keys(window.DEFAULT_OPTIONS).forEach((key) => { if (!options.hasOwnProperty(key)) options[key] = window.DEFAULT_OPTIONS[key]; });
      resolve(options);
    });
  });
}

function handleStorageChange(changes, areaName) {
  if (areaName !== "local" || !changes.options) return;
  applyOptions(changes.options.newValue);
}

function applyOptions(options) {
  window.options = options;
}

function loadOptionsFromStorageMessageListener(request, sender, sendResponse) {
  if (request && request.getOptions === true) {
    sendResponse(loadOptionsFromStorage());
  }
}

function applyActionKeyToMenuItemTitle(defaultMenuItemTitle, actionKey){
  if (!actionKey) return defaultMenuItemTitle;
  let menuItemTitle = defaultMenuItemTitle.replace(/ ?\(\&.\)&/g, "").replace(/\&/g, "");
  const actionKeyIndex = menuItemTitle.toLowerCase().indexOf(actionKey.toLowerCase());
  if (actionKeyIndex === -1) {
    menuItemTitle += " (&" + actionKey + ")";
  } else {
    menuItemTitle = menuItemTitle.slice(0, actionKeyIndex) + "&" + menuItemTitle.slice(actionKeyIndex);
  }
  return menuItemTitle;
}

function handleContextMenuShow(info, tab) {
  const isMenuItemRedundant = info.pageUrl === info.srcUrl;
  browser.menus.update(
    "view-audio-context-menu-item",
    {
      visible: !isMenuItemRedundant && window.options["show-view-audio"],
      title: applyActionKeyToMenuItemTitle(browser.i18n.getMessage("menuItemViewAudio"), window.options["action-key-view-audio"])
    }
  );
  browser.menus.update(
    "view-image-context-menu-item",
    {
      visible: !isMenuItemRedundant && window.options["show-view-image"],
      title: applyActionKeyToMenuItemTitle(browser.i18n.getMessage("menuItemViewImage"), window.options["action-key-view-image"])
    }
  );
  browser.menus.update(
    "view-video-context-menu-item",
    {
      visible: !isMenuItemRedundant && window.options["show-view-video"],
      title: applyActionKeyToMenuItemTitle(browser.i18n.getMessage("menuItemViewVideo"), window.options["action-key-view-video"])
    }
  );
  browser.menus.refresh();
}

function handleContextMenuItemClick(info, tab) {
  if (info.menuItemId != "view-audio-context-menu-item" &&
      info.menuItemId != "view-image-context-menu-item" &&
      info.menuItemId != "view-video-context-menu-item") return;

  const mediaType = ((info) => {
    switch(info.menuItemId) {
      case "view-audio-context-menu-item": return "audio";
      case "view-image-context-menu-item": return "image";
      case "view-video-context-menu-item": return "video";
      default: return null;
    }
  })(info);

  const clickType = ((info) => {
    const isMiddleClick = info.button === 1;
    const isShiftModifier = info.modifiers.indexOf("Shift") > -1;
    const isCtrlModifier = info.modifiers.indexOf("Ctrl") > -1;
    if (isMiddleClick) return "middle-click-action";
    if (isShiftModifier && isCtrlModifier) return "ctrl-shift-left-click-action";
    if (isShiftModifier) return "shift-left-click-action";
    if (isCtrlModifier) return "ctrl-left-click-action";
    return "left-click-action";
  })(info);
  const actionType = window.options[clickType];

  function isFileScheme(url) { return url.match(/^file:\/\//gi) !== null; }
  function isDataScheme(url) { return url.match(/^data:/gi) !== null; }
  function isBlobScheme(url) { return url.match(/^blob:/gi) !== null; }
  const usePrivilegedUrlWorkaround = 
    (isFileScheme(info.srcUrl) && isFileScheme(info.pageUrl)) // both page and image url are local "file://" scheme
    || isDataScheme(info.srcUrl) // image url is a "data:" scheme
    || isBlobScheme(info.srcUrl) // image url is a "blob:" scheme
  ;

  if (usePrivilegedUrlWorkaround) {
    processActionViaAnchorClick(info, tab, actionType);
  } else {
    processAction(info, tab, actionType, mediaType);
  }
}

function setRequestHeader(headers, headerName, value) {
  for (let header of headers) {
    if (header.name.toLowerCase() === headerName.toLowerCase()) {
      header.value = value;
      return;
    }
  }
  headers.push({ name: headerName, value: value });
}

function processAction(info, tab, actionType, mediaType) {
  const destinationUrl = info.srcUrl;

  if (window.options["override-referer"] === true || window.options["override-accept"] === true) {
    const listener = function(event) {
      browser.webRequest.onBeforeSendHeaders.removeListener(listener);
      return new Promise((resolve, reject) => {
        if (window.options["override-referer"] === true) {
          const refererValue = (info.pageUrl.match(/^[^\/]+:\/\/[^\/]+\//g) || [null])[0];
          setRequestHeader(event.requestHeaders, "Referer", refererValue);
        }
        if (window.options["override-accept"] === true) {
          const acceptValue = ((mediaType) => {
            switch(mediaType) {
              case "audio": return "audio/webm,audio/ogg,audio/wav,audio/*;q=0.9,application/ogg;q=0.7,video/*;q=0.6,*/*;q=0.5";
              case "image": return "image/avif,image/webp,*/*";
              case "video": return "video/webm,video/ogg,video/*;q=0.9,application/ogg;q=0.7,audio/*;q=0.6,*/*;q=0.5";
              default: return null;
            }
          })(mediaType);
          if (acceptValue !== null) {
            setRequestHeader(event.requestHeaders, "Accept", acceptValue);
          }
        }

        resolve({ requestHeaders: event.requestHeaders });
      });
    };

    browser.webRequest.onBeforeSendHeaders.addListener(listener, { urls: [destinationUrl] }, ["blocking", "requestHeaders"]);
  }

  switch(actionType) {
    case "same-tab":
      browser.tabs.update(tab.id, { url: destinationUrl });
      break;
    case "new-foreground-tab":
      browser.tabs.create({ url: destinationUrl, openerTabId: tab.id, active: true });
      break;
    case "new-background-tab":
      browser.tabs.create({ url: destinationUrl, openerTabId: tab.id, active: false });
      break;
    case "new-foreground-window":
      browser.windows.create({ url: destinationUrl, focused: true, incognito: tab.incognito });
      break;
  }
}

// Firefox security policy blocks lot of actions for "privileged urls"
// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/tabs/update#url
// this code jumps through a lot of hoops to get around it by creating and click an achor tag
function processActionViaAnchorClick(info, tab, actionType) {
  function redirectTabToUrl(tabId, url) {
    browser.tabs.executeScript(
      tabId,
      {
        code: "(function () {"
          + "let _nav = document.createElement('a');"
          + "_nav.setAttribute('href', '" + url + "');"
          + "_nav.click();"
          + "}).call();"
      }
    );
  }

  function createListenerToRedirectTabToUrl(tabId, url){
    const listener = function (listenerTabId, changeInfo, tabInfo) {
      if (listenerTabId !== tabId || changeInfo.status !== "complete") return;
      browser.tabs.onUpdated.removeListener(listener);
      redirectTabToUrl(tabId, url);
    };
    browser.tabs.onUpdated.addListener(listener);
  }

  const destinationUrl = info.srcUrl;
  switch(actionType) {
    case "same-tab":
      redirectTabToUrl(tab.id, destinationUrl);
      break;
    case "new-foreground-tab":
      browser.tabs.duplicate(tab.id, { active: true })
        .then(function (newTab) { createListenerToRedirectTabToUrl(newTab.id, destinationUrl); });
      break;
    case "new-background-tab":
      browser.tabs.duplicate(tab.id, { active: false })
        .then(function (newTab) { createListenerToRedirectTabToUrl(newTab.id, destinationUrl); });
      break;
    case "new-foreground-window":
      browser.tabs.duplicate(tab.id, { active: false })
        .then(function (newTab) { 
          browser.windows.create({ tabId: newTab.id, focused: true, incognito: newTab.incognito });
          createListenerToRedirectTabToUrl(newTab.id, destinationUrl);
        });
      break;
  }
}

browser.menus.create({ id: "view-audio-context-menu-item", contexts: ["audio"], title: browser.i18n.getMessage("menuItemViewAudio") });
browser.menus.create({ id: "view-image-context-menu-item", contexts: ["image"], title: browser.i18n.getMessage("menuItemViewImage") });
browser.menus.create({ id: "view-video-context-menu-item", contexts: ["video"], title: browser.i18n.getMessage("menuItemViewVideo") });

applyOptions(window.DEFAULT_OPTIONS);
loadOptionsFromStorage().then((options) => { applyOptions(options); });

browser.menus.onShown.addListener(handleContextMenuShow);
browser.menus.onClicked.addListener(handleContextMenuItemClick);
browser.storage.onChanged.addListener(handleStorageChange);
browser.runtime.onMessage.addListener(loadOptionsFromStorageMessageListener);
