import * as vscode from 'vscode'
import { findNodeAtLocation, getLocation, getNodeValue, Location, parseTree } from 'jsonc-parser'
import { getExtensionSetting, getExtensionSettingId } from 'vscode-framework'
import { getJsonCompletingInfo, jsonPathEquals, jsonValuesToCompletions } from '@zardoy/vscode-utils/build/jsonCompletions'
import { oneOf } from '@zardoy/utils'
import { snippetLocation } from './configurationType'

export default () => {
    const selector = { language: 'jsonc', pattern: '**/settings.json' }
    vscode.languages.registerCompletionItemProvider(
        selector,
        {
            async provideCompletionItems(document, position, token, context) {
                const location = getLocation(document.getText(), document.offsetAt(position))
                const root = parseTree(document.getText())!
                const { path } = location
                const jsonCompletingInfo = getJsonCompletingInfo(location, document, position)
                if (!jsonCompletingInfo) return
                const { insideStringRange } = jsonCompletingInfo
                if (insideStringRange) {
                    if (jsonPathEquals(path, [getExtensionSettingId('languageSupersets'), '*'], true)) {
                        return getLanguageCompletions(insideStringRange)
                    }

                    // TODO defaults suggestions!
                    if (oneOf(path[0], getExtensionSettingId('customSnippets'), getExtensionSettingId('typingSnippets'))) {
                        const localPath = path.slice(2)
                        if (jsonPathEquals(localPath, ['body'])) {
                            // TODO also provide hover
                            const range = document.getWordRangeAtPosition(position, /(?<!\\)\$[A-Z]/)
                            return range && getInsideSnippetBodyCompletions(range)
                        }

                        if (jsonPathEquals(localPath, ['when', 'languages'], true)) {
                            const languageSupersets = getExtensionSetting('languageSupersets')
                            return [
                                Object.keys(languageSupersets).map(
                                    (key, index): vscode.CompletionItem => ({
                                        label: key,
                                        kind: vscode.CompletionItemKind.Variable,
                                        sortText: index.toString(),
                                        detail: languageSupersets[key]!.join(', '),
                                    }),
                                ),
                                ...(await getLanguageCompletions(insideStringRange)),
                            ].flat(1)
                        }

                        if (jsonPathEquals(localPath, ['when', 'locations'], true)) {
                            const value = findNodeAtLocation(root, path)?.value
                            return jsonValuesToCompletions(
                                snippetLocation.map(loc => (value?.startsWith('!') ? `!${loc}` : loc)),
                                insideStringRange,
                            )
                        }

                        // TODO it suggests in arg!
                        if (
                            jsonPathEquals(localPath, ['executeCommand']) ||
                            jsonPathEquals(localPath, ['executeCommand'], true) ||
                            jsonPathEquals(localPath, ['executeCommand', 'command']) ||
                            jsonPathEquals(localPath, ['executeCommand', '*', 'command'])
                        ) {
                            return jsonValuesToCompletions(await vscode.commands.getCommands(true), insideStringRange)
                        }
                    }
                }

                return undefined
            },
        },
        '"',
    )

    vscode.languages.registerCodeActionsProvider(selector, {
        provideCodeActions(document, _range, context, token) {
            const position = _range.end
            const location = getLocation(document.getText(), document.offsetAt(position))
            const root = parseTree(document.getText())!
            const { path } = location
            const jsonCompletingInfo = getJsonCompletingInfo(location, document, position)
            if (!jsonCompletingInfo) return
            if (oneOf(path[0], getExtensionSettingId('customSnippets'), getExtensionSettingId('typingSnippets'))) {
                const localPath = path.slice(2)
                if (localPath[0] === 'body') {
                    const node = findNodeAtLocation(root, path.slice(0, 3))!
                    const nodeRange = new vscode.Range(document.positionAt(node.offset), document.positionAt(node.offset + node.length))
                    const value = getNodeValue(node)
                    const escapeChars = (str: string) => str.replaceAll('"', '\\"').replaceAll('\t', '\\t').replaceAll('\n', '\\n')
                    const edit = new vscode.WorkspaceEdit()
                    if (node.type === 'array') {
                        edit.replace(document.uri, nodeRange, `"${value.map(escapeChars).join('\\n')}"`)
                        return [{ title: 'Transform to string', edit }]
                    }

                    if (node.type === 'string') {
                        // TODO formatting!
                        edit.replace(
                            document.uri,
                            nodeRange,
                            `[\n${escapeChars(value)
                                .split('\\n')
                                .map(str => `${'\t'.repeat(5)}"${str}",\n`)
                                .join('')}${'\t'.repeat(4)}]`,
                        )
                        return [{ title: 'Transform to array', edit }]
                    }
                }
            }

            return undefined
        },
    })
}

const getLanguageCompletions = async (range: vscode.Range) => jsonValuesToCompletions(await vscode.languages.getLanguages(), range)

const getInsideSnippetBodyCompletions = (range: vscode.Range) =>
    jsonValuesToCompletions(['$TM_SELECTED_TEXT', '$TM_CURRENT_LINE', '$TM_CURRENT_WORD', '$CLIPBOARD'], range)
