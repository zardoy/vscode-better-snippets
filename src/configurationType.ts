import * as vscode from 'vscode'
import { Simplify } from 'type-fest'
import { snippetLocation } from './constants'
// import { SyntaxKind } from 'typescript/lib/tsserverlibrary'

export type SnippetLocation = (typeof snippetLocation)[number]

type CommandDefinition =
    | string
    | {
          command: string
          arguments: any[]
      }

type SnippetType = keyof typeof vscode.CompletionItemKind | number

type TestProp =
    | {
          /**
           * Tests against original string (with whitespaces)
           * @suggestSortText "4"
           */
          testRegex: string
      }
    | {
          /**
           * Tests against trimmed string
           * @suggestSortText "3"
           */
          testString: string
          /**
           * @default "startsWith"
           */
          matchWith?: 'startsWith' | 'includes' | 'endsWith'
      }

type NpmDependency = string | { type: 'dev' | 'prod'; dep: string }

export type GeneralSnippet = {
    /**
     * If `false`:
     * - In custom snippets: body will be used from snippet name
     * - in typing snippets: sequence will not be removed, useful for just executing post actions such as commands
     * @suggestSortText "2"
     * @defaultSnippets [{
     *   "body": "$1"
     * }]
     */
    body: string | string[] | false
    /** @suggestSortText "3" */
    extends?: string
    /**
     * @suggestSortText "4"
     */
    when?: {
        /** Shouldn't be used with `Start` location as snippet would be hidden in that case */
        lineHasRegex?: string
        /** Same as `lineHasRegex`, but the line will be tested from first character till current cursor position */
        lineRegex?: string
        /**
         * Language identifier. Family name from `languageSupersets` can be used instead (e.g. js or react)
         */
        languages?: string[]
        // Unimplemented: inComments. topLineStart means line start without indendation, useful for top-level declaration snippets, like `export const`
        /**
         * Specify to restrict showing suggest in specific location
         * @items "replace-locations-marker"
         */
        locations?: any[]
        pathRegex?: string
        /** Shortcuts for complex path regexs. If specified, `pathRegex` is ignored */
        fileType?: 'package.json' | 'tsconfig.json'
        otherLines?: Array<
            TestProp /*  | { preset: 'function' } */ &
                (
                    | {
                          /**
                           * Which line to pick (relative to current)
                           * @suggestSortText "1"
                           */
                          line: number /*  | number[] */
                          /** @default false */
                          displayIfNoLine?: boolean
                          /** @default false */
                          skipEmptyLines?: boolean
                      }
                    | {
                          // TODO support negative
                          /**
                           * How many levels up of indendation to look? By default 0 - any. Example: `-1`
                           * Currently it is possible to lookup only above (negative number)
                           * @suggestSortText "2"
                           * @default 0
                           * @max 0
                           */
                          indent: number | 'up'
                      }
                )
        >
        /**
         * Enable snippet only when following NPM dependencies are in package.json.
         */
        npmDependencies?: NpmDependency[]
    }
    // ... of **first capture group** from ...
    /**
     * Wether to replace the matched content from `lineBeforeRegex` or `lineRegex` regex check. The first one takes precedence.
     * Works only when end of content is matched (e.g. it will always work if regex ends with `$`)
     * @suggestSortText "z9"
     */
    replaceBeforeRegex?: boolean
    /** For JS langs only. How to resolve suggested imports if any */
    resolveImports?: {
        // specifier can be subst only for now
        [importSpecifier: string]: {
            package?: string // = specifier, true = best match
            // export?: string // default or specifier if package is specified
        }
    }
    /**
     * Execute custom command on snippet accept, doesn't work with resolveImports
     * @defaultSnippets [{
     *   "body": "$1"
     * }]
     */
    executeCommand?: CommandDefinition /* | CommandDefinition[] */
}

export type CustomSnippetUnresolved = GeneralSnippet & {
    /**
     * @suggestSortText !
     */
    name: string
    /** Should be short. Always displayed in completion widget on the right on the same line as label. */
    description?: string
    when?: {
        /**
         * The snippet will be visible only after typing specific character on the keyboard
         * Add '' (empty string) so it'll be visible after regular triggering or typing
         * @length 1
         */
        triggerCharacters?: string[]
    }
    // formatting?: {
    //     /**
    //      * Always insert double quote. Prettier rules. Otherwise always insert single. Default: auto
    //      */
    //     doubleQuotes?: boolean
    //     insertSemicolon?: boolean
    // }
    /** If specified, `iconType` is ignored. It makes sense to use with custom file icon theme */
    fileIcon?: string
    /** If specified, `iconType` and `fileIcon` is ignored. It makes sense to use with custom file icon theme */
    folderIcon?: string
    sortText?: string | null
    iconType?: SnippetType
    /**
     * Only if `when.triggerCharacters` is used
     * @default false
     */
    replaceTriggerCharacter?: boolean
}

