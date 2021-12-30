export type SnippetLocation = 'fileStart' | 'comment' | 'lineStart' | 'topLineStart' | 'code'
// | 'stringLiteral'
// | {
//       afterSymbol?: string
//   }

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
     * Whether to enable builtin postfix snippets. They may be moved to another extension in future releases
     * @default false */
    enableExperimentalSnippets: boolean
    customSnippets: Array<{
        name: string
        // string[] is only for compatibility with builtin snippet, but that usage is deprecated
        body: string | string[]
        group?: string
        // formatting?: {
        //     /**
        //      * Always insert double quote. Prettier rules. Otherwise always insert single. Default: auto
        //      */
        //     doubleQuotes?: boolean
        //     insertSemicolon?: boolean
        // }
        /** For JS langs only. How to resolve suggested imports if any */
        // resolveImports?: {
        //     // specifier can be subst only for now
        //     [importSpecifier: string]: {
        //         package?: string | true // = specifier, true = best match
        //         export?: string // default or specifier if package is specified
        //     }
        // }
        sortText?: string
        type?: string
        when?: {
            /** Shouldn't be used with `Start` location as snippet would be hidden in these cases */
            lineHasRegex?: string
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
    }>
    customSnippetDefaults: {
        sortText?: string
        type?: string
        group?: string
        when?: {
            languages?: string[]
            locations?: SnippetLocation[]
            // TODO
            /** Restrict suggesting all snippets (instead of overriding regexs will be merged) */
            pathRegex?: string
        }
    }
}
