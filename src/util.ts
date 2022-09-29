import * as vscode from 'vscode'
import { normalizeRegex } from '@zardoy/vscode-utils/build/settings'
import { ensureHasProp } from '@zardoy/utils'
import { getExtensionSetting } from 'vscode-framework'
import { Configuration } from './configurationType'

export const normalizeFilePathRegex = (input: string, fileType: NonNullable<Configuration['customSnippets'][number]['when']>['fileType']) => {
    if (!fileType) return normalizeRegex(input)
    // eslint-disable-next-line default-case
    switch (fileType) {
        case 'package.json':
            return /\/package.json$/
        case 'tsconfig.json':
            return /\/(t|j)sconfig(\..+)?.json$/
    }
}

export const completionAddTextEdit = (completion: vscode.CompletionItem, textEdit: vscode.TextEdit) => {
    const textEdits = ensureHasProp(completion, 'additionalTextEdits', [])
    textEdits.push(textEdit)
    return textEdits
}

export const Debug =
    (scope: 'resolveImports' | 'snippetsRegexs' | 'snippets') =>
    (...msg) => {
        const debugScopes = getExtensionSetting('debugScopes')
        if (debugScopes.includes(scope)) console.log(`[${scope}]`, ...msg)
    }
