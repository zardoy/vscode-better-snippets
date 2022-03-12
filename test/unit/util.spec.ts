import { normalizeLanguages as normalizeLanguagesOriginal, areLangsEquals } from '@zardoy/vscode-utils/build/langs'
import { defaultLanguageSupersets } from '../../src/configurationType'

// After refactoring, now its weird that lib function being tested there

const normalizeLanguages = (langs: string | string[]) => normalizeLanguagesOriginal(langs, defaultLanguageSupersets)

test('normalizeLanguages', () => {
    expect(normalizeLanguages('javascriptreact')).toMatchInlineSnapshot(`
    Array [
      "javascriptreact",
    ]
  `)
    expect(normalizeLanguages('*')).toMatchInlineSnapshot(`
    Array [
      "*",
    ]
  `)
    expect(normalizeLanguages('js')).toMatchInlineSnapshot(`
    Array [
      "typescript",
      "javascript",
      "typescriptreact",
      "javascriptreact",
    ]
  `)
    expect(normalizeLanguages(['typescriptreact', 'typescript', 'ts', 'styles'])).toMatchInlineSnapshot(`
    Array [
      "typescriptreact",
      "typescript",
      "typescript",
      "typescriptreact",
      "css",
      "scss",
      "sass",
      "source.css.styled",
    ]
  `)
    expect(normalizeLanguages([])).toMatchInlineSnapshot(`Array []`)
})

test('areLangsEquals', () => {
    expect(areLangsEquals(defaultLanguageSupersets.js, normalizeLanguages('js'))).toMatchInlineSnapshot(`true`)
})
