/* @flow */

import {run as buildRun} from './_helpers.js';
import {run as show} from '../../src/cli/commands/show.js';
import {ConsoleReporter, JSONReporter} from '../../src/reporters/index.js';

jasmine.DEFAULT_TIMEOUT_INTERVAL = 90000;

const stream = require('stream');
const path = require('path');

const fixturesLoc = path.join(__dirname, '..', 'fixtures', 'show');
const runShow = buildRun.bind(
  null,
  // silence stderr
  class extends JSONReporter {
    constructor(opts: Object) {
      super({
        ...opts,
        stderr: new stream.Writable({
          write() {},
        }),
      });

      // mock all formatters so we can assert on all of them
      const mockFormat = {};
      Object.keys(this.format).forEach(key => {
        mockFormat[key] = jest.fn(this.format[key]);
      });
      // $FlowFixMe
      this.format = mockFormat;
    }

    info(msg: string) {
      // Overwrite to not interfere with the table output
    }
  },
  fixturesLoc,
  async (args, flags, config, reporter, lockfile, getStdout): Promise<string> => {
    await show(config, reporter, flags, args);
    return getStdout();
  },
);

test.concurrent('throws if lockfile is out of date', (): Promise<void> => {
  const reporter = new ConsoleReporter({});

  return new Promise(async resolve => {
    try {
      await runShow([], {}, 'lockfile-outdated');
    } catch (err) {
      expect(err.message).toContain(reporter.lang('lockfileOutdated'));
    } finally {
      resolve();
    }
  });
});

test.concurrent('works with no arguments', (): Promise<void> => {
  return runShow([], {}, 'no-args', (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);

    expect(json.data.body.length).toBe(1);
    expect(reporter.format.green).toHaveBeenCalledWith('left-pad');
  });
});

test.concurrent('works with single argument', (): Promise<void> => {
  return runShow(['max-safe-integer'], {}, 'single-package', (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);

    expect(json.data.body.length).toBe(1);
    expect(json.data.body[0][0]).toBe('max-safe-integer');
    expect(reporter.format.green).toHaveBeenCalledWith('max-safe-integer');
  });
});

test.concurrent('works with multiple arguments', (): Promise<void> => {
  return runShow(['left-pad', 'max-safe-integer'], {}, 'multiple-packages', (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);

    expect(json.data.body.length).toBe(2);
    expect(json.data.body[0][0]).toBe('left-pad');
    expect(json.data.body[1][0]).toBe('max-safe-integer');
    expect(reporter.format.yellow).toHaveBeenCalledWith('left-pad');
    expect(reporter.format.green).toHaveBeenCalledWith('max-safe-integer');
  });
});

test.concurrent('works with exotic resolvers', (): Promise<void> => {
  return runShow([], {}, 'exotic-resolvers', (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);
    const first = [
      'max-safe-integer',
      '1.0.1',
      'exotic',
      'exotic',
      'dependencies',
      'https://github.com/sindresorhus/max-safe-integer.git',
    ];
    const second = ['yarn', '0.16.2', 'exotic', 'exotic', 'dependencies', 'yarnpkg/yarn'];

    expect(json.data.body.length).toBe(2);
    expect(json.data.body[0]).toEqual(first);
    expect(reporter.format.red).toHaveBeenCalledWith('max-safe-integer');
    expect(json.data.body[1]).toEqual(second);
    expect(reporter.format.red).toHaveBeenCalledWith('yarn');
  });
});

test.concurrent('displays correct dependency types', (): Promise<void> => {
  return runShow([], {}, 'display-dependency-type', (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);
    const {body} = json.data;

    // peerDependencies aren't included in the output
    expect(json.data.body.length).toBe(3);
    expect(body[0][0]).toBe('is-online');
    expect(body[0][4]).toBe('optionalDependencies');
    expect(reporter.format.red).toHaveBeenCalledWith('is-online');
    expect(body[1][0]).toBe('left-pad');
    expect(body[1][4]).toBe('dependencies');
    expect(reporter.format.yellow).toHaveBeenCalledWith('left-pad');
    expect(body[2][0]).toBe('max-safe-integer');
    expect(body[2][4]).toBe('devDependencies');
    expect(reporter.format.green).toHaveBeenCalledWith('max-safe-integer');
  });
});

test.concurrent('shows dependencies from entire workspace', async (): Promise<void> => {
  await runShow([], {}, 'workspaces', (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);

    expect(json.data.body).toHaveLength(4);
    expect(json.data.body[0][0]).toBe('left-pad');
    expect(json.data.body[0][1]).toBe('1.0.0');
    expect(json.data.body[1][0]).toBe('left-pad');
    expect(json.data.body[1][1]).toBe('1.0.1');
    expect(json.data.body[2][0]).toBe('max-safe-integer');
    expect(json.data.body[3][0]).toBe('right-pad');
  });

  const childFixture = {source: 'workspaces', cwd: 'child-a'};
  return runShow([], {}, childFixture, (config, reporter, out): ?Promise<void> => {
    const json: Object = JSON.parse(out);

    expect(json.data.body).toHaveLength(4);
    expect(json.data.body[0][0]).toBe('left-pad');
    expect(json.data.body[0][1]).toBe('1.0.0');
    expect(json.data.body[1][0]).toBe('left-pad');
    expect(json.data.body[1][1]).toBe('1.0.1');
    expect(json.data.body[2][0]).toBe('max-safe-integer');
    expect(json.data.body[3][0]).toBe('right-pad');
  });
});
