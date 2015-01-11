/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

let {XPCOMUtils} = Cu.import("resource://gre/modules/XPCOMUtils.jsm", null);
let {addDebuggerToGlobal} = Cu.import("resource://gre/modules/jsdebugger.jsm", null);
addDebuggerToGlobal(this);

let {Prefs} = require("prefs");

let dbg = null;
let appDir, profDir;
let executedScripts = {__proto__: null};
let debuggerWasOn = false;
let debuggerOldFlags;
let queue = null;

let paused = false;

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
  let dirServ = Cc["@mozilla.org/file/directory_service;1"].getService(Ci.nsIProperties);
  function getDirURL(key)
  {
    try
    {
      let file = dirServ.get(key, Ci.nsIFile);
      return Services.io.newFileURI(file).spec.toLowerCase().replace(/\/+/g, "/");
    }
    catch (e)
    {
      return null;
    }
  }
  appDir = getDirURL("CurProcD");
  profDir = getDirURL("ProfD");

  updateFiltersUI();

  // Initialize debugger
  dbg = new Debugger();
  dbg.findAllGlobals().map(addGlobal);
  dbg.onNewGlobal = addGlobal;
  dbg.onNewScript = processAction.bind(null, "compiled");
}

function stop()
{
  dbg.removeAllDebuggees();
}

function addGlobal(global)
{
  try
  {
    dbg.addDebuggee(global);
  }
  catch (e)
  {
    // Attempting to debug our own compartment - ignore
  }
}

function updateFiltersUI()
{
  for each (let type in ["include", "exclude"])
  {
    let element = document.getElementById(type + "Filters");
    if (Prefs.filters[type].length)
      element.textContent = Prefs.filters[type].join(", ");
    else
      element.textContent = element.getAttribute("defValue");
  }
}

function checkMatch(fileName, filters)
{
  fileName = fileName.toLowerCase().replace(/\/+/g, "/");
  for each (let filter in filters)
  {
    if (appDir)
      filter = filter.replace(/%APPDIR%/gi, appDir);
    if (profDir)
      filter = filter.replace(/%PROFILEDIR%/gi, profDir);
    filter = filter.toLowerCase().replace(/\/+/g, "/");

    if (fileName.indexOf(filter) == 0)
      return true;
  }
  return false;
}

function processAction(action, script)
{
  if (paused)
    return;

  // For returns accept only known scripts. For other actions check filters.
  if (action == "returned")
  {
    if (!(script.tag in executedScripts))
      return;
  }
  else
  {
    if (Prefs.filters.include.length && !checkMatch(script.url, Prefs.filters.include))
      return;
    if (checkMatch(script.url, Prefs.filters.exclude))
      return;
  }

  if (!queue)
  {
    queue = [];
    setTimeout(processQueue, 100);
  }

  // Get the script source now, it might be gone later :-(
  let source = null;
  if (action == "compiled" || (action == "executed" && !(script.tag in executedScripts)))
    source = script.source.text;

  queue.push([action, script, source, new Date()]);
  if (action == "executed" && !(script.tag in executedScripts))
    executedScripts[script.tag] = null;
}

function processQueue()
{
  let compiledFrame = document.getElementById("compiled-frame").contentWindow;
  let executedFrame = document.getElementById("executed-frame").contentWindow;
  let needScrollCompiled = (compiledFrame.scrollY >= compiledFrame.scrollMaxY - 10);
  let needScrollExecuted = (executedFrame.scrollY >= executedFrame.scrollMaxY - 10);

  let updateNeeded = {__proto__: null};

  let scripts = queue;
  queue = null;
  for each (let [action, script, source, time] in scripts)
  {
    switch (action)
    {
      case "compiled":
      {
        addScript(compiledFrame, script, source, time);
        break;
      }
      case "executed":
      {
        // Update existing entry for known scripts
        let scriptData = (script.tag in executedScripts ? executedScripts[script.tag] : null);
        if (scriptData)
        {
          if (typeof scriptData.executionTime != "undefined")
          {
            if (scriptData.calls != scriptData.returns)
              scriptData.executionTime = undefined;
            else
              scriptData.startTime = time.getTime();
          }
          scriptData.calls++;
          updateNeeded[script.tag] = scriptData;
        }
        else
        {
          executedScripts[script.tag] = {
            entry: addScript(executedFrame, script, source, time),
            source: source,
            startTime: time.getTime(),
            calls: 1,
            returns: 0,
            executionTime: 0
          };
        }
        break;
      }
      case "returned":
      {
        let scriptData = executedScripts[script.tag];
        if (scriptData.startTime)
        {
          scriptData.returns++;
          if (typeof scriptData.executionTime != "undefined")
            scriptData.executionTime += time.getTime() - scriptData.startTime;
          scriptData.startTime = 0;
          updateNeeded[script.tag] = scriptData;
        }
        break;
      }
    }
  }

  for each (let scriptData in updateNeeded)
    updateExecutedScript(scriptData);

  if (needScrollCompiled)
    compiledFrame.scrollTo(compiledFrame.scrollX, compiledFrame.scrollMaxY);
  if (needScrollExecuted)
    executedFrame.scrollTo(executedFrame.scrollX, executedFrame.scrollMaxY);
}

