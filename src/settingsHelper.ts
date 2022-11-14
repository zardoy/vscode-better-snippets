import * as vscode from 'vscode'
import { findNodeAtLocation, getLocation, getNodeValue, JSONPath, Node, parseTree } from 'jsonc-parser'
import { getExtensionSettingId } from 'vscode-framework'
import { getJsonCompletingInfo, jsonPathEquals, jsonValuesToCompletions } from '@zardoy/vscode-utils/build/jsonCompletions'
import { oneOf } from '@zardoy/utils'
import { uniqBy } from 'lodash'
import { getContributedLangInfo } from './langsUtils'
import { snippetLocation } from './constants'
import { normalizeWhenLangs, snippetsConfig } from './snippet'
import { getConfigValueFromAllScopesObj } from './util'

const getSharedParsingInfo = (document: vscode.TextDocument, position: vscode.Position) => {
    const location = getLocation(document.getText(), document.offsetAt(position))
    const root = parseTree(document.getText())!
    const { path } = location
    const nodeValue = findNodeAtLocation(root, path)?.value
    const jsonCompletingInfo = getJsonCompletingInfo(location, document, position)
    if (!jsonCompletingInfo) return
    const { insideStringRange } = jsonCompletingInfo
    const isAnySnippet = oneOf(path[0], getExtensionSettingId('customSnippets'), getExtensionSettingId('typingSnippets'))
    const isSnippetDefaults = path[0] === getExtensionSettingId('customSnippetDefaults')
    const isAnySnippetOrDefaults = isAnySnippet || isSnippetDefaults || path[0] === getExtensionSettingId('extendsGroups')
    const localPath = isSnippetDefaults ? path.slice(1) : path.slice(2)

    const lastSegment = path.at(-1)
    const isInRegexProp = isAnySnippetOrDefaults && typeof lastSegment === 'string' && lastSegment.includes('Regex')

    return {
        root,
        location,
        path,
        nodeValue,
        insideStringRange,
        isAnySnippet,
        isAnySnippetOrDefaults,
        localPath,
        isInRegexProp,
    }
}

