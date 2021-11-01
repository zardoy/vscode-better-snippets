# VSCode Better Snippets

## The Why

1. No Context

Snippets in VSCode are always contextless, you can only configure to display them in defined by `scope` language IDs.

Let's suppose you create

So, basically I just turned off snippet suggestion by setting `editor.suggest.showSnippets` to `false` and migrated all my snippets to this extension.

This extension allows you to define snippets by filtering them by:

- file regex
- cursor location (e.g. start of line/file)
<!-- - TypeScript -->

2. More Control

Just because snippets are now aware of context, you can configure them to **always** show on top and/or show them only when exact snippet prefix is typed.

More information is coming.

## Builtin Snippets

Builtin snippets are totally opinionated, I'll organize (probably migrate from here) in future releases.

Can be disabled.

Postfixes:

- `if`: `something === 'here'.if` -> `if (something === 'here')`
