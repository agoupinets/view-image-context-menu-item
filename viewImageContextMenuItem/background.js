function createMenuItems() {
  browser.menus.create({
    id: "view-image-context-menu-item",
    contexts: ["image"],
    title: "View I&mage"
  });

  browser.menus.create({
    id: "view-video-context-menu-item",
    contexts: ["video"],
    title: "View Vid&eo"
  });
}

function handleContextMenuItemClick(info, tab) {
  if (info.menuItemId != "view-image-context-menu-item" && info.menuItemId != "view-video-context-menu-item") {
    return;
  }

  const isMiddleClick = info.button === 1;
  const isShiftModifier = info.modifiers.indexOf("Shift") > -1;
  const isCtrlModifier = info.modifiers.indexOf("Ctrl") > -1;
  let actionTypeOption;
  if (isMiddleClick) {
    actionTypeOption = "middle-click-action";
  } else if(isShiftModifier && isCtrlModifier) {
    actionTypeOption = "ctrl-shift-left-click-action";
  } else if(isShiftModifier) {
    actionTypeOption = "shift-left-click-action";
  } else if(isCtrlModifier) {
    actionTypeOption = "ctrl-left-click-action";
  } else {
    actionTypeOption = "left-click-action";
  }
  const actionType = window.options[actionTypeOption];

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

function generateDefaultOptions() {
  return {
    "show-view-image": true,
    "show-view-video": true,
    "override-referer": true,
    "left-click-action": "same-tab",
    "ctrl-left-click-action": "new-foreground-tab",
    "shift-left-click-action": "new-background-tab",
    "ctrl-shift-left-click-action": "new-foreground-window",
    "middle-click-action": "new-foreground-tab"
  };
}

function loadOptionsFromStorage() {
  browser.storage.local.get("options")
    .then((res) => {
      if(res.options) {
        processOptions(res.options);
      }
    });
}

function handleStorageChange(changes, areaName){
  if(areaName !== "local" || !changes.options) {
    return;
  }
  processOptions(changes.options.newValue);
}

function processOptions(options) {
  window.options = options;
  browser.menus.update(
    "view-image-context-menu-item",
    { visible: window.options["show-view-image"] }
  );
  browser.menus.update(
    "view-video-context-menu-item",
    { visible: window.options["show-view-video"] }
  );
}

createMenuItems();
processOptions(generateDefaultOptions());
loadOptionsFromStorage();
browser.menus.onClicked.addListener(handleContextMenuItemClick);
browser.storage.onChanged.addListener(handleStorageChange);
