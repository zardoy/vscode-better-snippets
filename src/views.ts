import * as vscode from 'vscode'
import { oneOf } from '@zardoy/utils'
import { CommandHandler, getExtensionContributionsPrefix, getExtensionId, getExtensionSetting, registerExtensionCommand, Settings } from 'vscode-framework'
import { areLangsEquals, normalizeLanguages } from '@zardoy/vscode-utils/build/langs'
import { sort } from 'rambda'
import { RevealSnippetOptions } from './revealSnippetInSettingsJson'
import { CustomSnippet, getSnippetsDefaults } from './extension'
import { Configuration, GeneralSnippet } from './configurationType'

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

type TreeItemWithTreeItems = vscode.TreeItem & { items: vscode.TreeItem[] }

class TreeDataProvider extends BaseTreeDataProvider {
    constructor(private readonly view: ViewType) {
        super()
    }

    getChildrenInner(element: TreeItemWithTreeItems | undefined) {
        if (element) return element.items

        const isTyping = oneOf(this.view, 'betterSnippets.globalSnippets', 'betterSnippets.workspaceTypingSnippets')
        const isLocal = oneOf(this.view, 'betterSnippets.workspaceSnippets', 'betterSnippets.workspaceTypingSnippets')
        const configKey: keyof Settings = isTyping ? 'typingSnippets' : 'customSnippets'

        type TreeProps = {
            label: string
            description: string
            originalIndex: number
        }
        const getTreeItem = ({ label, description, originalIndex }: TreeProps) => {
            const treeItem = new vscode.TreeItem(label)
            treeItem.tooltip = 'Edit snippet'
            treeItem.resourceUri = vscode.Uri.from({ scheme: SCHEME, path: `${configKey}/${isLocal}/${originalIndex}` })
            treeItem.description = description
            //@ts-expect-error for button command
            treeItem.betterSnippets = {
                snippetIndex: originalIndex,
                isTyping,
                level: isLocal ? 'workspace' : 'global',
            } as RevealSnippetOptions
            return treeItem
        }

        const getNormalizedSnippets = (): Array<GeneralSnippet & TreeProps> => {
            const {
                globalValue = [],
                workspaceValue = [],
                workspaceFolderValue = [],
            } = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, null).inspect<any[]>(configKey)!
            const settingValue = isLocal ? [...workspaceValue, ...workspaceFolderValue] : globalValue
            return settingValue.map((snippet, index) => ({
                ...snippet,
                label: snippet.sequence ?? snippet.name,
                originalIndex: index,
                description: (Array.isArray(snippet.body) ? snippet.body.join('\n') : snippet.body).split('\n').join('↵'),
            }))
        }

        const normalizedSnippets = getNormalizedSnippets()

        if (this.grouping === 'none') return normalizedSnippets.map(snippet => getTreeItem(snippet))

        const customSnippetDefaults = getExtensionSetting('customSnippetDefaults')
        const langsSupersets = getExtensionSetting('languageSupersets')
        const snippetDefaults = getSnippetsDefaults()
        const snippetsByLangs: Record<string, typeof normalizedSnippets> = {}
        for (const snippet of normalizedSnippets) {
            // TODO! also normalize to superset
            // if (snippet.when?.languages) {
            //     for (const [superset, langs] of Object.entries(langsSupersets)) {
            //         areLangsEquals(normalizeLanguages(snippet.when.languages), langs)
            //     }
            // }
            const snippetLangs = sort((a, b) => a.localeCompare(b), snippet.when?.languages ?? snippetDefaults.when.languages)
            const langsDisplay = snippetLangs.join(', ')
            if (!snippetsByLangs[langsDisplay]) snippetsByLangs[langsDisplay] = []
            snippetsByLangs[langsDisplay]!.push(snippet)
        }

        return Object.entries(snippetsByLangs).map(([langsDisplay, snippets]) => {
            const treeItem = new vscode.TreeItem(langsDisplay, vscode.TreeItemCollapsibleState.Collapsed) as TreeItemWithTreeItems
            treeItem.items = snippets.map(snippet => getTreeItem(snippet))
            treeItem.description = `(${snippets.length}) ${snippets
                .slice(0, 15)
                .map(snippet => snippet.label)
                .join(', ')}`
            return treeItem
        })
    }
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
            const [configKey, isLocal, originalIndex] = uri.path.split('/')
            return new TextEncoder().encode(getExtensionSetting(configKey! as any)[originalIndex!])
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
            // treeView.message = 'Scanning dependencies'
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