function addScript(frame, script, source, time)
{
  let fileURI = script.url;
  try
  {
    // Debugger service messes up file:/ URLs, try to fix them
    fileURI = Services.io.newURI(fileURI, null, null).spec;
  } catch(e) {}

  let doc = frame.document;

  let template = doc.getElementById("template");
  let entry = template.cloneNode(true);
  entry.removeAttribute("id");
  entry.getElementsByClassName("time")[0].textContent = formatTime(time);
  entry.getElementsByClassName("scriptLine")[0].textContent = script.startLine;
  entry.getElementsByClassName("scriptText")[0].textContent = source;

  let scriptURLNode = entry.getElementsByClassName("scriptURL")[0];
  scriptURLNode.href = scriptURLNode.textContent = fileURI;
  scriptURLNode.lineNum = script.startLine;

  template.parentNode.appendChild(entry);
  return entry;
}

function updateExecutedScript(scriptData)
{
  if (scriptData.returns > 0)
  {
    let entry = scriptData.entry;
    let wnd = entry.ownerDocument.defaultView;

    entry.getElementsByClassName("numCalls")[0].textContent = scriptData.returns;

    let avgTime = entry.getElementsByClassName("avgTime")[0];
    if (typeof scriptData.executionTime != "undefined")
      avgTime.textContent = (scriptData.executionTime / scriptData.returns).toFixed(0);
    else
      avgTime.textContent = avgTime.getAttribute("recursion");

    entry.getElementsByClassName("stats")[0].removeAttribute("style");
  }
}

function clearList()
{
  for each (let frameId in ["compiled-frame", "executed-frame"])
  {
    let doc = document.getElementById(frameId).contentDocument;
    let dummy = doc.getElementById("dummy");
    let range = doc.createRange();
    range.setStartAfter(dummy);
    range.setEndAfter(dummy.parentNode.lastChild);
    range.deleteContents();
  }
  executedScripts = {__proto__: null};
}

// HACK: Using a string bundle to format a time. Unfortunately, format() function isn't
// exposed in any other way (bug 451360).
var timeFormat = Cc["@mozilla.org/intl/stringbundle;1"].getService(Ci.nsIStringBundleService)
                           .createBundle("data:text/plain,format=" + encodeURIComponent("%02S:%02S:%02S.%03S"));
function formatTime(time)
{
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

function updateContext()
{
  for each (let command in ["copy", "selectAll"])
  {
    let enabled = true;
    try
    {
      let controller = document.commandDispatcher.getControllerForCommand("cmd_" + command);
      enabled = (controller && controller.isCommandEnabled("cmd_" + command));
    }
    catch(e)
    {
      Components.utils.reportError(e);
    }

    document.getElementById("context-" + command).setAttribute("disabled", !enabled);
  }

  let linkNode = document.popupNode;
  while (linkNode && !(linkNode instanceof HTMLAnchorElement))
    linkNode = linkNode.parentNode;
  document.getElementById("context-copyLink").setAttribute("disabled", !linkNode);
}

function execCommand(command)
{
  try
  {
    let controller = document.commandDispatcher.getControllerForCommand(command);
    if (controller && controller.isCommandEnabled(command))
      controller.doCommand(command);
  }
  catch(e)
  {
    Components.utils.reportError(e);
  }
}

function selectAll(anchor)
{
  let doc = anchor.ownerDocument;
  let dummy = doc.getElementById("dummy");
  let selection = doc.defaultView.getSelection();

  // Copy command will copy invisible elements, make sure not to select too much
  let range = document.createRange();
  range.selectNodeContents(dummy.parentNode);
  if (dummy.offsetHeight)
    range.setStartBefore(dummy);
  else
    range.setStartAfter(dummy);
  selection.removeAllRanges();
  selection.addRange(range);
}

function handleBrowserClick(event)
{
  if (event.button != 0)
    return;

  event.preventDefault();

  let linkNode = event.target;
  while (linkNode && !(linkNode instanceof HTMLAnchorElement))
    linkNode = linkNode.parentNode;
  if (!linkNode)
    return;

  // viewSourceUtils.js would help but it isn't unusable enough in Firefox 3.0
  window.openDialog("chrome://global/content/viewSource.xul", "_blank", "all,dialog=no", linkNode.href, null, null, linkNode.lineNum, false);
}

function editFilters()
{
  let result = {};
  window.openDialog("editfilters.xul", "_blank", "modal,centerscreen,resizable", Prefs.filters, result);
  if ("include" in result)
  {
    // Save preferences
    Prefs.filters = result;
    updateFiltersUI();
  }
}

function resetFilters()
{
  try
  {
    Services.prefs.clearUserPref("extensions.jsdeobfuscator.filters");
    updateFiltersUI();
  }
  catch(e)
  {
    Components.utils.reportError(e);
  }
}

var scriptHook =
{
  onScriptCreated: function(script)
  {
  },
  onScriptDestroyed: function(script)
  {
  },
  onCall: function(frame, type)
  {
    if (type == Ci.jsdICallHook.TYPE_TOPLEVEL_START || type == Ci.jsdICallHook.TYPE_FUNCTION_CALL)
      processAction("executed", frame.script);
    else if (type == Ci.jsdICallHook.TYPE_TOPLEVEL_END || type == Ci.jsdICallHook.TYPE_FUNCTION_RETURN)
      processAction("returned", frame.script);
  },
  prevScript: null,
  QueryInterface: XPCOMUtils.generateQI([Ci.jsdIScriptHook, Ci.jsdICallHook])
}
