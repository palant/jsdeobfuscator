/*
 * This Source Code is subject to the terms of the Mozilla Public License
 * version 2.0 (the "License"). You can obtain a copy of the License at
 * http://mozilla.org/MPL/2.0/.
 */

// All content scripts run in shared scope before Firefox 33 (see http://bugzil.la/673569)
(function()
{
  const Cc = Components.classes;
  const Ci = Components.interfaces;
  const Cu = Components.utils;

  let wdm = null;
  if ("@mozilla.org/dom/workers/workerdebuggermanager;1" in Cc)
    wdm = Cc["@mozilla.org/dom/workers/workerdebuggermanager;1"].getService(Ci.nsIWorkerDebuggerManager);

  let workerListener = {
    workers: new Map(),

    init: function()
    {
      let workers = wdm.getWorkerDebuggerEnumerator();
      while (workers.hasMoreElements())
        this.onRegister(workers.getNext().QueryInterface(Ci.nsIWorkerDebugger));

      wdm.addListener(this);
    },

    _postMessage: function(message)
    {
      for (let [worker, listener] of this.workers)
      {
        try
        {
          worker.postMessage(message);
        }
        catch (e)
        {
          // Posting messages sometimes produces NS_ERROR_FAILURE even though the worker isn't closed.
          Cu.reportError(e);
        }
      }
    },

    shutdown: function()
    {
      wdm.removeListener(this);

      for (let [worker, listener] of this.workers)
        worker.removeListener(listener);
      this._postMessage("shutdown");

      this.workers = null;
    },

    pause: function(paused)
    {
      this._postMessage(paused ? "pause" : "resume");
    },

    clear: function()
    {
      this._postMessage("clear");
    },

    onRegister: function(worker)
    {
      if (!worker.window || worker.window.top != content)
        return;

      // Map worker's local script IDs to our script IDs
      let ids = new Map();

      let listener = {
        onClose: function()
        {
          workerListener.onUnregister(worker);
        },
        onError: function() {},
        onFreeze: function() {},
        onMessage: function(message)
        {
          message = JSON.parse(message);
          if (message.type == "newscript")
            ids.set(message.id, ++maxId);
          message.id = ids.get(message.id);

          let messageName = "jsdeobfuscator@palant.de:" + message.type;
          delete message.type;
          sendAsyncMessage(messageName, message);
        },
        onThaw: function() {}
      };

      if (worker.isInitialized)
        Cu.reportError("JavaScript Deobfuscator: Failed to attach debugger to a worker, somebody else already did that.");
      else
      {
        try
        {
          worker.initialize("chrome://jsdeobfuscator/content/worker.js");
          if (!dbg.onNewScript)
            worker.postMessage("pause");
          worker.addListener(listener);
          this.workers.set(worker, listener);
        }
        catch (e)
        {
          Cu.reportError("JavaScript Deobfuscator: Failed to attach debugger to a worker, Firefox version is below 39? " + e);
        }
      }
    },

    onUnregister: function(worker)
    {
      let listener = this.workers.get(worker);
      if (listener)
      {
        worker.removeListener(listener);
        this.workers.delete(worker);
      }
    }
  };

  let scripts = new WeakMap();
  let maxId = 0;
  let dbg = initDebugger();
  addMessageListener("jsdeobfuscator@palant.de:shutdown", destroyDebugger);
  addMessageListener("jsdeobfuscator@palant.de:togglepaused", togglePaused);
  addMessageListener("jsdeobfuscator@palant.de:clear", clear);
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

    if (wdm)
      workerListener.init();

    dbg.onNewGlobalObject = onGlobal;
    dbg.onNewScript = onScript;
    dbg.onEnterFrame = onEnterFrame;
    return dbg;
  }

  function destroyDebugger()
  {
    removeMessageListener("jsdeobfuscator@palant.de:shutdown", destroyDebugger);
    removeMessageListener("jsdeobfuscator@palant.de:togglepaused", togglePaused);
    removeMessageListener("jsdeobfuscator@palant.de:clear", clear);
    removeEventListener("pagehide", onPageHide, false);

    dbg.removeAllDebuggees();
    dbg.onNewGlobalObject = undefined;
    dbg.onNewScript = undefined;
    dbg.onEnterFrame = undefined;
    dbg = null;

    if (wdm)
      workerListener.shutdown();
  }

  function togglePaused(message)
  {
    let paused = !!dbg.onNewScript;

    dbg.onNewScript = paused ? undefined : onScript;
    dbg.onEnterFrame = paused ? undefined : onEnterFrame;
    if (wdm)
      workerListener.pause(paused);
    if (message)
      message.objects.callback(paused);
  }

  function clear(message)
  {
    scripts.clear();
    workerListener.clear();

    if (!dbg.onNewScript)
      togglePaused(null);
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
})();
