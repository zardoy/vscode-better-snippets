import type tslib from 'typescript/lib/tsserverlibrary'
import type ts from 'typescript/lib/tsserverlibrary'

import { RequestResponseData } from './requestData'

export = function ({ typescript: ts }: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
    return {
        create(info: ts.server.PluginCreateInfo) {
            // Set up decorator object
            const proxy: ts.LanguageService = Object.create(null)

            for (const k of Object.keys(info.languageService)) {
                const x = info.languageService[k]!
                // @ts-expect-error - JS runtime trickery which is tricky to type tersely
                proxy[k] = (...args: Array<Record<string, unknown>>) => x.apply(info.languageService, args)
            }

            proxy.getCompletionsAtPosition = (fileName, position, options) => {
                if (options?.triggerCharacter === ('betterSnippetsRequest' as any)) {
                    let kind: RequestResponseData['kind'] = 'else'

                    const spanOfEnclosingComment = info.languageService.getSpanOfEnclosingComment(fileName, position, false)
                    if (spanOfEnclosingComment && spanOfEnclosingComment.start + spanOfEnclosingComment.length !== position) {
                        kind = 'comment'
                    } else {
                        const sourceFile = info.languageService.getProgram()!.getSourceFile(fileName)!
                        const node = findChildContainingPosition(ts, sourceFile, position)
                        const isTypeNode = (node: ts.Node) => {
                            if (ts.isTypeNode(node)) {
                                // built-in types
                                return true
                            }

                            if (inTypeReference(node)) return true

                            return false

                            function inTypeReference(node: ts.Node) {
                                if (ts.isTypeReferenceNode(node)) {
                                    return true
                                }

                                return node.parent && inTypeReference(node.parent)
                            }
                        }
                        if (node) {
                            if (ts.isStringLiteralLike(node)) kind = 'string'
                            else if (isTypeNode(node)) kind = 'type'
                        }
                    }

                    return {
                        entries: [],
                        requestResponse: {
                            kind,
                        } as RequestResponseData,
                    } as any
                }
                return info.languageService.getCompletionsAtPosition(fileName, position, options)
            }

            return proxy
        },
        onConfigurationChanged(config: any) {
            // _configuration = config
        },
    }
}

function findChildContainingPosition(
    typescript: typeof import('typescript/lib/tsserverlibrary'),
    sourceFile: tslib.SourceFile,
    position: number,
): tslib.Node | undefined {
    function find(node: ts.Node): ts.Node | undefined {
        if (position >= node.getStart() && position < node.getEnd()) {
            return typescript.forEachChild(node, find) || node
        }
        return
    }
    return find(sourceFile)
}
