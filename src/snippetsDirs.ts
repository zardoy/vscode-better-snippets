/* eslint-disable no-await-in-loop */
import * as vscode from 'vscode'
import { load as loadYaml } from 'js-yaml'
import { parseJsoncString } from 'typed-jsonfile/build/parseJsonc'
import { getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { MaybePromise } from 'vscode-framework/build/util'
import { Configuration } from './configurationType'
import { fsExists } from './util'
import { readAllRegisteredLanguages } from './readLanguages'

/** Snippet name for  */
const defaultSnippetName = 'template'

export const registerSnippetsFromDirs = (registerSnippetsCallback: (snippets: Configuration['customSnippets']) => vscode.Disposable[]) => {
    const loadSnippetsFromDir = async () => {
        console.time('Read snippets dir')
        const langsExt = readAllRegisteredLanguages()
        const snippetsDirs = getExtensionSetting('snippetsDirs')
        const { fs, workspaceFolders } = vscode.workspace
        // apply snippetDirs for each workspace in multi-root workspaces
        const loadedSnippets: Configuration['customSnippets'] = []
        const readSnippetsDir = async (snippetsDirUri: vscode.Uri) => {
            if (!(await fsExists(snippetsDirUri, false))) return
            console.time(`Read snippets from dir${snippetsDirUri.path}`)
            // const indexFile = await fs.readFile(vscode.Uri.joinPath(snippetsDirUri, 'snippet'))
            const filesList = await fs.readDirectory(snippetsDirUri)
            for (const [name, fileType] of filesList) {
                // eslint-disable-next-line no-bitwise
                if (fileType & vscode.FileType.Directory) {
                    // TODO change to void
                    await readSnippetsDir(vscode.Uri.joinPath(snippetsDirUri, name))
                    continue
                }

                const [fileName, extension] = name.split('.')
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                const snippetName = fileName || defaultSnippetName
                const resolvedSnippet: Partial<Configuration['customSnippets'][number]> = {
                    name: snippetName,
                    when: {},
                }
                // TODO check source and perf regression
                const primaryLang = Object.entries(langsExt).find(([, [primaryExt]]) => extension === primaryExt)?.[0]
                if (primaryLang) resolvedSnippet.when!.languages = [primaryLang]
                // eslint-disable-next-line unicorn/no-await-expression-member
                const fileContents = (await fs.readFile(vscode.Uri.joinPath(snippetsDirUri, name))).toString()
                // TODO describe it in docs (and reason for that)
                const [commentSequence] = /^(.*?) ?\.snippet/.exec(fileContents) ?? []
                if (commentSequence) {
                    // use smth else
                    const snippetBody = fileContents.split('\n').filter(line => line.startsWith(commentSequence))
                    resolvedSnippet.body = snippetBody
                    // TODO imporve typing
                    loadedSnippets.push(resolvedSnippet as any)
                } else {
                    const snippetMedatata = await loadSnippetMetadataFromFile(vscode.Uri.joinPath(snippetsDirUri, `${name}.snippet`))
                    if (!snippetMedatata) continue
                    Object.assign(resolvedSnippet, snippetMedatata?.metadata)
                    resolvedSnippet.body = fileContents
                    loadedSnippets.push(resolvedSnippet as any)
                }
            }

            console.timeEnd(`Read snippets from dir${snippetsDirUri.path}`)
            return loadedSnippets
        }

        // TODO use Promise.all
        for (const workspaceFolder of workspaceFolders ?? [])
            for (const snippetDir of snippetsDirs) await readSnippetsDir(vscode.Uri.joinPath(workspaceFolder.uri, snippetDir))

        console.timeEnd('Read snippets dir')
        registerSnippetsCallback(loadedSnippets)
    }

    const unregisterSnippets = () =>
        vscode.workspace.onDidChangeConfiguration(({ affectsConfiguration }) => {
            if (affectsConfiguration(getExtensionSettingId('snippetsDirs'))) {
                unregisterSnippets()
                void loadSnippetsFromDir()
            }
        })
    vscode.extensions.onDidChange(() => {
        // enabling or disabling extension can introduce / remove extension for language
        unregisterSnippets()
        void loadSnippetsFromDir()
    })
    void loadSnippetsFromDir()
}

// TODO! check errors
const loadSnippetMetadataFromFile = async (
    snippetBasePath: vscode.Uri,
): Promise<{ metadata: Configuration['customSnippets'][number]; filePath: string } | undefined> => {
    const yamlParser = (content: string, path: string) => loadYaml(content, { filename: path })
    const parsers: Record<string, (content: string, path: string) => MaybePromise<unknown>> = {
        // actually jsonc
        '.json'(content) {
            // TODO test errors here
            return parseJsoncString(content, false)
        },
        '.yml': yamlParser,
        '.yaml': yamlParser,
    }
    // TODO! support loaders
    // const loaders: Record<string, (path: string) => MaybePromise<unknown>> =
    //     process.env.PLATFORM === 'web'
    //         ? {}
    //         : {
    //               // eslint-disable-next-line @typescript-eslint/no-require-imports
    //               '.js': (path: string) => require(path),
    //           }
    for (const [detectExt, parser] of Object.entries(parsers)) {
        const fileUri = snippetBasePath.with({
            path: snippetBasePath.path + detectExt,
        })
        let rawContents: Uint8Array | undefined
        try {
            rawContents = await vscode.workspace.fs.readFile(fileUri)
        } catch {
            // suppose file doesn't exist
            rawContents = undefined
        }

        if (rawContents === undefined) continue
        // in case of parsing error, don't fallback to other extensions
        const result = await parser(rawContents.toString(), fileUri.path)
        return {
            // TODO check
            metadata: result as any,
            filePath: fileUri.path,
        }
    }

    return undefined
}
