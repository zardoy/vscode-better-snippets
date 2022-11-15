import * as vscode from 'vscode'
import { showQuickPick } from '@zardoy/vscode-utils/build/quickPick'
import { getExtensionSetting, getExtensionSettingId, registerExtensionCommand, VSCodeQuickPickItem } from 'vscode-framework'
import { compact } from '@zardoy/utils'
import { CustomSnippetUnresolved, TypingSnippetUnresolved } from './configurationType'
import { getAllExtensionSnippets, mergeSnippetWithDefaults } from './snippet'
import { getConfigValueFromAllScopes } from './util'

export default () => {
    registerExtensionCommand('showAllResolvedSnippets', async () => {
        // todo reuse getters from views.ts
        const customUser = (getConfigValueFromAllScopes('customSnippets') as CustomSnippetUnresolved[]).map(snippet => mergeSnippetWithDefaults(snippet))
        const typingUser = (getConfigValueFromAllScopes('typingSnippets') as TypingSnippetUnresolved[]).map(snippet => mergeSnippetWithDefaults(snippet))

        const customExt = getAllExtensionSnippets('customSnippets')
        const typingExt = getAllExtensionSnippets('typingSnippets')

        let content = ''

        let isFirstRegion = true
        const addRegion = (label: string, jsonContent: any[]) => {
            if (!isFirstRegion) content += `\n// #${''}endregion\n`
            content += `// #${''}region ${label}\n${JSON.stringify(jsonContent, undefined, 4)},`
            isFirstRegion = false
        }

        addRegion('custom user', customUser)
        addRegion('typing user', typingUser)

        // todo show per ext id!
        addRegion('custom from packs', customExt)
        addRegion('typing from packs', typingExt)

        const document = await vscode.workspace.openTextDocument({
            content,
            language: 'jsonc',
        })
        await vscode.window.showTextDocument(document)
    })

    registerExtensionCommand('copySnippetsFromSettingsJson', async () => {
        const configurationKey = await showQuickPick((['customSnippets', 'typingSnippets'] as const).map(x => ({ label: x, value: x })))
        if (!configurationKey) return
        const snippetsSettingValue = getExtensionSetting(configurationKey)
        const selectedSnippetsToShare = await showQuickPick(
            snippetsSettingValue.map(snippet => {
                const name: string = ('name' in snippet ? snippet.name : snippet.sequence) ?? snippet.extends
                return {
                    label: name,
                    value: snippet,
                    description: compact([snippet.extends, snippet.body]).join(' '),
                }
            }),
            {
                canPickMany: true,
                matchOnDescription: true,
            },
        )
        if (!selectedSnippetsToShare) return
        const extendsGroupsToInclude = {}
        for (const { extends: extendsGroup } of selectedSnippetsToShare) {
            if (!extendsGroup) continue
            const addExtendsGroup = getExtensionSetting('extendsGroups')[extendsGroup]
            if (!addExtendsGroup) continue
            extendsGroupsToInclude[extendsGroup] = addExtendsGroup
        }

        const rootObjectToCopy: Record<string, any> = {
            [getExtensionSettingId(configurationKey)]: selectedSnippetsToShare,
        }
        if (Object.keys(extendsGroupsToInclude).length > 0) {
            rootObjectToCopy[getExtensionSettingId('extendsGroups')] = extendsGroupsToInclude
        }

        await vscode.env.clipboard.writeText(JSON.stringify(rootObjectToCopy, undefined, 4))
    })
}
