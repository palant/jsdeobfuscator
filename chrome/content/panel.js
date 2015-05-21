/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;

let beautify_options = {
  indent_size: 2,
  preserve_newlines: false
};

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

  return (url.pathname + url.search) || link;
}

// HACK: Using a string bundle to format a time. Unfortunately, format() function isn't
// exposed in any other way (bug 451360).
var timeFormat = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService)
                           .createBundle("data:text/plain,format=" + encodeURIComponent("%02S:%02S:%02S.%03S"));
function formatTime(time)
{
  date = new Date(time);
  return timeFormat.formatStringFromName("format", [date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()], 4);
}

function addScript(script)
{
  let item = document.getElementById("script-template").cloneNode(true);
  item.removeAttribute("id");
  item.removeAttribute("hidden");
  item.__script = script;

  item.querySelector(".displayName").setAttribute("value", script.displayName);

  let source = item.querySelector(".source");
  source.setAttribute("value", script.source.replace(/\s+/g, " "));
  source.setAttribute("tooltiptext", script.source.substr(0, 100));

  let location = item.querySelector(".location");
  location.setAttribute("value", shortLink(script.url) + ":" + script.line);
  location.setAttribute("tooltiptext", script.url + ":" + script.line);

  item.querySelector(".compileTime").setAttribute("value", formatTime(script.compileTime));

  let list = document.getElementById("list");
  list.appendChild(item);
  if (!list.selectedItem)
    list.selectItem(item);

  document.getElementById("deck").selectedIndex = 1;
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
      script.source = js_beautify(script.source, beautify_options);
      script.beautified = true;
    }
    source = script.source;
  }

  document.getElementById("source").value = source;
}
