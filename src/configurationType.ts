import * as vscode from 'vscode'

export type SnippetLocation = 'fileStart' | 'comment' | 'lineStart' | 'topLineStart' | 'code'

type CommandDefinition =
    | string
    | {
          command: string
          arguments: any[]
      }

type SnippetType = keyof typeof vscode.CompletionItemKind | number

export type GeneralSnippet = {
    body: string | string[]
    /** Execute custom command on snippet accept, doesn't work with resolveImports */
    executeCommand?: CommandDefinition /* | CommandDefinition[] */
    /** For JS langs only. How to resolve suggested imports if any */
    resolveImports?: {
        // specifier can be subst only for now
        [importSpecifier: string]: {
            package?: string // = specifier, true = best match
            // export?: string // default or specifier if package is specified
        }
    }
    when?: {
        /** Shouldn't be used with `Start` location as snippet would be hidden in that case */
        lineHasRegex?: string
        /** Same as `lineHasRegex`, but the line will be tested from first character till current cursor position */
        lineRegex?: string
        /**
         * Language identifier. Special ones: styles (css, scss...), js (js, ts, jsx, tsx)
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
        /**
         * Enable snippet only when following NPM dependencies are installed locally. TODO: implement
         */
        // npmDependencies?: string[]
    }
}

export type Configuration = {
    /**
     * Include builtin JS snippets
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
    customSnippets: Array<
        GeneralSnippet & {
            name: string
            /** Displayed in completion widget */
            description: string
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
            /** @deprecated */
            type?: string
        }
    >
    typingSnippets: Array<
        GeneralSnippet & {
            /** Snippet will be accepted only after typing THE EXACT sequence of characters on the keyboard. Using arrows or mouse for navigating will reset the sequence (see settings) */
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
    /** @default false Open snippet after its creation */
    'snippetCreator.showSnippetAfterCreation': boolean
    customSnippetDefaults: {
        sortText?: string
        iconType?: SnippetType
        /** @deprecated */
        type?: string
        /** Displayed in completion widget */
        description: string
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
}
