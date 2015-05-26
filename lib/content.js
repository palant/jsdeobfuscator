/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

const Cc = Components.classes;
const Ci = Components.interfaces;
const Cu = Components.utils;

let scripts = new WeakMap();
let maxId = 0;
let dbg = initDebugger();
addMessageListener("jsdeobfuscator@palant.de:shutdown", destroyDebugger);
addMessageListener("jsdeobfuscator@palant.de:togglepaused", togglePaused);
addEventListener("pagehide", onPageHide, false);

sendAsyncMessage("jsdeobfuscator@palant.de:ready");

function initDebugger()
{
  let {addDebuggerToGlobal} = Cu.import("resource://gre/modules/jsdebugger.jsm", null);
  let principal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
  let scope = new Cu.Sandbox(principal);
  addDebuggerToGlobal(scope);

  let dbg = new scope.Debugger();

  let docShells = docShell.getDocShellEnumerator(Ci.nsIDocShellTreeItem.typeAll, Ci.nsIDocShell.ENUMERATE_FORWARDS);
  while (docShells.hasMoreElements())
  {
    let global = docShells.getNext().QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIDOMWindow);
    dbg.addDebuggee(global);
  }

  dbg.onNewGlobalObject = onGlobal;
  dbg.onNewScript = onScript;
  dbg.onEnterFrame = onEnterFrame;
  return dbg;
}

function destroyDebugger()
{
  removeMessageListener("jsdeobfuscator@palant.de:shutdown", destroyDebugger);
  removeMessageListener("jsdeobfuscator@palant.de:togglepaused", togglePaused);
  removeEventListener("pagehide", onPageHide, false);

  dbg.removeAllDebuggees();
  dbg.onNewGlobalObject = undefined;
  dbg.onNewScript = undefined;
  dbg.onEnterFrame = undefined;
  dbg = null;
}

function togglePaused(message)
{
  if (dbg.onNewScript)
  {
    dbg.onNewScript = undefined;
    dbg.onEnterFrame = undefined;
    message.objects.callback(true);
  }
  else
  {
    dbg.onNewScript = onScript;
    dbg.onEnterFrame = onEnterFrame;
    message.objects.callback(false);
  }
}

function onPageHide(event)
{
  if (event.target == content.document)
    sendAsyncMessage("jsdeobfuscator@palant.de:navigate");
}

function onGlobal(global)
{
  if (global.unsafeDereference().top == content)
    dbg.addDebuggee(global);
}

function notifyNewScript(script, executed)
{
  let id = ++maxId;
  scripts.set(script, id);

  let message = {
    id: id,
    displayName: script.displayName || "",
    url: script.url,
    line: script.startLine,
    source: script.source.text.substr(script.sourceStart, script.sourceLength),
    staticLevel: script.staticLevel
  };
  message[executed ? "execTime" : "compileTime"] = Date.now();

  sendAsyncMessage("jsdeobfuscator@palant.de:newscript", message);
}

function onScript(script, executed)
{
  notifyNewScript(script, false);
}

function onEnterFrame(frame)
{
  let script = frame.script;
  if (!script)
    return;

  let id = scripts.get(script);
  if (id)
    sendAsyncMessage("jsdeobfuscator@palant.de:updatescript", {id: id, execTime: Date.now()});
  else
    notifyNewScript(script, true);
}