export default () => {
    const selector: vscode.DocumentSelector = { language: 'jsonc', pattern: '**/settings.json', scheme: '*' }
    vscode.languages.registerCompletionItemProvider(
        selector,
        {
            // eslint-disable-next-line complexity
            async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: any, context: any) {
                const root = parseTree(document.getText())!
                const location = getLocation(document.getText(), document.offsetAt(position))
                if (
                    location.isAtPropertyKey &&
                    location.matches([getExtensionSettingId('customSnippets'), '*', '*']) &&
                    location.previousNode!.value.startsWith('$')
                ) {
                    const { offset, length } = location.previousNode!
                    const extendingKeyName = findNodeAtLocation(root, [...location.path.slice(0, -1), 'extends'])?.value
                    if (!extendingKeyName) return
                    // todo support extensions
                    // todo do not suggest used
                    const targetNode = findNodeAtLocation(root, [getExtensionSettingId('extendsGroups'), extendingKeyName])
                    const targetExtendsGroupValue = targetNode && getNodeValue(targetNode)
                    if (!targetExtendsGroupValue) return
                    const complRange = new vscode.Range(document.positionAt(offset + 2), document.positionAt(offset + 2 + length - 3))
                    const collectedExtendsKeys: string[] = []
                    const collectExtendsData = (data: Record<string, any> | undefined | any[]) => {
                        if (typeof data !== 'object') return
                        for (const [, value] of Object.entries(data)) {
                            if (typeof value === 'string') {
                                collectedExtendsKeys.push(...(value.match(/\$\$[\w\d]+/gi)?.map(x => x.slice(2)) ?? []))
                            } else collectExtendsData(value)
                        }
                    }

                    collectExtendsData(targetExtendsGroupValue)
                    return jsonValuesToCompletions(collectedExtendsKeys, complRange)
                }

                const sharedParsingInfo = getSharedParsingInfo(document, position)
                if (!sharedParsingInfo) return
                const { nodeValue, path, insideStringRange, isAnySnippet, isAnySnippetOrDefaults, localPath } = sharedParsingInfo
                if (!insideStringRange) return
                const arrValue: string[] = typeof path.at(-1) === 'number' ? getEditingArrayValue(root, path) : undefined

                if (jsonPathEquals(path, [getExtensionSettingId('languageSupersets'), '*'], true)) {
                    return uniqueCompletions(await getLanguageCompletions(insideStringRange), arrValue)
                }

                if (isAnySnippet && jsonPathEquals(localPath, ['body'])) {
                    // TODO also provide hover
                    const range = document.getWordRangeAtPosition(position, /(?<!\\)\$[A-Z]/)
                    return range && getInsideSnippetBodyCompletions(range)
                }

                if (isAnySnippetOrDefaults) {
                    if (jsonPathEquals(localPath, ['when', 'languages'], true)) {
                        const positiveIncludedLangs = arrValue.filter(x => !x.startsWith('!'))
                        const langsToNegate = nodeValue?.startsWith('!') ? normalizeWhenLangs(positiveIncludedLangs) : undefined

                        const completions = langsToNegate
                            ? [
                                  //   ...supersetsToCompletions(
                                  //       Object.fromEntries(
                                  //           Object.entries(languageSupersets)
                                  //               .filter(([, value]) => {
                                  //                   return value.every(lang => langsToNegate.includes(lang))
                                  //               })
                                  //               .map(([key, value]) => [`!${key}`, value]),
                                  //       ),
                                  //   ),
                                  ...jsonValuesToCompletions(
                                      langsToNegate.map(x => `!${x}`),
                                      insideStringRange,
                                  ).map((c, i) => ({ ...c, sortText: `b${i}` })),
                              ]
                            : [...supersetsToCompletions(), ...(await getLanguageCompletions(insideStringRange))]
                        return uniqueCompletions(completions, arrValue)
                    }

                    if (jsonPathEquals(localPath, ['when', 'locations'], true)) {
                        return uniqueCompletions(
                            jsonValuesToCompletions(
                                snippetLocation.map(loc => (nodeValue?.startsWith('!') ? `!${loc}` : loc)),
                                insideStringRange,
                            ),
                            arrValue,
                        )
                    }

                    if (
                        jsonPathEquals(localPath, ['executeCommand']) ||
                        jsonPathEquals(localPath, ['executeCommand'], true) ||
                        jsonPathEquals(localPath, ['executeCommand', 'command']) ||
                        jsonPathEquals(localPath, ['executeCommand', '*', 'command'])
                    ) {
                        return jsonValuesToCompletions(await vscode.commands.getCommands(true), insideStringRange)
                    }

                    if (jsonPathEquals(localPath, ['extends'])) {
                        return jsonValuesToCompletions(Object.keys(getConfigValueFromAllScopesObj('extendsGroups')))
                    }
                }

                return undefined
            },
        },
        '"',
        '!',
        '$',
    )

    vscode.languages.registerCodeActionsProvider(selector, {
        provideCodeActions(document: vscode.TextDocument, _range: { end: vscode.Position }, context: any, token: any) {
            const sharedParsingInfo = getSharedParsingInfo(document, _range.end)
            if (!sharedParsingInfo) return
            // we don't have code actions, having relation to any range, ideally we should check start = end node
            // if (!_range.start.isEqual(_range.end)) return
            const { root, path, insideStringRange, isAnySnippet, isAnySnippetOrDefaults, localPath, nodeValue, isInRegexProp } = sharedParsingInfo

            if (isAnySnippet && localPath[0] === 'body') {
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

            if (insideStringRange && isAnySnippetOrDefaults && isInRegexProp && nodeValue) {
                return [
                    {
                        title: 'Test with regex101.com',
                        command: 'vscode.open',
                        isPreferred: true,
                        arguments: [`https://regex101.com/?regex=${encodeURIComponent(nodeValue)}&flags=g`],
                    },
                ]
            }

            return undefined
        },
    })

    vscode.languages.registerHoverProvider(selector, {
        provideHover(document: vscode.TextDocument, position: vscode.Position, token: any) {
            const sharedParsingInfo = getSharedParsingInfo(document, position)
            if (!sharedParsingInfo) return
            const { isAnySnippet, localPath, insideStringRange, nodeValue } = sharedParsingInfo
            if (!insideStringRange) return
            let providerResult: vscode.Hover | undefined
            try {
                if (isAnySnippet && jsonPathEquals(localPath, ['when', 'languages'], true) && nodeValue) {
                    const contributedLangInfo = getContributedLangInfo(nodeValue)
                    if (!contributedLangInfo) {
                        providerResult = { contents: ['Unknown language. Probably extension, contributing this language is disabled or not installed'] }
                        return
                    }

                    const lines = [] as Array<vscode.MarkdownString | string>
                    const { sourceExtension, extensions, aliases } = contributedLangInfo
                    if (sourceExtension) {
                        const { id, title } = sourceExtension
                        const markdown = new vscode.MarkdownString(
                            `Source extension: [${title}](command:extension.open?${JSON.stringify(id)})${id.startsWith('vscode.') ? ' (builtin)' : ''}`,
                        )
                        markdown.isTrusted = true
                        lines.push(markdown)
                    }

                    if (aliases.length > 0) lines.push(`Aliases: ${aliases.join(', ')}`)
                    if (extensions.length > 0) lines.push(`File extensions: ${extensions.join(', ')}`)
                    providerResult = { contents: lines }
                    return
                }
            } finally {
                // eslint-disable-next-line no-unsafe-finally
                return providerResult && { range: insideStringRange, ...providerResult }
            }
        },
    })

    vscode.languages.registerDefinitionProvider(selector, {
        provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: any) {
            const sharedParsingInfo = getSharedParsingInfo(document, position)
            if (!sharedParsingInfo) return
            const { root, isAnySnippetOrDefaults, localPath, insideStringRange, nodeValue } = sharedParsingInfo
            if (!insideStringRange) return
            if (isAnySnippetOrDefaults && jsonPathEquals(localPath, ['extends'])) {
                const targetNode = findNodeAtLocation(root, [getExtensionSettingId('extendsGroups'), nodeValue])
                if (!targetNode) return

                const pos = document.positionAt(targetNode.offset)
                const selectionRange = new vscode.Range(pos, pos)
                const locationLink: vscode.DefinitionLink = {
                    targetUri: document.uri,
                    targetRange: selectionRange.with({ end: document.positionAt(targetNode.offset + targetNode.length) }),
                    targetSelectionRange: selectionRange,
                    originSelectionRange: insideStringRange,
                }
                return [locationLink]
            }

            return undefined
        },
    })
}

