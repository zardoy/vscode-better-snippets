import * as vscode from 'vscode'

export type SnippetLocation = 'fileStart' | 'comment' | 'lineStart' | 'topLineStart' | 'code'

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

export type GeneralSnippet = {
    /**
     * @suggestSortText "2"
     * @defaultSnippets [{
     *   "body": "$1"
     * }]
     */
    body: string | string[]
    /**
     * @suggestSortText "3"
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
         */
        locations?: SnippetLocation[]
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
                          indent: number
                      }
                )
        >
        /**
         * Enable snippet only when following NPM dependencies are installed locally. TODO: implement
         */
        // npmDependencies?: string[]
    }
    /** For JS langs only. How to resolve suggested imports if any */
    resolveImports?: {
        // specifier can be subst only for now
        [importSpecifier: string]: {
            package?: string // = specifier, true = best match
            // export?: string // default or specifier if package is specified
        }
    }
    /** Execute custom command on snippet accept, doesn't work with resolveImports */
    executeCommand?: CommandDefinition /* | CommandDefinition[] */
}

export type Configuration = {
    /**
     * Include builtin JS/MD snippets
     * @default true
     *  */
    enableBuiltinSnippets: boolean
    // builtinSnippetsConfiguratin?: {
    //     postifxes?: {
    //         /** @default true */
    //         normalizeEqeq: boolean
    //     }
    // }
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
     * @suggestSortText betterSnippets.1
     */
    customSnippets: Array<
        GeneralSnippet & {
            /**
             * @suggestSortText !
             */
            name: string
            /** Should be short. Always displayed in completion widget on the same raw as label. */
            description?: string
            /** @deprecated */
            group?: string
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
            /** `commitCharacters` API proxy: An optional set of characters that when pressed while this completion is active will accept it first and then type that character. Note that all commit characters should have length=1 and that superfluous characters will be ignored. */
            commitCharacters?: string[]
            /** @deprecated */
            type?: string
        }
    >
    /**
     * @suggestSortText betterSnippets.2
     */
    typingSnippets: Array<
        GeneralSnippet & {
            /**
             * Snippet will be accepted only after typing THE EXACT sequence of characters on the keyboard. Using arrows or mouse for navigating will reset the sequence (see settings)
             * @suggestSortText !
             */
            sequence: string
        }
    >
    /** @default true */
    typingSnippetsUndoStops: boolean
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
    /** Override default values for every snippet */
    customSnippetDefaults: {
        sortText?: string
        iconType?: SnippetType
        /** @deprecated */
        type?: string
        /** Should be short. Always displayed in completion widget on the same raw as label. Default is 'Better Snippet' */
        description?: string
        /** @deprecated */
        group?: string
        when?: {
            languages?: string[]
            locations?: SnippetLocation[]
            // TODO
            /** Restrict suggesting all snippets (instead of overriding, regexs will be merged) */
            pathRegex?: string
        }
    }
    /**
     * (advanced) After which milliseconds stop observing on diagnostics to resovle snippet's `resolveImports`
     * @default 1500
     */
    diagnosticTimeout: number
    // TODO Try to move to core as it is common to use
    /**
     * Define/change family of languages. You can use family's name instead of language id in when.
     */
    // TODO default is set in prepare.ts
    // * Note that family name can overlap with language id, contributed by other extension. If this is case rename the family or set it to null (in case if family is builtin)
    languageSupersets: { [family: string]: string[] }
    /**
     * Experimental way to disable builtin snippets. Will be removed in future in favor of something else.
     * @uniqueItems true
     *  */
    'experimental.disableBuiltinSnippets': Array<'er' | 'et' | 'em' | 'ef' | 'ed' | 'useParam' | 'ts' | 'tsx' | 'codeblock' | 'dropdown'>
}

export { defaultLanguageSupersets } from '@zardoy/vscode-utils/build/langs.js'
