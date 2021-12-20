# VSCode Better Snippets

## The Why

Though, it is TypeScript-oriented extension, it can also be used with other languages as well.

The main setting is `betterSnippets.customSnippets`: [example usage](./test/snippets.jsonc).

Snippets in VSCode are always contextless, you can only configure to display them in defined by `scope` language IDs, however this extension you can control snippet:

- Snippet Icon (e.g. set `type`)
- Snippet Sorting (e.g. set `sortText`)
- Snippet Location (e.g. display only in the start of the line)
- Display Snippets only in specific files by filtering the path by regex (for example set `when.fileRegex` to `App.tsx?`)
- Display Snippet only if line matching the regex (for example set `when.lineRegex` to `\s*const`)

This can give more context to your snippets.

You can use this extension instead of builtin snippets.

<!-- So, basically I just turned off snippet suggestion by setting `editor.suggest.showSnippets` to `false` and migrated all my snippets to this extension. -->

Just because snippets are now aware of context, you can configure them to **always** show on top and/or show them only when exact snippet prefix is typed.

## Builtin Snippets

This extension comes with some [top-line builtin snippets](src/builtinSnippets.ts), they can be disabled.

## Experimental Snippets

Can be disabled.

Postfixes:

- `if`: `something === 'here'.if` -> `if (something === 'here')`
