/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const THEME_PREF = "devtools.theme";

const BEAUTIFY_OPTIONS = {
  indent_size: 2,
  preserve_newlines: false
};


// To read & write content to file
const {TextDecoder, TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});

let {Services} = Cu.import("resource://gre/modules/Services.jsm", {});

document.addEventListener("DOMContentLoaded", function()
{
  for (let element of document.querySelectorAll("[_template]"))
  {
    let template = element.getAttribute("_template");
    let child = element.firstElementChild;

    let search1 = "<" + child.localName + ">";
    let index1 = template.indexOf(search1);

    let search2 = "</" + child.localName + ">";
    let index2 = template.indexOf(search2);

    let [pre, label, post] = [template, "", ""];
    if (index1 >= 0 && index2 >= 0 && index1 < index2)
    {
      pre = template.substring(0, index1);
      label = template.substring(index1 + search1.length, index2);
      post = template.substring(index2 + search2.length);
    }

    child.textContent = label;

    while (element.lastChild)
      element.removeChild(element.lastChild);
    element.appendChild(document.createTextNode(pre));
    element.appendChild(child);
    element.appendChild(document.createTextNode(post));
  }
}, false);

function setTarget(target)
{
  let button = document.getElementById("reload");
  button.addEventListener("command", () => target.tab.linkedBrowser.reload(), false);

  let pause = document.getElementById("pause");
  pause.addEventListener("command", () => {
    target.tab.linkedBrowser.messageManager.sendAsyncMessage("jsdeobfuscator@palant.de:togglepaused", null, {
      callback: (paused) => {
        pause.setAttribute("label", pause.getAttribute(paused ? "label-paused" : "label-working"));
      }
    });
  }, false);

  let list = document.getElementById("list");
  list.addEventListener("select", () => selectionUpdated(list), false);

  document.getElementById("clear").addEventListener("command", function(event)
  {
    target.tab.linkedBrowser.messageManager.sendAsyncMessage("jsdeobfuscator@palant.de:clear");
    clearList();
  }, false);

  let search = document.getElementById("search");
  let searchSpacer = document.getElementById("search-spacer");
  search.addEventListener("focus", function()
  {
    search.setAttribute("flex", "1");
    search.removeAttribute("width");
    searchSpacer.removeAttribute("flex");
  }, false);
  search.addEventListener("blur", function()
  {
    if (!search.value.trim())
    {
      search.removeAttribute("flex");
      search.setAttribute("width", "0");
      searchSpacer.setAttribute("flex", "1");
    }
  }, false);
  search.addEventListener("command", function()
  {
    doSearch(search.value);
  }, false);

  document.getElementById("search-command").addEventListener("command", function(event)
  {
    search.focus();
  }, false);
}

function shortLink(link)
{
  let url;
  try
  {
    url = new URL(link);
  }
  catch (e)
  {
    return link;
  }

  if (url.pathname && url.pathname.lastIndexOf("/") < url.pathname.length - 1)
    return url.pathname.substring(url.pathname.lastIndexOf("/") + 1);

  return (url.pathname + url.search) || link;
}

function updateTheme()
{
  let theme = "";
  try
  {
    theme = Services.prefs.getCharPref(THEME_PREF);
  }
  catch (e)
  {
  }

  let className = (theme == "dark" ? "dark-theme" : "light-theme");
  document.documentElement.setAttribute("class", className);
}

updateTheme();
Services.prefs.addObserver(THEME_PREF, updateTheme, false);
window.addEventListener("unload", () => Services.prefs.removeObserver(THEME_PREF, updateTheme), false);

let timeFormatter = new Intl.DateTimeFormat("en", {
  hour12: false,
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit"
}).format;
let millisFormatter = new Intl.NumberFormat("en", {
  useGrouping: false,
  minimumIntegerDigits: 3,
  maximumFractionDigits: 0
}).format;

function formatTime(time)
{
  let date = new Date(time);
  return timeFormatter(date) + "." + millisFormatter(date.getMilliseconds());
}

let items = new Map();

function makeRecorder(path) {
    let items = [];
    let opening = OS.File.open(path,{write: true, append: true});
    let writing = false;
    return function(encoded) {
        if(items.length > 1000) {
            console.warning("Too many items queuing up for write!");
            return;
        }
        items.push(encoded);
        if(writing == false) {
            writing = true;
            opening.then(file => {
                function writeOne() {
                    if(items.length) {
                        file.write(items.pop()).then(derp => {
                            file.flush().then(writeOne);
                        });
                    } else {
                        writing = false;
                    }
                }
            });
        }
    }
}