const getLanguageCompletions = async (range: vscode.Range) => jsonValuesToCompletions(await vscode.languages.getLanguages(), range)

const getInsideSnippetBodyCompletions = (range: vscode.Range) => {
    return jsonValuesToCompletions(['$TM_SELECTED_TEXT', '$TM_CURRENT_LINE', '$TM_CURRENT_WORD', '$CLIPBOARD'], range)
}

function supersetsToCompletions() {
    const { languageSupersets } = snippetsConfig

    return Object.keys(languageSupersets).map(
        (key, index): vscode.CompletionItem => ({
            label: key,
            kind: vscode.CompletionItemKind.Variable,
            sortText: index.toString(),
            detail: languageSupersets[key]!.join(', '),
        }),
    )
}

function getEditingArrayValue(root: Node, path: JSONPath) {
    return getNodeValue(findNodeAtLocation(root, path.slice(0, -1))!)?.filter((_: any, i: any) => i !== path.at(-1))
}

function uniqueCompletions<T extends vscode.CompletionItem>(completions: T[], arrValue: any[] | undefined): T[] {
    let filteredCompletions = uniqBy(completions, ({ label, kind }) => `${label as string}${kind!}`)
    if (arrValue) {
        filteredCompletions = filteredCompletions.filter(({ label }) => !arrValue.includes(label as string))
    }

    return filteredCompletions
}
