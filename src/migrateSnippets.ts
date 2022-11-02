import * as vscode from 'vscode'
import { compact } from '@zardoy/utils'
import { findNodeAtLocation, parse, parseTree, applyEdits, Edit as JsonEdit, modify } from 'jsonc-parser'
import { showQuickPick } from '@zardoy/vscode-utils/build/quickPick'
import { extensionCtx, registerExtensionCommand } from 'vscode-framework'
import { groupBy } from 'rambda'
import { Configuration } from './configurationType'

interface VscodeReadNativeSnippet {
    snippetKey: string

    scope?: string

    prefix: string
    body: string | string[]
    description?: string
    isFileTemplate?: boolean
}

interface NativeSnippetReadFile {
    fileName: string
    uri: vscode.Uri
    contents: string
    snippets: VscodeReadNativeSnippet[]
}

interface NativeSnippetWriteFile {
    uri: vscode.Uri
    contents: string
}

const getNativeSnippetsFiles = async (): Promise<NativeSnippetReadFile[]> => {
    if (vscode.env.appRoot === '') throw new Error('Not supported in virtual environments for now')
    const snippetsFolderPath = vscode.Uri.joinPath(extensionCtx.globalStorageUri, '../../snippets')
    // eslint-disable-next-line no-bitwise, unicorn/no-await-expression-member
    const dirSnippets = (await vscode.workspace.fs.readDirectory(snippetsFolderPath)).filter(([, type]) => type & vscode.FileType.File)
    return compact(
        await Promise.all(
            dirSnippets.map(async ([fileName]) =>
                (async (): Promise<NativeSnippetReadFile | undefined> => {
                    const uri = vscode.Uri.joinPath(snippetsFolderPath, fileName)
                    const contents = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri))
                    const allowedSnippetFileExtensions = ['.code-snippets', '.json']
                    // todo allowedSnippetFileExtensions s
                    if (allowedSnippetFileExtensions.every(ext => !fileName.endsWith(ext))) return
                    const parsed = parse(contents, [], { allowTrailingComma: true }) as Record<string, VscodeReadNativeSnippet>
                    if (typeof parsed !== 'object') return
                    const langId = /(.+)\.json/.exec(fileName)?.[1]
                    const snippets = Object.entries(parsed).map(
                        ([key, snippet]): VscodeReadNativeSnippet => ({
                            ...snippet,
                            snippetKey: key,
                            scope: snippet.scope ?? langId,
                            description: snippet.description ?? key,
                        }),
                    )
                    if (snippets.length === 0) return
                    return {
                        fileName,
                        uri,
                        snippets,
                        contents,
                    }
                })(),
            ),
        ),
    )
}

type BetterSnippet = Configuration['customSnippets'][number]

const vscodeSnippetToBetterSnippet = ({ prefix, body, scope, description, isFileTemplate }: VscodeReadNativeSnippet): BetterSnippet => ({
    name: prefix,
    body,
    description,
    ...(scope || isFileTemplate
        ? {
              when: {
                  // todo shorten
                  languages: scope?.split(','),
                  ...(isFileTemplate
                      ? {
                            locations: ['fileStart'],
                        }
                      : {}),
              },
          }
        : {}),
})

const commentOrRemoveNativeSnippets = async (
    snippets: Array<VscodeReadNativeSnippet & { uri: vscode.Uri; contents: string }>,
    action: 'remove' | 'comment',
) => {
    const snippetsByUri = groupBy(({ uri }) => uri.toString(), snippets)
    for (const [uri, snippets] of Object.entries(snippetsByUri)) {
        const jsonEdits: JsonEdit[] = []
        const { contents } = snippets[0]!
        const root = parseTree(contents, [], { allowTrailingComma: true })!
        for (const snippet of snippets) {
            const node = findNodeAtLocation(root, [snippet.snippetKey])!.parent!
            const { offset, length } = node
            if (action === 'remove') {
                // to not leave empty lines
                const minusOffset = /\n?\r?\s+$/.exec(contents.slice(0, offset))?.[0]?.length ?? 0
                // ofc modify would be better to use here, but it removes existing comments & formatting
                const addLength = /[\n\r\s]+,/.exec(contents.slice(offset + length))?.[0]?.length ?? 0
                jsonEdits.push({
                    offset: offset - minusOffset,
                    length: length + minusOffset + addLength,
                    content: '',
                })
            } else {
                const addLineComment = (pos: number) => {
                    let addPos = pos
                    contents.slice(pos).replace(/^\s*/, str => {
                        addPos += str.length
                        return ''
                    })
                    jsonEdits.push({
                        offset: addPos,
                        length: 0,
                        content: '// ',
                    })
                }

                addLineComment(offset)
                for (let i = offset; i < offset + length; i++) {
                    const char = contents[i]
                    // eslint-disable-next-line max-depth
                    if (char === '\n') {
                        addLineComment(i + 1)
                    }
                }
            }
        }

        if (jsonEdits.length === 0) continue
        // eslint-disable-next-line no-await-in-loop
        await vscode.workspace.fs.writeFile(vscode.Uri.parse(uri), new TextEncoder().encode(applyEdits(contents, jsonEdits)))
    }
}

export const registerSnippetsMigrateCommands = () => {
    registerExtensionCommand('migrateNativeSnippetsToExtension', async (_ /* {}: MigrateFromNativeOptions */) => {
        const availableSnippetFiles = await getNativeSnippetsFiles()
        const snippetFiles = await showQuickPick(
            availableSnippetFiles.map(item => ({
                label: item.fileName,
                description: `${item.snippets.length} snippet(s)`,
                value: item,
            })),
            {
                canPickMany: true,
                initialAllSelected: true,
                title: 'Select snippets files to migrate',
            },
        )
        if (!snippetFiles) return
        const snippetsToMigrate = snippetFiles.flatMap(({ snippets, ...snippetsFile }) => snippets.map(snippet => ({ ...snippet, ...snippetsFile })))
        const nativeSnippets = await showQuickPick(
            snippetsToMigrate.map(item => ({
                label: item.prefix,
                description: item.fileName,
                value: item,
            })),
            {
                canPickMany: true,
                initialAllSelected: true,
                title: 'Select snippets to migrate',
            },
        )
        if (!nativeSnippets) return

        const collectedBetterSnippets: BetterSnippet[] = []
        for (const nativeSnippet of nativeSnippets) {
            collectedBetterSnippets.push(vscodeSnippetToBetterSnippet(nativeSnippet))
        }

        const config = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, null)
        const { globalValue = [] } = config.inspect('customSnippets') ?? {}
        await config.update('customSnippets', [...(globalValue as any[]), ...collectedBetterSnippets], vscode.ConfigurationTarget.Global)

        const action = await vscode.window.showInformationMessage(
            `${collectedBetterSnippets.length} snippets successfully migrated`,
            {
                modal: true,
                detail: "What to do next with native snippets in their files, so they're not duplicated in suggestions widget?",
            },
            { title: 'Do nothing', isCloseAffordance: true },
            { title: 'Comment them' },
            { title: 'Remove them' },
        )
        if (!action) return
        const commentOrRemoveAction = action.title === 'Comment them' ? 'comment' : action.title === 'Remove them' ? 'remove' : undefined
        if (!commentOrRemoveAction) return
        await commentOrRemoveNativeSnippets(nativeSnippets, commentOrRemoveAction)
    })
}
