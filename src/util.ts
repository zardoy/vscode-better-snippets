import * as vscode from 'vscode'
import { normalizeRegex } from '@zardoy/vscode-utils/build/settings'
import { ensureHasProp } from '@zardoy/utils'
import { getExtensionSetting } from 'vscode-framework'
import { ConditionalPick } from 'type-fest'
import { Configuration } from './configurationType'

// #region extension-related
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

export const Debug = (scope: 'resolveImports' | 'snippetsRegexs' | 'snippets') => {
    return (...msg) => {
        const debugScopes = getExtensionSetting('debugScopes')
        if (debugScopes.includes(scope)) console.log(`[${scope}]`, ...msg)
    }
}
// #endregion

// #region vscode-related
export const getConfigValueFromAllScopes = <T extends keyof ConditionalPick<Configuration, any[]>>(configKey: T): Configuration[T] => {
    const {
        globalValue = [],
        workspaceValue = [],
        workspaceFolderValue = [],
    } = vscode.workspace.getConfiguration(process.env.IDS_PREFIX, null).inspect<any[]>(configKey)!
    return [...globalValue, ...workspaceValue, ...workspaceFolderValue] as any
}
// #endregion

// #region general
export const objectUndefinedIfEmpty = <T extends Record<string, any>>(obj: T) => {
    if (Object.keys(obj).length === 0) return undefined
    return obj
}
// #endregion
