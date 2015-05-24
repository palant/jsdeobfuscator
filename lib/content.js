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

sendAsyncMessage("jsdeobfuscator@palant.de:ready");

function initDebugger()
{
  let {addDebuggerToGlobal} = Cu.import("resource://gre/modules/jsdebugger.jsm", null);
  let principal = Cc["@mozilla.org/systemprincipal;1"].createInstance(Ci.nsIPrincipal);
  let scope = new Cu.Sandbox(principal);
  addDebuggerToGlobal(scope);

  let dbg = new scope.Debugger();

  function addDebuggee(global)
  {
    dbg.addDebuggee(global);
    for (let i = 0; i < global.frames.length; i++)
      addDebuggee(dbg, global.frames[i]);
  }
  addDebuggee(content);

  dbg.onNewGlobalObject = onGlobal;
  dbg.onNewScript = onScript;
  dbg.onEnterFrame = onEnterFrame;
  return dbg;
}

function destroyDebugger()
{
  removeMessageListener("jsdeobfuscator@palant.de:shutdown", destroyDebugger);

  dbg.removeAllDebuggees();
  dbg.onNewGlobalObject = undefined;
  dbg.onNewScript = undefined;
  dbg.onEnterFrame = undefined;
  dbg = null;
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
    source: script.source.text,
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