export type TypingSnippetUnresolved = GeneralSnippet & {
    /**
     * Snippet will be accepted only after typing THE EXACT sequence of characters on the keyboard. Using arrows or mouse for navigating will reset the sequence (see settings)
     * @suggestSortText !
     */
    sequence: string
    when?: {
        // TODO support in regular snippets and move to GeneralSnippet
        // TODO rewrite snippet example
        /**
         * Recommnded instead of `lineRegex`, tests against what is before current snippet in the line
         * Example:
         * | - cursor, [...] - check position
         * For regular snippet `test` end position is before current word:
         * `[before] test|`, `[before] beforetest|`,
         * Typing snippet: cb
         * `[before]cb|`, `[before ]cb|`,
         */
        lineBeforeRegex?: string
    }
}

export type Configuration = {
    /**
     * Include builtin JS/MD snippets
     * @default true
     *  */
    enableBuiltinSnippets: boolean
    /**
     * Choose the output for useSnippet type:
     * ```ts
     * // generic
     * const params = useParams<'groupId'>()
     * // cast
     * const params = useParams() as { groupId: string }
     * ```
     * [see issue for more](https://github.com/remix-run/react-router/issues/8498)
     * @default cast
     */
    useParamMode: 'generic' | 'cast'
    /**
     * Whether to enable builtin postfix snippets. They may be moved to another extension in future releases
     * @default false */
    enableExperimentalSnippets: boolean
    /**
     * Don't display snippets with locations `fileStart`, `lineStart` and `topLineStart` locations if line after cursor has existing content that doesn't match the name of the snippet
     * @default false
     */
    strictPositionLocations: boolean
    /**
     * Required for the following locations: `code` (which is default), `comment`, `string`
     * @default true
     */
    enableTsPlugin: boolean
    /**
     * Here you can specify reusable parts for your custom & typing snippets
     * The name of group must not contain `:` as its reserved for builtin and extension packs groups
     */
    extendsGroups: {
        [groupName: string]: Partial<
            Omit<CustomSnippetUnresolved, 'name'> & {
                nameOrSequence: string
            }
        >
    }
    /**
     * @suggestSortText betterSnippets.1
     */
    customSnippets: Array<Simplify<CustomSnippetUnresolved>>
    /**
     * @suggestSortText betterSnippets.2
     */
    typingSnippets: Array<Simplify<TypingSnippetUnresolved>>
    // * Which method to use to replace typing sequence with snippet.
    /**
     * What behavior is expected on undo after typing snippet was applied.
     *
     * - sequence-content - preserve sequence content.
     * - no-sequence-content - you'll have no sequence content in editor, but it pushes additional undo stack so you can return to typed sequence with second undo.
     * @default sequence-content
     */
    typingSnippetsUndoBehavior: 'sequence-content' | 'no-sequence-content'
    /**
     * Note that, currently regex are executed against first position only for now!
     * @default true
     *  */
    typingSnippetsEnableMulticursor: boolean
    // /** @default true Ask to which language add snippet, when adding native snippet, otherwise use current */
    // 'nativeSnippetCreator.askLanguageId': boolean
    // /** @default false */
    // 'nativeSnippetCreator.globalSnippetName': false | string
    // /** @default false (for native snippets) Open snippet after its creation */
    // 'nativeSnippetCreator.showSnippetAfterCreation': boolean
    /**
     * Reveal snippet in settings.json after its creation
     * @default true
     * */
    'snippetCreator.showSnippetAfterCreation': boolean
    /**
     * Override default values for every snippet
     * @additionalProperties false
     */
    customSnippetDefaults: {
        sortText?: string
        iconType?: SnippetType
        /** Should be short. Always displayed in completion widget on the right on the same line as label. Default is 'Better Snippet' */
        description?: string
        when?: {
            languages?: string[]
            /**
             * Specify to restrict showing suggest in specific location
             * @items "replace-locations-marker"
             */
            locations?: any[]
            // TODO
            /** Restrict suggesting all snippets (instead of overriding, regexs will be merged) */
            pathRegex?: string
        }
    }
    extensionSnippets: { [extId: string]: false }
    /**
     * (advanced) After which milliseconds stop observing on diagnostics to resovle snippet's `resolveImports`
     * @default 1500
     */
    diagnosticTimeout: number
    // TODO Try to move to core as it is common to use
    /**
     * Define/change family of languages. You can use family's name instead of language id in when.
     */
    // NOTE: default is set in vscode-framework.config.js
    /** Note that family name can overlap with language id, contributed by other extension. If this is case rename the family or set it to null (in case if family is builtin) */
    languageSupersets: { [family: string]: string[] }
    /**
     * Which editing method to use when clicked on the snippet from view
     * @default custom
     */
    // 'snippetsView.editor': 'settingsJson' | 'custom'
    // typescriptLocations: {
    //     [location: string]: {
    //         mode: 'exclude' | 'include'
    //         /** In which enable/disable tokens (final) */
    //         kinds: keyof typeof SyntaxKind
    //     }
    // }
    /**
     * Experimental way to disable builtin snippets. Will be removed in future in favor of something else.
     * @uniqueItems true
     *  */
    'experimental.disableBuiltinSnippets': Array<'er' | 'et' | 'em' | 'ef' | 'ed' | 'useParam' | 'ts' | 'tsx' | 'codeblock' | 'dropdown'>
    /**
     * @uniqueItems
     */
    debugScopes: Array<'resolveImports' | 'snippetsRegexs' | 'snippets'>
}
