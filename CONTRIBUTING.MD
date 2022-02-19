<!-- https://github.com/vitest-dev/vitest/blob/main/CONTRIBUTING.md -->
## Better Snippets Contributing Guide

Hi! Thank you so much for contributing to VSCode Better Snippets extension! We are really excited to bring high-end quality extensions and we really appreciate any interest in it!
Let us give you some high-level overview for you.

## Repo Setup

We recommend installing [ni](https://github.com/antfu/ni) to help switching between repos using different package managers. `ni` also provides the handy `nr` command which running npm scripts easier:

- `ni` is equivalent to `pnpm install`
- `nr test` is equivalent to `pnpm run test` (short of `pnpm test`)

<!-- TODO promote npm rapid ready -->

### Start Extension

To start the extension locally for developing:

0. Ensure you have pnpm installed (minimum v6): `npm i -g pnpm`

1. Run `pnpm install` in root folder

2. Run `pnpm start` to build sources in watch mode. After initial build it will open **new VSCode window** with the extension loaded.

- Note, that window will **be reloaded after each build automatically**. Note that each development window reload most probably cause erase of unsaved files/data.
- Most probably, by default, all extensions will be disabled. By doing this you can get faster window reloads. To enable back all other extensions you can either reload window or open workspace (any folder).

### Debug extension

To debug extension follow instructions above (`pnpm start`), then press `F5` in window from where you launched extension to launch `.vscode/launch.json` file.
Then just place breakpoint in the source code (in `src/**`).

### Running Tests

This extension has two type of tests:

#### Unit Tests

They are in `test/unit` and using jest+esbuild, so they are extremely fast. Edit/add tests here in case if they don't require any VSCode integration.

To launch unit tests once run `pnpm jest`. To watch them in watch mode run `pnpm jest -- --watch`.

#### Integration Tests

> In some cases they are also called e2e tests

They are in `test/integration`. This type of tests require integration of VSCode. If you find yourself mocking of `'vscode'` is hard or want to simulate some sequence of user actions, you should add test here.
You don't need to test absolutely every feature of extension, as writing tests here require time. However, instead of doing the same thing on window reload several times, try to write test here and then run `pnpm integration-test:watch`. After running this script, each time when you edit some file in `test/integration`, window with integration tests will be reopened, you will the results in console.
Note that while running this script, you must also keep `pnpm start` running in the background. However, changing a file in `src/`, won't relaunch integration tests. If this is your case, you should edit the script.

Note that running `pnpm test` will launch unit + integration tests.
