# VSCode Better Snippets

## The Why

It's a TypeScript-oriented extension, however it can also be used with other languages as well.

The main setting is `betterSnippets.customSnippets`: **[example usage](./test/snippets.jsonc)**.

Snippets in VSCode are always contextless, they will be suggested in comments, string, everywhere. You can only restrict them showing only in specific language IDs, however this extension let you can control:

- Snippet Icon (with `iconType`, `fileIcon` or `folderIcon`)
- Snippet Sorting (with `sortText`, you can boost suggestion to top or bottom)
- Snippet Location (e.g. display snippet only in the start of the line or the file)
- Display Snippets only in specific files by filtering the path by regex (for example set `when.fileRegex` to `App.tsx?`)
- Display Snippet only if line matching the regex (for example set `when.lineRegex` to `\s*const`)

This can give extreme control for your snippets.

You can use this extension instead of builtin snippets.

<!-- So, basically I just turned off snippet suggestion by setting `editor.suggest.showSnippets` to `false` and migrated all my snippets to this extension. -->

Just because snippets are now aware of context, you can configure them to **always** show on top and/or show them only when exact snippet prefix is typed.

Also, web is supported.

## Builtin Snippets

This extension comes with handy [top-line builtin snippets](src/builtinSnippets.ts) for JS and Markdown languages. They can be disabled.

## Typing Snippets

> aka hotstrings from [AutoHotkey](https://www.autohotkey.com/)

You can also define so called typing snippets. Some sequence of letter will be replaced with snippet, for example:

`cb ` -> `($1) => $2`

Configuration:

```json
"betterSnippets.typingSnippets": [
    {
        "sequence": "cb ",
        "body":"($1) => $2"
    }
],
```

Note that:

- some features from snippets such as `resolveImports` or `when` clause are supported
- any cursor movement (using arrows or mouse) will reset the typing sequence
- they don't work with multiple selections (when there are multiple cursor in editor)

## TypeScript-only features

### `code` location

By default in all languages `code` locations means any location, except:

- location after dot e.g. disabled in `something.mySnippet`

However, in JS/TS language it also isn't showing in:

- strings

### Experimental Snippets

Disabled by default, enable with `betterSnippets.enableExperimentalSnippets` setting!

Postfixes:

- `if`: `something === 'here'.if` -> `if (something === 'here')`

Special:

- `useParams` for `react-router`: [demo](https://twitter.com/i/status/1482817282145492993)

## More

More docs coming soon, for now, you can look at [changelog](https://github.com/zardoy/vscode-better-snippets/releases) to see more about features

## Similar Extensions

- [TS/JS postfix completion](https://marketplace.visualstudio.com/items?itemName=ipatalas.vscode-postfix-ts)
- [Module Templates](https://marketplace.visualstudio.com/items?itemName=asbjornh.vscode-module-templates) for creating complex templates with one command
- Feel free to open PR to add another one!
