window.DEFAULT_OPTIONS = Object.freeze({
    "show-view-image": true,
    "show-view-video": true,
    "override-referer": true,
    "left-click-action": "same-tab",
    "ctrl-left-click-action": "new-foreground-tab",
    "shift-left-click-action": "new-foreground-window",
    "ctrl-shift-left-click-action": "new-background-tab",
    "middle-click-action": "new-background-tab"
  });

function loadOptionsFromStorage() {
  return browser.storage.local.get("options")
    .then((resolve, reject) => {
      const options = resolve.options || {};
      return new Promise((resolve, reject) => {
        Object.keys(window.DEFAULT_OPTIONS).forEach((key) => {
          if(!options.hasOwnProperty(key)) {
            options[key] = window.DEFAULT_OPTIONS[key];
          }
        });
        resolve(options);
      });
    });
}

function createMenuItems() {
  browser.menus.create({
    id: "view-image-context-menu-item",
    contexts: ["image"],
    title: browser.i18n.getMessage("menuItemViewImage")
  });

  browser.menus.create({
    id: "view-video-context-menu-item",
    contexts: ["video"],
    title: browser.i18n.getMessage("menuItemViewVideo")
  });
}

function handleContextMenuShow(info, tab) {
  const isMenuItemRedundant = info.pageUrl === info.srcUrl;
  browser.menus.update(
    "view-image-context-menu-item",
    { visible: !isMenuItemRedundant && window.options["show-view-image"] }
  );
  browser.menus.update(
    "view-video-context-menu-item",
    { visible: !isMenuItemRedundant && window.options["show-view-video"] }
  );
  browser.menus.refresh();
}

function handleContextMenuItemClick(info, tab) {
  if (info.menuItemId != "view-image-context-menu-item" && info.menuItemId != "view-video-context-menu-item") {
    return;
  }

  function getActionOptionType(info) {
    const isMiddleClick = info.button === 1;
    const isShiftModifier = info.modifiers.indexOf("Shift") > -1;
    const isCtrlModifier = info.modifiers.indexOf("Ctrl") > -1;
    let actionTypeOption;
    if (isMiddleClick) {
      return "middle-click-action";
    } else if(isShiftModifier && isCtrlModifier) {
      return "ctrl-shift-left-click-action";
    } else if(isShiftModifier) {
      return "shift-left-click-action";
    } else if(isCtrlModifier) {
      return "ctrl-left-click-action";
    } else {
      return "left-click-action";
    }
  }

  function isFileScheme(url) {
    return url.match(/^file:\/\//gi) !== null;
  }

  const actionType = window.options[getActionOptionType(info)];
  const isLocalFileLink = isFileScheme(info.pageUrl) && isFileScheme(tab.url);

  if(isLocalFileLink) {
    processViewActionLocalFile(info, tab, actionType);
  } else {
    processViewAction(info, tab, actionType);
  }

}

function processViewAction(info, tab, actionType) {
  function getRefererFromInfo(info) {
    return (info.pageUrl.match(/^[^\/]+:\/\/[^\/]+\//g) || [null])[0];
  }

  function interceptRequestAndSetReferer(destinationUrl, refererUrl) {
    const listener = function(event) {
      browser.webRequest.onBeforeSendHeaders.removeListener(listener);
      return new Promise((resolve, reject) => {
        let existingRefererHeader = null;
        for (let header of event.requestHeaders) {
          if (header.name.toLowerCase() === "referer") {
            existingRefererHeader = header;
            break;
          }
        }

        if(existingRefererHeader != null) {
          existingRefererHeader.value = refererUrl;
        } else {
          event.requestHeaders.push({ name: "Referer", value: refererUrl });
        }

        resolve({ requestHeaders: event.requestHeaders });
      });
    };

    browser.webRequest.onBeforeSendHeaders.addListener(
      listener,
      { urls: [destinationUrl] },
      ["blocking", "requestHeaders"]
    );
  }

  function prepareForRequest(info) {
    const destinationUrl = info.srcUrl;
    if (window.options["override-referer"] === true) {
      const refererUrl = getRefererFromInfo(info);
      interceptRequestAndSetReferer(destinationUrl, refererUrl);
    }
    return destinationUrl;
  }

  function doAction(info, tab, actionType){
    const destinationUrl = prepareForRequest(info);
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
        browser.windows.create({ url: destinationUrl, focused: true })
        break;
    }
  }

  doAction(info, tab, actionType);
}

// Firefox security policy blocks most file:// actions, so this code
// jumps through a lot of hoops to get around it
function processViewActionLocalFile(info, tab, actionType) {
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
      if(listenerTabId !== tabId || changeInfo.status !== "complete") {
        return;
      }
      browser.tabs.onUpdated.removeListener(listener);
      redirectTabToUrl(tabId, url);
    };
    browser.tabs.onUpdated.addListener(listener);
  }

  function doAction(info, tab, actionType){
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
            browser.windows.create({ tabId: newTab.id, focused: true });
            createListenerToRedirectTabToUrl(newTab.id, destinationUrl);
          });
        break;
    }
  }

  doAction(info, tab, actionType);
}

function handleStorageChange(changes, areaName){
  if(areaName !== "local" || !changes.options) {
    return;
  }
  processOptions(changes.options.newValue);
}

function processOptions(options) {
  window.options = options;
}

createMenuItems();
processOptions(window.DEFAULT_OPTIONS);
loadOptionsFromStorage().then((options) => { processOptions(options); });
browser.menus.onShown.addListener(handleContextMenuShow);
browser.menus.onClicked.addListener(handleContextMenuItemClick);
browser.storage.onChanged.addListener(handleStorageChange);
