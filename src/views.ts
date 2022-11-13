/* eslint-disable no-empty-function */
import * as vscode from 'vscode'
import { oneOf } from '@zardoy/utils'
import { CommandHandler, getExtensionCommandId, getExtensionContributionsPrefix, registerExtensionCommand, Settings } from 'vscode-framework'
import { groupBy, sort } from 'rambda'
import { watchExtensionSettings } from '@zardoy/vscode-utils/build/settings'
import { CommonSnippet, getSnippetsSettingValue, RevealSnippetOptions } from './settingsJsonSnippetCommands'
import { GeneralSnippet } from './configurationType'
import { getSnippetsDefaults, mergeSnippetWithDefaults, normalizeWhenLangs } from './snippet'

const SCHEME = `${getExtensionContributionsPrefix()}virtualSnippets`

const views = {
    'betterSnippets.globalSnippets': true,
    'betterSnippets.globalTypingSnippets': true,
    'betterSnippets.workspaceSnippets': true,
    'betterSnippets.workspaceTypingSnippets': true,
}
type ViewType = keyof typeof views

abstract class BaseTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    grouping: 'none' | 'language' | 'extendsGroup' = 'language'
    hidden = true

    private readonly _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<
        vscode.TreeItem | undefined | void
    >()

    // eslint-disable-next-line @typescript-eslint/member-ordering
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event

    getTreeItem(elem: any) {
        return elem
    }

    refresh() {
        this._onDidChangeTreeData.fire()
    }

    async getChildren(elem: vscode.TreeItem) {
        if (this.hidden) return []

        return this.getChildrenInner(elem)
    }

    abstract getChildrenInner(element: vscode.TreeItem | undefined)
}

type TreeItemWithTreeItems = vscode.TreeItem & { items: vscode.TreeItem[] }

class TreeDataProvider extends BaseTreeDataProvider {
    constructor(private readonly view: ViewType) {
        watchExtensionSettings(['customSnippets', 'customSnippetDefaults', 'typingSnippets', 'languageSupersets'], () => {
            this.refresh()
        })

        super()
    }

    getChildrenInner(element: TreeItemWithTreeItems | undefined) {
        if (element) return element.items

        const revealType = /* getExtensionSetting('snippetsView.editor') ?? */ 'custom'

        const isTyping = oneOf(this.view, 'betterSnippets.globalTypingSnippets', 'betterSnippets.workspaceTypingSnippets')
        const isLocal = oneOf(this.view, 'betterSnippets.workspaceSnippets', 'betterSnippets.workspaceTypingSnippets')
        const configKey: keyof Settings = isTyping ? 'typingSnippets' : 'customSnippets'

        type TreeItemProps = {
            label: string
            description: string
            originalIndex: number
            hasBody: boolean
            fileName: string
        }
        const getTreeItem = ({ label, description, originalIndex, hasBody, fileName }: TreeItemProps) => {
            const treeItem = new vscode.TreeItem(label)
            treeItem.tooltip = 'Edit snippet'
            treeItem.contextValue = 'snippet'
            treeItem.description = description
            treeItem.iconPath = new vscode.ThemeIcon('symbol-snippet')
            if (hasBody) {
                treeItem.command =
                    revealType === 'custom'
                        ? {
                              command: 'vscode.open',
                              title: '',
                              arguments: [vscode.Uri.from({ scheme: SCHEME, path: `/${originalIndex}-${label}/${isLocal}/${configKey}/${fileName}` })],
                          }
                        : {
                              command: getExtensionCommandId('revealSnippetInSettingsJson'),
                              title: '',
                              arguments: [
                                  {
                                      snippetIndex: originalIndex,
                                      isTyping,
                                      level: isLocal ? 'workspace' : 'global',
                                  } as RevealSnippetOptions,
                              ],
                          }
            }

            // @ts-expect-error for menus commands
            treeItem.betterSnippets = {
                snippetIndex: originalIndex,
                isTyping,
                level: isLocal ? 'workspace' : 'global',
            } as RevealSnippetOptions

            return treeItem
        }

        const treeItemWithSnippets = (label: string, snippets: typeof normalizedSnippets) => {
            const treeItem = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Collapsed) as TreeItemWithTreeItems
            treeItem.items = snippets.map(snippet => getTreeItem(snippet))
            const LIMIT = 15
            treeItem.description = `(${snippets.length}) ${snippets
                .slice(0, LIMIT)
                .map(snippet => snippet.label)
                .join(', ')}${snippets.length > LIMIT ? '...' : ''}`
            return treeItem
        }

        const objectToTreeSnippets = (obj: Record<string, typeof normalizedSnippets>) => {
            return Object.entries(obj).map(([displayKey, snippets]) => treeItemWithSnippets(displayKey, snippets))
        }

        const normalizedSnippets = getNormalizedSnippets(configKey, isLocal)

        switch (this.grouping) {
            case 'none':
                return normalizedSnippets.map(snippet => getTreeItem(snippet))

            case 'language': {
                const snippetsByLangs: Record<string, typeof normalizedSnippets> = {}
                for (const snippet of normalizedSnippets) {
                    const snippetLangs = sort((a, b) => {
                        if (a.startsWith('!') && !b.startsWith('!')) return 1
                        if (!a.startsWith('!') && b.startsWith('!')) return -1
                        return a.localeCompare(b)
                    }, snippet.when.languages)
                    const langsDisplay = snippetLangs.join(', ')
                    ;(snippetsByLangs[langsDisplay] ??= []).push(snippet)
                }

                return objectToTreeSnippets(snippetsByLangs)
            }

            case 'extendsGroup': {
                return objectToTreeSnippets(
                    groupBy(snippet => {
                        return (snippet as any).extends ?? 'No extends group'
                    }, normalizedSnippets),
                )
            }

            default:
                break
        }
    }
}

