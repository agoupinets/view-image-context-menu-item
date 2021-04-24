browser.menus.create({
  id: "view-image-context-menu-item",
  contexts: ["image"],
  title: "View I&mage"
});

browser.menus.onClicked.addListener(function(info, tab) {
  if (info.menuItemId != "view-image-context-menu-item") {
    return;
  }

  const isMiddleClick = info.button === 1;
  const isShiftModifier = info.modifiers.indexOf("Shift") > -1
  const isCtrlModifier = info.modifiers.indexOf("Ctrl") > -1

  function openInSameTab(info, tab) {
    browser.tabs.update(tab.id, { url: info.srcUrl });
  }

  function openInNewForegroundTab(info, tab) {
    browser.tabs.create({ url: info.srcUrl, openerTabId: tab.id, active: true });
  }

  function openInNewBackgroundTab(info, tab) {
    browser.tabs.create({ url: info.srcUrl, openerTabId: tab.id, active: false });
  }

  function openInNewWindow(info, tab) {
    browser.windows.create({ url: info.srcUrl, focused: true });
  }

  if (isMiddleClick) {
    openInNewForegroundTab(info, tab);
  } else if(isShiftModifier && isCtrlModifier) {
    openInNewBackgroundTab(info, tab);
  } else if(isShiftModifier) {
    openInNewWindow(info, tab);
  } else if(isCtrlModifier) {
    openInNewForegroundTab(info, tab);
  } else {
    openInSameTab(info, tab);
  }
});
