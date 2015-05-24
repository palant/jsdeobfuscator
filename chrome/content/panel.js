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

  let list = document.getElementById("list");
  list.addEventListener("select", () => selectionUpdated(list), false);
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

function addScript(script)
{
  let item = document.getElementById("script-template").cloneNode(true);
  item.removeAttribute("id");
  item.removeAttribute("hidden");
  item.__script = script;

  let displayName = item.querySelector(".displayName");
  if (!script.displayName && script.staticLevel == 0)
    displayName.setAttribute("value", displayName.getAttribute("top-level-label"));
  else
    displayName.setAttribute("value", script.displayName);

  let source = item.querySelector(".source");
  source.setAttribute("value", script.source.replace(/\s+/g, " ").substr(0, 100));

  let location = item.querySelector(".location");
  location.setAttribute("value", shortLink(script.url) + ":" + script.line);
  location.setAttribute("tooltiptext", script.url + ":" + script.line);
  location.addEventListener("click", sourceLinkClicked, false)

  item.querySelector(".compileTime").setAttribute("value", formatTime(script.compileTime));

  let list = document.getElementById("list");
  list.appendChild(item);
  if (!list.selectedItem || !list.selectedItem.parentNode)
    list.selectItem(item);

  document.getElementById("deck").selectedIndex = 1;
}

function clearList()
{
  document.getElementById("deck").selectedIndex = 0;

  let list = document.getElementById("list");
  while (list.lastChild)
    list.removeChild(list.lastChild);
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
