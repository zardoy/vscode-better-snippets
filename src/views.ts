/* eslint-disable no-empty-function */
import * as vscode from 'vscode'
import { oneOf } from '@zardoy/utils'
import {
    CommandHandler,
    getExtensionCommandId,
    getExtensionContributionsPrefix,
    getExtensionSetting,
    registerExtensionCommand,
    Settings,
} from 'vscode-framework'
import { sort } from 'rambda'
import { normalizeLanguages } from '@zardoy/vscode-utils/build/langs'
import { RevealSnippetOptions } from './revealSnippetInSettingsJson'
import { getSnippetsDefaults } from './extension'
import { Configuration, GeneralSnippet } from './configurationType'
import { getAllLangsExtensions } from './langsUtils'

const SCHEME = `${getExtensionContributionsPrefix()}virtualSnippets`

const views = {
    'betterSnippets.globalSnippets': true,
    'betterSnippets.globalTypingSnippets': true,
    'betterSnippets.workspaceSnippets': true,
    'betterSnippets.workspaceTypingSnippets': true,
}
type ViewType = keyof typeof views

abstract class BaseTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    grouping: 'none' | 'language' = 'language'
    hidden = true

    private readonly _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<
        vscode.TreeItem | undefined | void
    >()

    // eslint-disable-next-line @typescript-eslint/member-ordering
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event

    getTreeItem(elem) {
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

type CommonSnippet = Settings['customSnippets'][number] | Settings['typingSnippets'][number]
const getSnippetsSettingValue = (configKey: keyof Configuration, isLocal: boolean) => {
    const {
        globalValue = [],
        workspaceValue = [],
        workspaceFolderValue = [],
    } = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, null).inspect<any[]>(configKey)!
    const settingValue: CommonSnippet[] = isLocal ? [...workspaceValue, ...workspaceFolderValue] : globalValue
    return settingValue
}

type TreeItemWithTreeItems = vscode.TreeItem & { items: vscode.TreeItem[] }

class TreeDataProvider extends BaseTreeDataProvider {
    constructor(private readonly view: ViewType) {
        super()
    }

    getChildrenInner(element: TreeItemWithTreeItems | undefined) {
        if (element) return element.items

        const revealType = getExtensionSetting('snippetsView.editor')

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
            treeItem.description = description
            treeItem.iconPath = new vscode.ThemeIcon('symbol-snippet')
            // eslint-disable-next-line curly
            if (hasBody) {
                treeItem.command =
                    revealType === 'custom'
                        ? {
                              command: 'vscode.open',
                              title: '',
                              arguments: [vscode.Uri.from({ scheme: SCHEME, path: `/${originalIndex}/${isLocal}/${configKey}/${fileName}` })],
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

            // for button command
            // treeItem.betterSnippets = {
            //     snippetIndex: originalIndex,
            //     isTyping,
            //     level: isLocal ? 'workspace' : 'global',
            // } as RevealSnippetOptions

            return treeItem
        }

        const getNormalizedSnippets = (): Array<GeneralSnippet & TreeItemProps> => {
            const handleBody = (body: CommonSnippet['body']) => {
                if (body === undefined) return '<MISSING BODY>'
                if (body === false) return '<ACTION ONLY>'
                return (Array.isArray(body) ? body.join('\n') : body).replaceAll('\n', '↵').replaceAll('\t', '\\t')
            }

            const settingValue = getSnippetsSettingValue(configKey, isLocal)
            return settingValue.map((snippet, index) => {
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

        const normalizedSnippets = getNormalizedSnippets()

        switch (this.grouping) {
            case 'none':
                return normalizedSnippets.map(snippet => getTreeItem(snippet))

            case 'language': {
                const snippetDefaults = getSnippetsDefaults()

                const snippetsByLangs: Record<string, typeof normalizedSnippets> = {}
                for (const snippet of normalizedSnippets) {
                    const snippetLangs = sort((a, b) => a.localeCompare(b), snippet.when?.languages ?? snippetDefaults.when.languages)
                    const langsDisplay = snippetLangs.join(', ')
                    ;(snippetsByLangs[langsDisplay] ??= []).push(snippet)
                }

                return Object.entries(snippetsByLangs).map(([langsDisplay, snippets]) => {
                    const treeItem = new vscode.TreeItem(langsDisplay, vscode.TreeItemCollapsibleState.Collapsed) as TreeItemWithTreeItems
                    treeItem.items = snippets.map(snippet => getTreeItem(snippet))
                    const LIMIT = 15
                    treeItem.description = `(${snippets.length}) ${snippets
                        .slice(0, LIMIT)
                        .map(snippet => snippet.label)
                        .join(', ')}${snippets.length > LIMIT ? '...' : ''}`
                    return treeItem
                })
            }

            default:
                break
        }
    }
}

const parseProviderUriSnippet = (uri: vscode.Uri) => {
    const [originalIndex, isLocal, configKey] = uri.path.split('/').slice(1)
    if (configKey === undefined || isLocal === undefined || originalIndex === undefined) throw new Error('Incorrect URI format for this scheme')
    return { configKey, isLocal, originalIndex }
}

export const registerViews = () => {
    // TODO! index updates!
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
            const { configKey, isLocal, originalIndex } = parseProviderUriSnippet(uri)
            const body = getSnippetsSettingValue(configKey as any, isLocal === 'true')[+originalIndex]?.body
            if (!body) throw new Error(`Snippet ${configKey} with index ${originalIndex} doesn't have valid body`)
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
        writeFile(uri, content) {},
    })

    // #region set language for highlighting
    vscode.window.onDidChangeActiveTextEditor(textEditor => {
        if (!textEditor) return
        const { uri } = textEditor.document
        if (uri.scheme !== SCHEME) return
        const { configKey, isLocal, originalIndex } = parseProviderUriSnippet(uri)
        const snippet = getSnippetsSettingValue(configKey as any, isLocal === 'true')[+originalIndex]
        if (!snippet) return
        const primaryLanguage = (snippet?.when?.languages ?? getSnippetsDefaults().when.languages)[0]
        if (!primaryLanguage) return
        void vscode.languages.setTextDocumentLanguage(textEditor.document, normalizeLanguages(primaryLanguage, getExtensionSetting('languageSupersets'))[0]!)
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
    // registerExtensionCommand('groupBy#extendsGroup', groupByHandler)

    updateGroupingContext('language')
}