let record = makeRecorder("jsdeobfuscator.log");
let encoder = new TextEncoder();

function addScript(script)
{
  let item = document.getElementById("script-template").cloneNode(true);
  item.removeAttribute("id");
  item.removeAttribute("hidden");
  item.__script = script;
  items.set(script.id, item);

  let displayName = item.querySelector(".displayName");
  let info = {};
  info.name = script.displayName;
  if (!info.name) {
      info.name = displayName.getAttribute(script.staticLevel == 0 ? "top-level-label" : "anonymous-label");
  }
  displayName.setAttribute("value", ds);

  let source = item.querySelector(".source");
  source.setAttribute("value", script.source.replace(/\s+/g, " ").substr(0, 100));
  info.source = js_beautify(script.source);

  let location = item.querySelector(".location");
  info.location = script.url + ":" + script.line;
  location.setAttribute("value", shortLink(script.url) + ":" + script.line);
  location.setAttribute("tooltiptext", info.location);
  location.addEventListener("click", sourceLinkClicked, false)

  let executed = "execTime" in script;
  item.querySelector(".compileTimeLabel").hidden = executed;
  item.querySelector(".compileTime").hidden = executed;
  item.querySelector(".execTimeLabel").hidden = !executed;
  item.querySelector(".execTime").hidden = !executed;
  if (executed)
    item.querySelector(".execTime").setAttribute("value", formatTime(script.execTime));
  else
    item.querySelector(".compileTime").setAttribute("value", formatTime(script.compileTime));

  let list = document.getElementById("list");
  list.appendChild(item);
  if (!list.selectedItem || !list.selectedItem.parentNode)
    list.selectItem(item);

  document.getElementById("deck").selectedIndex = 1;
  if(script.execTime) {
      record(encoder.encode(
          script.execTime.toString() + "\n" +
              info.name + "\n" +
              info.location + "\n" +
              info.source +
              "\n"));
  }
}

function updateScriptExecTime(id, time)
{
  let item = items.get(id);
  if (!item)
    return;

  let script = item.__script;
  script.execTime = time;
  item.querySelector(".execTime").setAttribute("value", formatTime(script.execTime));

  item.querySelector(".execTimeLabel").hidden = false;
  item.querySelector(".execTime").hidden = false;
}

function clearList()
{
  document.getElementById("deck").selectedIndex = 0;

  let pause = document.getElementById("pause");
  pause.setAttribute("label", pause.getAttribute("label-working"));

  let list = document.getElementById("list");
  while (list.lastChild)
    list.removeChild(list.lastChild);
  items.clear();
}

function doSearch(searchText)
{
  searchText = searchText.trim().replace(/\s+/g, " ");

  let list = document.getElementById("list");
  let firstItem = null;
  for (let item of list.children)
  {
    let script = item.__script;
    if (!searchText || (
        (script.url + ":" + script.line).indexOf(searchText) >= 0 ||
        script.displayName.indexOf(searchText) >= 0 ||
        script.source.trim().replace(/\s+/g, " ").indexOf(searchText) >= 0
    ))
    {
      item.removeAttribute("_filtered");
      if (!firstItem)
        firstItem = item;
    }
    else
      item.setAttribute("_filtered", "true");
  }

  if (!list.selectedItem || list.selectedItem.hasAttribute("_filtered"))
  {
    if (firstItem)
      list.selectedItem = firstItem;
    else
      list.selectedIndex = -1;
  }
}

function selectionUpdated(list)
{
  let item = list.selectedItem;
  let source = "";
  if (item)
  {
    let script = item.__script;
    if (!script.beautified)
    {
      script.source = js_beautify(script.source, BEAUTIFY_OPTIONS);
      script.beautified = true;
    }
    source = script.source;
  }

  document.getElementById("source").value = source;
}

function sourceLinkClicked(event)
{
  if (event.button == 0 || event.button == 1)
  {
    let item = event.target;
    while (item && !("__script" in item))
      item = item.parentNode;

    if (item)
    {
      if (Services.vc.compare(require("info").applicationVersion, "41.0a1") >= 0)
      {
        gViewSourceUtils.viewSource({
          URL: item.__script.url,
          lineNumber: item.__script.line
        });
      }
      else
      {
        // Old gViewSouce API (Gecko 40 and below)
        gViewSourceUtils.viewSource(item.__script.url, null, null, item.__script.line);
      }
    }
  }
}
