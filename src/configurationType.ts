export type Configuration = {
    /**
     * Boolean or object to enable variants of snippets exclusively
     * @default true
     *  */
    enableBuiltinSnippets?:
        | boolean
        | {
              /** @default false */
              postfixes?: boolean
              /** @default false */
              other?: boolean
          }
    // builtinSnippetsConfiguratin?: {
    //     postifxes?: {
    //         /** @default true */
    //         normalizeEqeq: boolean
    //     }
    // }
    customSnippets?: {
        [snippet: string]: {
            body: string
            // formatting?: {
            //     /**
            //      * Always insert double quote. Prettier rules. Otherwise always insert single. Default: auto
            //      */
            //     doubleQuotes?: boolean
            //     insertSemicolon?: boolean
            // }
            when?: {
                /**
                 * Don't specify to enabled in all languages
                 */
                languages?: string[]
                // Unimplemented: inComments. topLineStart means line start without indendation, useful for top-level declaration snippets, like `export const`
                /**
                 * By default displays anywhere, specify to suggest only in following locations
                 */
                locations?: Array<
                    | 'fileStart'
                    | 'inComments'
                    | 'lineStart'
                    | 'stringLiteral'
                    | 'topLineStart'
                    | {
                          afterSymbol?: string
                      }
                >
                /**
                 * Regexp against relative path. Example: tsconfig.json$. TODO: fileTypes top: package.json
                 * tsconfig.json etc
                 */
                pathRegex?: string
                /**
                 * Enable snippet only when following NPM dependencies are installed. TODO: unimplemenetd
                 */
                // npmDependencies?: string[]
            }
        }
    }
}
