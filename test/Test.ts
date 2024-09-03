import Toolbox from 'src/main';

interface Test {
  name: string;
  description: string;
  testFunction: (self: Toolbox, ...args: any[]) => Promise<void> | void;
}

class TestRunner {
  private static instance: TestRunner;
  private tests: Test[] = [];
  private beforeEachHooks: ((self: Toolbox, ...args: any[]) => void | Promise<void>)[] = [];
  private afterEachHooks: ((self: Toolbox, ...args: any[]) => void | Promise<void>)[] = [];

  private constructor() {}

  public static getInstance(): TestRunner {
    if (!TestRunner.instance) {
      TestRunner.instance = new TestRunner();
    }
    return TestRunner.instance;
  }

  public add(name: string, description: string, testFunction: Test['testFunction']) {
    this.tests.push({ name, description, testFunction });
  }

  public beforeEach(hook: (self: Toolbox, ...args: any[]) => void | Promise<void>) {
    this.beforeEachHooks.push(hook);
  }

  public afterEach(hook: (self: Toolbox, ...args: any[]) => void | Promise<void>) {
    this.afterEachHooks.push(hook);
  }

  public async run(self: Toolbox, ...args: any[]) {
    let passed = 0;
    let failed = 0;
    const results: { name: string; description: string; status: string; error?: string }[] = [];

    for (const test of this.tests) {
      try {
        for (const hook of this.beforeEachHooks) {
          await hook(self, ...args);
        }

        await test.testFunction(self, ...args);
        results.push({ name: test.name, description: test.description, status: 'passed' });
        passed++;
      } catch (error) {
        results.push({ name: test.name, description: test.description, status: 'failed', error: (error as Error).message });
        failed++;
      } finally {
        for (const hook of this.afterEachHooks) {
          await hook(self, ...args);
        }
      }
    }

    const total = passed + failed;
    const groupedResults = results.reduce((acc, result) => {
      if (!acc[result.name]) {
        acc[result.name] = [];
      }
      acc[result.name].push(result);
      return acc;
    }, {} as Record<string, { name: string; description: string; status: string; error?: string }[]>);

    console.group('%cTest Results', 'color: blue; font-weight: bold;');

    for (const [name, tests] of Object.entries(groupedResults)) {
      // 将失败的测试用例放到最前面
      tests.sort((a, b) => (a.status === 'failed' ? -1 : 1));

      console.group(`%c${name}`, 'color: purple; font-weight: bold;');
      tests.forEach((test, index) => {
        if (test.status === 'passed') {
          console.log(`%c${index + 1}. ${test.description}`, 'color: green;');
        } else {
          console.group(`%c${index + 1}. ${test.description}`, 'color: red;');
          console.log(`Error: ${test.error}`);
          console.groupEnd();
        }
      });
      console.groupEnd();
    }

    console.log(`%cTests completed: ${passed} passed, ${failed} failed, ${total} total`, 'color: blue; font-weight: bold;');
    console.groupEnd();
  }

  public assertEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
      throw new Error(message || `Expected ${expected} but got ${actual}`);
    }
  }

  public assertNotEqual(actual: any, expected: any, message?: string) {
    if (actual === expected) {
      throw new Error(message || `Expected not ${expected} but got ${actual}`);
    }
  }

  public assertTrue(value: any, message?: string) {
    if (!value) {
      {
        throw new Error(message || `Expected true but got ${value}`);
      }
    }
  }

  public assertFalse(value: any, message?: string) {
    if (value) {
      throw new Error(message || `Expected false but got ${value}`);
    }
  }

  public assertThrows(fn: () => void, message?: string) {
    let threw = false;
    try {
      fn();
    } catch (e) {
      threw = true;
    }
    if (!threw) {
      throw new Error(message || `Expected function to throw an error`);
    }
  }
}

export default TestRunner.getInstance();
