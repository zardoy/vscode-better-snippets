import type { Configuration } from './configurationType'
import { TypingSnippetUnresolved } from './snippet'

export type CustomSnippetApi = Configuration['customSnippets'][number] & {
    snippetAccepted?()
}

export interface ExtensionApi {
    /**
     * Previous contribution from this extension will be replaced
     */
    contributeCustomSnippets(customSnippets: CustomSnippetApi[]): void
    /**
     * Previous contribution from this extension will be replaced
     */
    contributeTypingSnippets(typingSnippets: TypingSnippetUnresolved[]): void
}

export interface ExposedExtensionApi {
    getAPI(extensionId: string, version = 1): ExtensionApi
}
