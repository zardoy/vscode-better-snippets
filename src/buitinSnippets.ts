import vscode from 'vscode'
import { getExtensionSetting } from 'vscode-framework'
import { registerOtherSnippets } from './builtinSnippets/other'
import { registerPostfixSnippets } from './builtinSnippets/postfixes'
export const registerBuitinSnippets = () => {
    const builtinSnippets = getExtensionSetting('enableBuiltinSnippets')
    // TODO unregister with setting
    if (!builtinSnippets) return

    registerOtherSnippets()
    registerPostfixSnippets()
}
