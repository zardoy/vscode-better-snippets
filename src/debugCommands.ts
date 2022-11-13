import * as vscode from 'vscode'
import { registerExtensionCommand } from 'vscode-framework'
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
}