const getNormalizedSnippets = (configKey: keyof Settings, isLocal: boolean) => {
    const handleBody = (body: CommonSnippet['body']) => {
        if (body === undefined) return '<MISSING BODY>'
        if (body === false) return '<ACTION ONLY>'
        return (Array.isArray(body) ? body.join('\n') : body) /* .replaceAll('\n', '↵ ') */
            .replaceAll('\n', ' ')
            .replaceAll('\t', '\\t')
    }

    const settingValue = getSnippetsSettingValue(configKey, isLocal)
    return settingValue
        .map(snippet => mergeSnippetWithDefaults(snippet))
        .map((snippet, index) => {
            const label = 'sequence' in snippet ? snippet.sequence : snippet.name
            return {
                ...snippet,
                label,
                originalIndex: index,
                description: handleBody(snippet.body),
                hasBody: [false, null, undefined].every(x => x !== snippet.body),
                fileName: label,
            }
        })
}

const parseProviderUriSnippet = (uri: vscode.Uri) => {
    const [snippetIndexAndName, isLocal, configKey] = uri.path.split('/').slice(1)
    if (configKey === undefined || isLocal === undefined || snippetIndexAndName === undefined) throw new Error('Incorrect URI format for this scheme')
    const [snippetIndex, snippetName] = snippetIndexAndName.split('-')
    return { configKey, isLocal: isLocal === 'true', snippetIndex: +snippetIndex!, snippetName: snippetName! }
}

export const registerViews = () => {
    vscode.workspace.registerFileSystemProvider(SCHEME, {
        createDirectory() {},
        delete() {},
        onDidChangeFile() {
            return { dispose() {} }
        },
        readDirectory() {
            return []
        },
        readFile(uri) {
            const { configKey, isLocal, snippetIndex } = parseProviderUriSnippet(uri)
            const body = mergeSnippetWithDefaults(getSnippetsSettingValue(configKey as any, isLocal)[snippetIndex]!)?.body
            if (!body && body !== '') throw new Error(`Snippet ${configKey} with index ${snippetIndex} doesn't have valid body (${body})`)
            return new TextEncoder().encode(Array.isArray(body) ? body.join('\n') : body)
        },
        rename() {},
        stat() {
            return { ctime: 0, mtime: 0, size: 0, type: 0 }
        },
        watch() {
            // TODO sync with the settings.json
            return { dispose() {} }
        },
        async writeFile(uri, content) {
            const { configKey, isLocal, snippetIndex, snippetName } = parseProviderUriSnippet(uri)

            const currentSnippets = getSnippetsSettingValue(configKey as any, isLocal)
            const currentSnippet = currentSnippets[snippetIndex]!
            const bodyIsArr = Array.isArray(currentSnippet.body)
            const stringContent = new TextDecoder().decode(content).trimEnd() // trimming end as vscode might have files.insertNewLine enabled
            const currentSnippetName = 'sequence' in currentSnippet ? currentSnippet.sequence : currentSnippet.name
            if (currentSnippetName !== snippetName)
                throw new Error('Editing snippet index has changed or the snippet was removed. Copy contents to the actual snippet')
            await vscode.workspace.getConfiguration(process.env.IDS_PREFIX, null).update(
                configKey,
                currentSnippets.map((s, i) =>
                    i === snippetIndex
                        ? {
                              ...s,
                              body: bodyIsArr ? stringContent.split('\n') : stringContent,
                          }
                        : s,
                ),
                isLocal ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global,
            )
        },
    })

    // #region set language for highlighting
    vscode.window.onDidChangeActiveTextEditor(textEditor => {
        if (!textEditor) return
        const { uri } = textEditor.document
        if (uri.scheme !== SCHEME) return

        const { configKey, isLocal, snippetIndex } = parseProviderUriSnippet(uri)
        const snippet = getSnippetsSettingValue(configKey as any, isLocal)[snippetIndex]
        if (!snippet) return
        const primaryLanguage = (snippet?.when?.languages ?? getSnippetsDefaults().when.languages)[0]
        if (!primaryLanguage) return
        void vscode.languages.setTextDocumentLanguage(textEditor.document, normalizeWhenLangs([primaryLanguage])[0]!)
    })
    // #endregion

    const treeProviders: TreeDataProvider[] = []

    for (const viewId of Object.keys(views)) {
        const treeDataProvider = new TreeDataProvider(viewId)
        const treeView = vscode.window.createTreeView(viewId, {
            treeDataProvider,
            // canSelectMany: true,
            showCollapseAll: true,
        })
        treeView.onDidChangeVisibility(({ visible }) => {
            treeDataProvider.hidden = !visible
            if (!visible) return
            treeDataProvider.hidden = false
            treeDataProvider.refresh()
        })
        treeProviders.push(treeDataProvider)
    }

    const updateGroupingContext = (newValue: string) => {
        void vscode.commands.executeCommand('setContext', 'better-snippets.grouping', newValue)
    }

    const groupByHandler: CommandHandler = ({ command }) => {
        const newGrouping = command.split('#')[1]!
        for (const treeView of treeProviders) {
            treeView.grouping = newGrouping as any
            treeView.refresh()
        }

        updateGroupingContext(newGrouping)
    }

    registerExtensionCommand('groupBy#none', groupByHandler)
    registerExtensionCommand('groupBy#language', groupByHandler)
    registerExtensionCommand('groupBy#extendsGroup', groupByHandler)

    updateGroupingContext('language')
}
