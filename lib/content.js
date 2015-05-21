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
  return dbg;
}

function destroyDebugger()
{
  removeMessageListener("jsdeobfuscator@palant.de:shutdown", destroyDebugger);

  dbg.removeAllDebuggees();
  dbg.onNewGlobalObject = undefined;
  dbg.onNewScript = undefined;
  dbg = null;
}

function onGlobal(global)
{
  if (global.unsafeDereference().top == content)
    dbg.addDebuggee(global);
}

function onScript(script)
{
  let id = ++maxId;
  scripts.set(script, id);

  sendAsyncMessage("jsdeobfuscator@palant.de:newscript", {
    id: id,
    compileTime: Date.now(),
    displayName: script.displayName || "",
    url: script.url,
    line: script.startLine,
    source: script.source.text,
    staticLevel: script.staticLevel
  });
}
