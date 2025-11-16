const { LegacyFakeTimers, ModernFakeTimers } = require('@jest/fake-timers');
const { JestEnvironment } = require('@jest/environment');
const { ModuleMocker } = require('jest-mock');
const vm = require('vm');

class CustomNodeEnvironment {
  constructor(config, context) {
    this.context = vm.createContext();
    this.global = vm.runInContext('this', this.context);
    this.moduleMocker = new ModuleMocker(this.global);
    this.fakeTimers = null;
    this.fakeTimersModern = null;

    // Copy Node globals
    const fromNode = [
      'Buffer',
      'clearInterval',
      'clearTimeout',
      'setInterval',
      'setTimeout',
      'console',
      'process',
      'URL',
      'URLSearchParams',
      'TextEncoder',
      'TextDecoder',
    ];

    for (const nodeGlobal of fromNode) {
      if (global[nodeGlobal]) {
        this.global[nodeGlobal] = global[nodeGlobal];
      }
    }

    // Add global reference
    this.global.global = this.global;

    // Stub localStorage to avoid sql.js issues
    this.global.localStorage = {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
      clear: () => {},
    };
  }

  async setup() {}

  async teardown() {
    this.context = null;
    this.global = null;
  }

  getVmContext() {
    return this.context;
  }

  exportConditions() {
    return ['node', 'node-addons'];
  }
}

module.exports = CustomNodeEnvironment;
