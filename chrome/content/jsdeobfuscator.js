/* ***** BEGIN LICENSE BLOCK *****
 * Version: MPL 1.1
 *
 * The contents of this file are subject to the Mozilla Public License Version
 * 1.1 (the "License"); you may not use this file except in compliance with
 * the License. You may obtain a copy of the License at
 * http://www.mozilla.org/MPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is JavaScript Deobfuscator.
 *
 * The Initial Developer of the Original Code is
 * Wladimir Palant.
 * Portions created by the Initial Developer are Copyright (C) 2009
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * ***** END LICENSE BLOCK ***** */

Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

const debuggerService = Components.classes["@mozilla.org/js/jsd/debugger-service;1"]
                                  .getService(Components.interfaces.jsdIDebuggerService);
var appDir, profDir;
var executedScripts = {__proto__: null};
var debuggerWasOn = false;

function start()
{
  document.getElementById("tabs").addEventListener("select", function(event)
  {
    if (event.target.localName != "tabs")
      return;

    closeFindbar();

    setTimeout(function()
    {
      // Move focus away from tabs when tab selection is switched (idea stolen from dialog.xml)
      let focusedElement = document.commandDispatcher.focusedElement;
      if (focusedElement && focusedElement.localName == "tab")
        document.commandDispatcher.advanceFocusIntoSubtree(focusedElement);
    }, 0);
  }, false)

  // Initialize frames with data: URLs to prevent them from getting chrome privileges
  let request = new XMLHttpRequest();
  request.open("GET", "chrome://jsdeobfuscator/content/scriptList.xhtml", false);
  request.send(null);
  let scriptListURL = "data:text/xml," + encodeURIComponent(request.responseText);
  for each (let frameId in ["compiled-frame", "executed-frame"])
  {
    let frame = document.getElementById(frameId);
    frame.docShell.allowAuth = false;
    frame.docShell.allowImages = false;
    frame.docShell.allowJavascript = false;
    frame.docShell.allowMetaRedirects = false;
    frame.docShell.allowPlugins = false;
    frame.docShell.allowSubframes = false;
    frame.webNavigation.loadURI(scriptListURL, 0, null, null, null);
  }

  // Determine location of profile and application directory (scripts located there shouldn't be shown)
  let ioServ = Components.classes["@mozilla.org/network/io-service;1"]
                         .getService(Components.interfaces.nsIIOService);
  let dirServ = Components.classes["@mozilla.org/file/directory_service;1"]
                          .getService(Components.interfaces.nsIProperties);
  function getDirURL(key)
  {
    try
    {
      let file = dirServ.get(key, Components.interfaces.nsIFile);
      return ioServ.newFileURI(file).spec.toLowerCase().replace(/\/+/g, "/");
    }
    catch (e)
    {
      return null;
    }
  }
  appDir = getDirURL("GreD");
  profDir = getDirURL("ProfD");

  // Initialize debugger
  debuggerService.scriptHook = scriptHook;
  debuggerService.functionHook = scriptHook;
  debuggerService.topLevelHook = scriptHook;
  debuggerWasOn = debuggerService.isOn;
  if (!debuggerWasOn)
    debuggerService.on();
}

function stop()
{
  debuggerService.scriptHook = null;
  debuggerService.functionHook = null;
  debuggerService.topLevelHook = null;
  if (!debuggerWasOn)
    debuggerService.off();
}

function addScript(action, script)
{
  // Ignore chrome scripts and anything executed in browser dir/profile
  let fileName = script.fileName.toLowerCase().replace(/\/+/g, "/");
  if (fileName.indexOf("chrome:/") == 0 ||
      fileName == "xstringbundle" ||  // Why is string bundle code doing such things?
      (appDir && fileName.indexOf(appDir) == 0) ||
      (profDir && fileName.indexOf(profDir) == 0))
  {
    return;
  }

  // Don't show script execution twice
  if (action == "executed")
  {
    if (script.tag in executedScripts)
      return;
    else
      executedScripts[script.tag] = true;
  }

  let frame = document.getElementById(action + "-frame");
  let needScroll = (frame.contentWindow.scrollY == frame.contentWindow.scrollMaxY);

  let doc = document.getElementById(action + "-frame").contentDocument;

  let template = doc.getElementById("template");
  let entry = template.cloneNode(true);
  entry.removeAttribute("id");
  entry.getElementsByClassName("time")[0].textContent = getTime();
  entry.getElementsByClassName("scriptURL")[0].textContent = script.fileName;
  entry.getElementsByClassName("scriptLine")[0].textContent = script.baseLineNumber;
  entry.getElementsByClassName("scriptText")[0].textContent = script.functionSource;
  template.parentNode.appendChild(entry);

  if (needScroll)
    frame.contentWindow.scrollTo(frame.contentWindow.scrollX, frame.contentWindow.scrollMaxY);
}

function clearList()
{
  for each (let frameId in ["compiled-frame", "executed-frame"])
  {
    let dummy = document.getElementById(frameId).contentDocument.getElementById("dummy");
    while (dummy.nextSibling)
      dummy.parentNode.removeChild(dummy.nextSibling);
      
    executedScripts = {__proto__: null};
  }
}

// HACK: Using a string bundle to format a time. Unfortunately, format() function isn't
// exposed in any other way (bug 451360).
var timeFormat = Components.classes["@mozilla.org/intl/stringbundle;1"]
                           .getService(Components.interfaces.nsIStringBundleService)
                           .createBundle("data:text/plain,format=" + encodeURIComponent("%02S:%02S:%02S.%04S"));
function getTime()
{
  let time = new Date();
  return timeFormat.formatStringFromName("format", [time.getHours(), time.getMinutes(), time.getSeconds(), time.getMilliseconds()], 4);
}

function openFindbar()
{
  let tabs = document.getElementById("tabs");
  let selectedPanel = (tabs.selectedPanel.id == "compiled-panel" ? "compiled" : "executed");
  let findbar = document.getElementById(selectedPanel + "-findbar");
  findbar.startFind(findbar.FIND_NORMAL);
}

function closeFindbar()
{
  for each (let id in ["compiled-findbar", "executed-findbar"])
    document.getElementById(id).close();
}

var scriptHook =
{
  onScriptCreated: function(script)
  {
    addScript("compiled", script);
  },
  onScriptDestroyed: function(script)
  {
  },
  onCall: function(frame, type)
  {
    if (type == Components.interfaces.jsdICallHook.TYPE_TOPLEVEL_START || type == Components.interfaces.jsdICallHook.TYPE_FUNCTION_CALL)
      addScript("executed", frame.script);
  },
  QueryInterface: XPCOMUtils.generateQI([Components.interfaces.jsdIScriptHook, Components.interfaces.jsdICallHook])
}
