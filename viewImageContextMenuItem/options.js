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

function loadOptions() {
  function setSelectedOption(selectId, value){
    document.querySelector(selectId + " > option[value='" + value + "']").selected = true;
  }

  browser.storage.local.get("options").then((res) => {
    const options = res.options || generateDefaultOptions();
    document.querySelector("#show-view-image").checked = options["show-view-image"];
    document.querySelector("#show-view-video").checked = options["show-view-video"];
    document.querySelector("#override-referer").checked = options["override-referer"];
    setSelectedOption("#middle-click-action", options["middle-click-action"]);
    setSelectedOption("#ctrl-left-click-action", options["ctrl-left-click-action"]);
    setSelectedOption("#shift-left-click-action", options["shift-left-click-action"]);
    setSelectedOption("#ctrl-shift-left-click-action", options["ctrl-shift-left-click-action"]);
    setSelectedOption("#left-click-action", options["left-click-action"]);
  }); 
}

function saveOptions(event) {
  const options = {
    "show-view-image": document.querySelector("#show-view-image").checked,
    "show-view-video": document.querySelector("#show-view-video").checked,
    "override-referer": document.querySelector("#override-referer").checked,
    "left-click-action": document.querySelector("#left-click-action").value,
    "ctrl-left-click-action": document.querySelector("#ctrl-left-click-action").value,
    "shift-left-click-action": document.querySelector("#shift-left-click-action").value,
    "ctrl-shift-left-click-action": document.querySelector("#ctrl-shift-left-click-action").value,
    "middle-click-action": document.querySelector("#middle-click-action").value
  };

  browser.storage.local.set({options: options});
  event.preventDefault();
}

document.addEventListener("DOMContentLoaded", loadOptions);
document.querySelector("#options").addEventListener("submit", saveOptions);
