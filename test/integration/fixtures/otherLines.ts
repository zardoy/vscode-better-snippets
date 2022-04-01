/* eslint-disable unicorn/no-abusive-eslint-disable */
/* eslint-disable */
import * as vscode from 'vscode'

export const activate = someData => {
    // 1
    // 2
    if (someData || false) {
        // 3
        const someObj = {
            'a-:/b/'(): Partial<Record<string, any>> | void {
                // 4
                if (false) {
                    // 5 !c
                }
                // 6
            },
            c: 56,
        }
    }
    for (const iterator of []) {
        // 7 c
    }
}

const stringsArr = ['']
