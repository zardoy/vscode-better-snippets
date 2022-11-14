# VSCode Better Snippets

## Key Features

It has only a few TypeScript-oriented features, all other features work with other languages as well.

1. Extremely configurable snippets with stunning number of restricting configurations
2. [TS] Not suggesting in strings & comments out of the box
3. [Typing snippets](#typing-snippets)
4. View with convenient editor

> Full web support!

Snippets in VSCode are always contextless, they will be suggested in comments, string, everywhere. You can only restrict them showing only in specific languages, however this extension lets you construct snippets just on another level.

I recommend to use this extension instead of builtin snippets. There is `Better Snippets: Migrate Native Snippets to Extension` command for migrating your native snippets to better snippets.

### Configurable Parts

The main setting for constructing your snippets is `betterSnippets.customSnippets`: **[example usage](./test/snippets.jsonc)**.

#### Filtering

- Snippet Location (e.g. display snippet only in the start of the line or the file). Note that setting location to empty array will make it to display everywhere.
- Specific NPM dependencies are met (e.g. `react`)
- Specific files: filtering the path by regex (for example set `when.fileRegex` to `App.tsx?`)
- Display Snippet only if line the matching the regex (for example set `when.lineRegex` to `\s*const`)
- Display Snippet only if some other line the matching the regex (for example line with indent up matches `function App() {`)

Just because snippets are now aware of context, you can configure them to **always** show on top and/or show them only when exact snippet prefix is typed.

#### Construct

- Snippet Icon (with `iconType`, `fileIcon` or `folderIcon`)
- Snippet Sorting (with `sortText`, you can boost suggestion to top or bottom)
- Placeholders in body from regex props. See [postfix example](test/examples/postfixes.jsonc).

This all can give extreme control for your snippets!

## Builtin Snippets

This extension comes with handy [top-line builtin snippets](src/builtinSnippets.ts) for JS and Markdown languages. They can be disabled.

## Snippet Defaults

This extension comes with some defaults for your snippets.

They are set and configurable via `betterSnippets.customSnippetDefaults` setting.
Some of defaults that important to understand:

- **default location is `code`**. Banned locations:

1. For all languages, location after dot e.g. in `something.mySnippet`.
This was done as in most languages, after the dot you access the property and most probably don't want snippets.

1. For JS/TS langs, also snippets withing comments / strings.

## Typing Snippets

> aka hotstrings from [AutoHotkey](https://www.autohotkey.com/)

You can also define so called typing snippets. Some sequence of *typed letters* will be replaced with snippet, for example:

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

- almost all features from snippets such as `resolveImports` or `when` are supported!
- any cursor movement (using arrows or mouse) will reset the typing sequence, `\n` can't be part of sequence
- they work with multiple selections (in multicursor mode, can be disabled with setting)

## Snippet Features Demo

> Below are demos. See config for these demos above in *example usage*

### Auto Imports

![vscode javascript auto imports](https://user-images.githubusercontent.com/46503702/188254222-64fbf138-de7c-49a0-8237-cf62bf678c57.gif)

## Reuse Snippet Data

You can use `betterSnippets.extendsGroups` setting to extract common snippet data or even by creating your own snippet pack extension!

Example usage of `betterSnippets.extendsGroups`:

```json
"betterSnippets.extendsGroups": {
    "reactUse": {
        "when": {
            "locations": [
                "lineStart"
            ],
            "languages": [
                "react"
            ],
            "otherLines": [
                {
                    "indent": -1,
                    "testRegex": "function|=>|React.FC"
                }
            ]
        }
    }
},
"betterSnippets.customSnippets": [
    {
        "extends": "reactUse",
        "name": "useInitEffect",
        "body": [
            "useEffect(() => {",
            "\t$1",
            "}, []);"
        ],
        "resolveImports": {
            "useEffect": {
                "package": "react"
            }
        },
    },
]
```

You can reuse any custom or typing snippet data in this setting. For reusing name or sequence use `nameOrSequence` property.

With special variables syntax (notice double `$` in extendsGroups):

```json
"betterSnippets.extendsGroups": {
    "reactImport": {
        "resolveImports": {
            "$$FUNC": {
                "package": "$$PACKAGE"
            }
        },
        "when":{
            "npmDependencies": ["$$PACKAGE"]
        }
    }
},
"betterSnippets.customSnippets": [
    {
        "extends": "reactImport",
        "name": "useInitEffect",
        "body": [
            "useEffect(() => {",
            "\t$1",
            "}, []);"
        ],
        "$FUNC": "useEffect",
        "$PACKAGE": "preact"
    },
]
```

### Experimental TS Snippets

Disabled by default, can be enabled with `betterSnippets.enableExperimentalSnippets` setting.
However will be removed (migrated from here) in future releases.

Postfixes:

- `if`: `something === 'here'.if` -> `if (something === 'here')`

Special:

- `useParams` for `react-router`: [demo](https://twitter.com/i/status/1482817282145492993)

## More

More docs coming soon, for now, you can look at [changelog](https://github.com/zardoy/vscode-better-snippets/releases) to see more about features

## Similar Extensions

- [TS/JS postfix completion](https://marketplace.visualstudio.com/items?itemName=ipatalas.vscode-postfix-ts)
- [Module Templates](https://marketplace.visualstudio.com/items?itemName=asbjornh.vscode-module-templates) for creating complex files templates with one command
- Feel free to open PR to add another one!
