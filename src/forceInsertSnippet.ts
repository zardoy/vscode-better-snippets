import * as vscode from 'vscode'
import { getActiveRegularEditor } from '@zardoy/vscode-utils'
import { normalizeLanguages } from '@zardoy/vscode-utils/build/langs'
import { showQuickPick } from '@zardoy/vscode-utils/build/quickPick'
import { getExtensionSetting, registerExtensionCommand } from 'vscode-framework'
import { getAllLoadedSnippets } from './loadedSnippets'
import { CustomSnippet } from './snippet'

export default () => {
    registerExtensionCommand('forceInsertCustomSnippet', async (_, name?: string) => {
        const editor = getActiveRegularEditor()
        if (!editor) return

        const allLoadedSnippets = getAllLoadedSnippets()
        const allLangSnippets: CustomSnippet[] = []
        for (const [lang, snippets] of Object.entries(allLoadedSnippets)) {
            const allLangs = normalizeLanguages(lang, getExtensionSetting('languageSupersets'))
            if (!allLangs.includes(editor.document.languageId)) continue
            allLangSnippets.push(...snippets)
        }

        const body = name
            ? allLangSnippets.find(s => s.name === name)?.body
            : await showQuickPick(
                  allLangSnippets.map(({ name, description, body }) => ({
                      value: body,
                      label: name,
                      description,
                  })),
              )
        if (body === undefined) return
        void editor.insertSnippet(new vscode.SnippetString(Array.isArray(body) ? body.join('\n') : body))
    })
}
